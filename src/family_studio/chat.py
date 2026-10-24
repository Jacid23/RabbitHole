import asyncio
import json
import logging
import uuid

import httpx
from starlette.exceptions import HTTPException
from starlette.responses import StreamingResponse

from .auth import Auth


def event(value):
    return "data: " + json.dumps(value) + "\n\n"


def content_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(part.get("text", "") for part in value
                       if isinstance(part, dict) and part.get("type") in {"text", "output_text"}
                       and isinstance(part.get("text"), str))
    return ""


def completion_text(value):
    choices = value.get("choices") or []
    if choices:
        return content_text((choices[0].get("message") or {}).get("content"))
    return "".join(content_text(item.get("content")) for item in value.get("output", [])
                   if isinstance(item, dict) and item.get("type") == "message")


class Chat:
    def __init__(self, settings, store, gateway):
        self.settings, self.store, self.gateway = settings, store, gateway
        self.active = set()

    async def send(self, session, data):
        await self.gateway.require_model(session, data["model"])
        owner = session.user["id"]
        if owner in self.active:
            raise HTTPException(409, "A reply is already running for this account.")
        temporary = data.get("temporary", False)
        history = data.get("temporary_history") or []
        if temporary and data.get("conversation"):
            raise HTTPException(400, "Start a new temporary chat instead of converting saved history.")
        if history and not temporary:
            raise HTTPException(400, "Saved conversations use account history.")
        if sum(len(m["content"]) for m in history) > 200000:
            raise HTTPException(400, "This temporary chat is full. Start a new chat.")
        current = self.store.get(owner, data.get("conversation"), "chat") if data.get("conversation") else None
        if data.get("conversation") and not current:
            raise HTTPException(404, "Conversation not found")
        if current and current.get("workflow") and current["workflow"] != data.get("workflow"):
            raise HTTPException(404, "This conversation belongs to another hole")
        messages = history if temporary else (current or {}).get("messages", [])
        if not messages and data.get("greeting"):
            messages = [{"role": "assistant", "content": data["greeting"]}]
        messages = [*messages, {"role": "user", "content": data["message"]}]
        value = {"title": (current or {}).get("title") or data["message"][:64],
                 "model": data["model"], "workflow": data.get("workflow"), "messages": messages}
        chat = ({**value, "id": str(uuid.uuid4())} if temporary else
                self.store.put(owner, "chat", value, (current or {}).get("id")))
        self.active.add(owner)

        async def stream():
            answer = ""
            frame_count = 0
            response_frames = 0
            try:
                if not temporary:
                    yield event({"type": "conversation", "id": chat["id"]})
                context = [{"role": "system", "content": data["system_prompt"]}] if data.get("system_prompt") else []
                payload = {"model": data["model"], "messages": [*context, *messages], "stream": True,
                    "tools": [], "tool_ids": [], "features": {"image_generation": False, "web_search": False},
                    "metadata": {"chat_id": "local:family-studio-" + chat["id"]}}
                async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=10)) as client:
                    async with client.stream("POST", self.settings.openwebui + "/api/chat/completions",
                                             headers=Auth.headers(session), json=payload) as reply:
                        if reply.status_code != 200:
                            yield event({"type": "error", "message": "The model could not reply. Check its availability in Open WebUI."})
                            return
                        if "application/json" in reply.headers.get("content-type", ""):
                            await reply.aread()
                            value = reply.json()
                            answer = completion_text(value)
                            if answer:
                                yield event({"type": "text", "text": answer})
                            else:
                                yield event({"type": "error", "message": "The model returned no answer. Check its availability in Open WebUI."})
                            yield event({"type": "done"})
                            return
                        async for line in reply.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            raw = line[5:].strip()
                            if raw == "[DONE]":
                                break
                            try:
                                value = json.loads(raw)
                            except json.JSONDecodeError:
                                continue
                            frame_count += 1
                            if value.get("error"):
                                yield event({"type": "error", "message": "The chat model returned an error."})
                                return
                            if value.get("type") == "response.output_text.delta":
                                response_frames += 1
                                text = content_text(value.get("delta"))
                                answer += text
                                if text:
                                    yield event({"type": "text", "text": text})
                                continue
                            if value.get("type") in {"response.completed", "response.output_text.done"}:
                                response_frames += 1
                                full = (content_text(value.get("text")) if value.get("type") == "response.output_text.done"
                                        else completion_text(value.get("response") or {}))
                                text = full[len(answer):] if full.startswith(answer) else ""
                                if text:
                                    answer += text
                                    yield event({"type": "text", "text": text})
                                continue
                            choices = value.get("choices") or []
                            if not choices:
                                continue
                            delta = choices[0].get("delta") or {}
                            text = content_text(delta.get("content"))
                            if not text and choices[0].get("message"):
                                full = completion_text(value)
                                text = full[len(answer):] if full.startswith(answer) else ""
                            # Thinking remains in the provider; only the answer is displayed.
                            if isinstance(text, str) and text:
                                answer += text
                                yield event({"type": "text", "text": text})
                if not answer:
                    logging.getLogger(__name__).warning("Empty chat reply: frames=%d response_frames=%d", frame_count, response_frames)
                    yield event({"type": "error", "message": "The model returned no answer. Check its availability in Open WebUI."})
                yield event({"type": "done"})
            except asyncio.CancelledError:
                raise
            except httpx.HTTPError:
                yield event({"type": "error", "message": "Connection to Open WebUI was interrupted. " + ("Your temporary chat remains here until you leave." if temporary else "Your conversation is saved.")})
            finally:
                if answer and not temporary:
                    self.store.put(owner, "chat", {**chat, "messages": [*messages, {"role": "assistant", "content": answer}]}, chat["id"])
                self.active.discard(owner)

        return StreamingResponse(stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
