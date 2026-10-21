"""
title: Fixed ComfyUI workflow
author: Local workflow tools
version: 1.1.0
description: Runs one administrator-defined ComfyUI workflow.
"""
import asyncio
import copy
import hashlib
import io
import json
import re
import secrets
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import httpx
from pydantic import BaseModel, Field
from starlette.requests import Request

RECIPE = __RECIPE_LITERAL__

__PANEL_SOURCE__

__CONTROLS_SOURCE__

validate_controls(RECIPE)


class Tools:
    class Valves(BaseModel):
        COMFY_URL: str = Field(default=__SERVER_LITERAL__, description="ComfyUI URL reachable from Open WebUI")
        API_KEY: str = Field(default="", description="Optional ComfyUI bearer key; administrator setting")
        MAX_WAIT_SECONDS: int = Field(default=1800, ge=30, le=7200)
        MAX_IMAGE_MB: int = Field(default=50, ge=1, le=200)

    def __init__(self):
        self.valves = self.Valves()

    def _graph(self, prompt, uploaded=None, options=None):
        graph = copy.deepcopy(RECIPE["workflow"])
        for item in RECIPE["prompt_inputs"]:
            graph[item["node"]]["inputs"][item["key"]] = item.get("prefix", "") + prompt
        requested_seed = (options or {}).get("seed", -1)
        if type(requested_seed) is not int or not -1 <= requested_seed < 2**53:
            raise ValueError("Seed must be -1 for random, or an integer from 0 through 2**53-1")
        if requested_seed != -1 and not RECIPE.get("seed_inputs"):
            raise ValueError("This workflow does not expose seed inputs")
        seed = secrets.randbelow(2**53) if requested_seed == -1 else requested_seed
        for item in RECIPE.get("seed_inputs", []):
            graph[item["node"]]["inputs"][item["key"]] = seed
        for item in RECIPE.get("image_inputs", []):
            if not uploaded:
                raise ValueError("This workflow requires an image attached in chat")
            graph[item["node"]]["inputs"][item["key"]] = uploaded
        return apply_controls(RECIPE, graph, options)

    async def _emit(self, emitter, message, progress=None, elapsed=None, job_id=None, done=False, online=True):
        if emitter:
            await emitter({"type":"status", "data":{"description":RECIPE["name"] + " · " + message, "done":done,"hidden":False}})
            panel=render_panel(message,progress,elapsed,job_id,online)
            # Open WebUI's same-origin fallback adds 20px to the viewport's
            # scrollHeight on every srcdoc update. Use its supported height
            # message after that measurement instead of growing indefinitely.
            resize_script = """<script>window.addEventListener('load',()=>{
                requestAnimationFrame(()=>requestAnimationFrame(()=>{
                    parent.postMessage({type:'iframe:height',height:150},'*');
                }));
            });</script>"""
            panel=panel.replace("</body>",resize_script+"</body>")
            await emitter({"type":"embeds","data":{"embeds":[panel],"replace":True}})

    def _headers(self):
        return {"Authorization":"Bearer " + self.valves.API_KEY} if self.valves.API_KEY else {}

    def _url(self, path):
        base = self.valves.COMFY_URL.rstrip("/")
        if urlparse(base).scheme not in {"http","https"}:
            raise ValueError("COMFY_URL must be an HTTP or HTTPS URL")
        return base + path

    @staticmethod
    def _belongs(entry, user):
        prompt = entry.get("prompt") or []
        if not isinstance(prompt,(list,tuple)) or len(prompt)<4 or not isinstance(prompt[3],dict):
            return False
        metadata = prompt[3]
        owner = metadata.get("openwebui_workflow", {})
        return owner.get("user_id") == user.get("id") and owner.get("tool_id") == RECIPE["id"]

    async def _input(self, client, image, files, user):
        from open_webui.models.files import Files
        from open_webui.storage.provider import Storage
        ident = None
        if image:
            match = re.search(r"(?:/api/v1/files/)?([0-9a-fA-F-]{36})(?:/content)?(?:$|[?#])", image)
            if match:
                ident = match.group(1)
        if not ident:
            for item in reversed(files or []):
                ident = item.get("id") or (item.get("file") or {}).get("id")
                if ident:
                    break
        if not ident:
            raise ValueError("Attach an image to this chat first")
        saved = await Files.get_file_by_id(ident)
        if not saved or (saved.user_id != user["id"] and user.get("role") != "admin"):
            raise ValueError("The input image is not accessible to this user")
        mime = (saved.meta or {}).get("content_type", "")
        if mime not in {"image/png","image/jpeg","image/webp"}:
            raise ValueError("Input must be PNG, JPEG or WebP")
        data = await asyncio.to_thread(lambda: Path(Storage.get_file(saved.path)).read_bytes())
        if len(data) > self.valves.MAX_IMAGE_MB*1024*1024:
            raise ValueError("Input image exceeds this tool's size limit")
        suffix = {"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[mime]
        response = await client.post(self._url("/upload/image"), files={"image":(f"owui-{uuid.uuid4().hex}.{suffix}",data,mime)}, data={"type":"input","overwrite":"false"})
        response.raise_for_status()
        value = response.json()
        return "/".join(filter(None,[value.get("subfolder"),value["name"]]))

    async def _store(self, client, image, request, user, prompt_id):
        from starlette.datastructures import UploadFile, Headers
        from open_webui.models.users import Users
        from open_webui.routers.files import upload_file_handler
        if image.get("type","output") not in {"output","temp"}:
            raise ValueError("Unexpected output type")
        response = await client.get(self._url("/view"), params={"filename":image["filename"],"subfolder":image.get("subfolder",""),"type":image.get("type","output")},timeout=60)
        response.raise_for_status()
        mime = response.headers.get("content-type", "").split(";")[0]
        if mime not in {"image/png","image/jpeg","image/webp"}:
            raise ValueError("Workflow output is not a supported image")
        if len(response.content) > self.valves.MAX_IMAGE_MB*1024*1024:
            raise ValueError("Workflow output exceeds this tool's size limit")
        owner = await Users.get_user_by_id(user["id"])
        if owner is None:
            raise ValueError("Cannot identify the image owner")
        upload = UploadFile(file=io.BytesIO(response.content),filename=Path(image["filename"]).name,headers=Headers({"content-type":mime}))
        try:
            saved = await upload_file_handler(request,file=upload,user=owner,metadata={"source":"fixed_comfyui_workflow","workflow_tool":RECIPE["id"],"comfy_prompt_id":prompt_id},process=False,process_in_background=False)
        finally:
            await upload.close()
        info = saved if isinstance(saved,dict) else saved.model_dump()
        expected_hash = (info.get("meta") or {}).get("file_hash")
        if expected_hash and expected_hash != hashlib.sha256(response.content).hexdigest():
            raise RuntimeError("Stored image hash differs from ComfyUI output")
        return {"url":f"/api/v1/files/{info['id']}/content", "filename":image["filename"]}

    async def _finish(self, client, entry, prompt_id, request, user, emitter):
        if not self._belongs(entry,user):
            raise ValueError("This job belongs to another user or workflow tool")
        status = entry.get("status", {})
        if status.get("status_str") == "error":
            errors = [m[1] for m in status.get("messages",[]) if m[0] in {"execution_error","execution_interrupted"}]
            error = errors[-1] if errors else {}
            raise RuntimeError(f"Workflow failed at node {error.get('node_id','?')}: {error.get('exception_message','execution interrupted')}")
        images = []
        for node in RECIPE["output_nodes"]:
            images.extend(entry.get("outputs",{}).get(node,{}).get("images",[]))
        if not images:
            raise RuntimeError("The selected output nodes returned no images")
        if len(images)>64:
            raise RuntimeError("Workflow produced more than 64 images; recover outputs from ComfyUI rather than resubmitting")
        await self._emit(emitter,"Saving full-resolution images to Open WebUI",job_id=prompt_id)
        saved = [await self._store(client,item,request,user,prompt_id) for item in images]
        await self._emit(emitter,"Images ready",100,job_id=prompt_id,done=True)
        return json.dumps({"workflow":RECIPE["name"],"prompt_id":prompt_id,"images":saved}) + "\n" + "\n".join(f"![Generated image]({item['url']})" for item in saved)

    async def _watch(self, client, prompt_id, request, user, emitter, ws=None, started=None):
        started = started or time.monotonic()
        active = False
        last_history = 0
        last_message = "Queued · waiting for ComfyUI"
        while time.monotonic()-started < self.valves.MAX_WAIT_SECONDS:
            if time.monotonic()-last_history >= 2:
                response = await client.get(self._url("/history/"+prompt_id))
                response.raise_for_status()
                entry = response.json().get(prompt_id)
                if entry:
                    return await self._finish(client,entry,prompt_id,request,user,emitter)
                last_history=time.monotonic()
                await self._emit(emitter,last_message,elapsed=round(time.monotonic()-started),job_id=prompt_id)
            if ws is None or ws.closed:
                await asyncio.sleep(1)
                continue
            try:
                message = await asyncio.wait_for(ws.receive(),timeout=1)
            except asyncio.TimeoutError:
                continue
            if message.type != aiohttp.WSMsgType.TEXT:
                if message.type in {aiohttp.WSMsgType.CLOSE,aiohttp.WSMsgType.CLOSED,aiohttp.WSMsgType.ERROR}:
                    ws=None
                continue
            packet=json.loads(message.data)
            event, data = packet.get("type"), packet.get("data",{})
            if data.get("prompt_id") not in {None,prompt_id}:
                continue
            if event=="execution_start" and data.get("prompt_id")==prompt_id:
                active=True
                last_message="Running workflow"
            elif event=="executing" and data.get("prompt_id")==prompt_id and data.get("node"):
                active=True
                node=str(data["node"])
                graph_node=RECIPE["workflow"].get(node,{})
                last_message="Running " + graph_node.get("_meta",{}).get("title",graph_node.get("class_type","node "+node))
            elif event=="progress" and active:
                value, total=data.get("value",0),data.get("max",0)
                if total:
                    last_message=f"Sampling step {value}/{total} (current node)"
                    await self._emit(emitter,last_message,100*value/total,round(time.monotonic()-started),prompt_id)
        await self._emit(emitter,"Still running · do not submit a duplicate",job_id=prompt_id,done=True)
        return f"Job {prompt_id} is still running. Do not regenerate. Call this workflow's check tool with that prompt_id to resume."

    async def _run(self, prompt, image, request, user, emitter, files=None, existing=None, metadata=None, options=None):
        prompt_id=existing
        record=None
        if request is None or not user:
            return "This tool must run inside an authenticated Open WebUI chat."
        await self._emit(emitter,"Checking ComfyUI")
        try:
            async with httpx.AsyncClient(headers=self._headers(),timeout=httpx.Timeout(20,connect=4),follow_redirects=False) as client:
                response=await client.get(self._url("/system_stats"),timeout=5)
                response.raise_for_status()
                if existing:
                    # Verify ownership from queue/history before following an existing job.
                    history=await client.get(self._url("/history/"+existing));history.raise_for_status()
                    entry=history.json().get(existing)
                    if entry:
                        return await self._finish(client,entry,existing,request,user,emitter)
                    queue=await client.get(self._url("/queue"));queue.raise_for_status()
                    entries=queue.json().get("queue_running",[])+queue.json().get("queue_pending",[])
                    owned=any(e[1]==existing and self._belongs({"prompt":e},user) for e in entries)
                    if not owned:
                        raise ValueError("Job not found for this user and workflow")
                    return await self._watch(client,existing,request,user,emitter)
                uploaded=await self._input(client,image,files,user) if RECIPE.get("image_inputs") else None
                graph=self._graph(prompt,uploaded,options)
                client_id=uuid.uuid4().hex
                async with aiohttp.ClientSession(headers=self._headers(),timeout=aiohttp.ClientTimeout(total=10,sock_connect=4)) as session:
                    ws=None
                    try:
                        ws_url=self._url("/ws").replace("https://","wss://",1).replace("http://","ws://",1)
                        ws=await session.ws_connect(ws_url,params={"clientId":client_id},timeout=aiohttp.ClientWSTimeout(ws_close=3),receive_timeout=None)
                    except (aiohttp.ClientError,asyncio.TimeoutError):
                        await self._emit(emitter,"Live socket unavailable · job status will still update")
                    try:
                        # Prevent a chat model from generating repeatedly during the
                        # same assistant turn, including after an uncertain POST.
                        if (metadata or {}).get("message_id"):
                            state=request.app.state
                            records=getattr(state,"comfy_workflow_turns",None)
                            if records is None:
                                records={}
                                state.comfy_workflow_turns=records
                            key=(user["id"],metadata.get("chat_id"),metadata["message_id"],RECIPE["id"])
                            previous=records.get(key)
                            if previous:
                                return previous.get("result") or ("This workflow was already submitted for this chat turn. Do not submit again. " + ("Use its check tool for prompt_id " + previous["prompt_id"] if previous.get("prompt_id") else "Submission is uncertain; stop and report the issue to the user."))
                            for old in [k for k,v in records.items() if time.monotonic()-v["created"]>86400]:
                                records.pop(old,None)
                            record={"created":time.monotonic()}
                            records[key]=record
                        response=await client.post(self._url("/prompt"),json={"prompt":graph,"client_id":client_id,"extra_data":{"openwebui_workflow":{"user_id":user["id"],"tool_id":RECIPE["id"]},"extra_pnginfo":{"openwebui_workflow":{"id":RECIPE["id"],"name":RECIPE["name"]}}},"front":False})
                        result=response.json()
                        if result.get("error") or result.get("node_errors"):
                            raise ValueError("ComfyUI rejected this saved workflow: "+json.dumps(result.get("node_errors") or result["error"]))
                        response.raise_for_status()
                        prompt_id=result["prompt_id"]
                        if record is not None:
                            record["prompt_id"]=prompt_id
                        await self._emit(emitter,"Queued · waiting for ComfyUI",job_id=prompt_id)
                        answer=await self._watch(client,prompt_id,request,user,emitter,ws)
                        if record is not None:
                            record["result"]=answer
                        return answer
                    finally:
                        if ws is not None:
                            await ws.close()
        except Exception as error:
            message=f"{type(error).__name__}: {error}"
            if prompt_id:
                message+=f" · Job {prompt_id}. Do not resubmit; use this workflow's check tool to recover it."
            else:
                message+=" · No confirmed job ID; do not automatically retry an uncertain submission."
            if record is not None:
                record["result"]=message
            await self._emit(emitter,message,job_id=prompt_id,done=True,online=False)
            return message

    async def __TOOL_FUNCTION__(self, prompt: str, __IMAGE_PARAMETER____CONTROL_PARAMETERS____request__: Request = None, __user__: dict = None, __event_emitter__=None, __files__: list = None, __metadata__: dict = None) -> str:
        __DESCRIPTION_LITERAL__
        return await self._run(prompt, __IMAGE_VALUE__, __request__, __user__, __event_emitter__, __files__, metadata=__metadata__, options=__CONTROL_VALUES__)

    async def __SETTINGS_FUNCTION__(self) -> str:
        """List this workflow's approved image ratios, resolutions, step limits and LoRA pool without generating an image. Omitted generation controls preserve workflow defaults. Resolution tiers specify the long edge in pixels. LoRA strength is a 0–1 multiplier of the administrator's fixed per-LoRA strengths."""
        return json.dumps(RECIPE.get("options") or {})

    async def __CHECK_FUNCTION__(self, prompt_id: str, __request__: Request = None, __user__: dict = None, __event_emitter__=None) -> str:
        """Resume/check this workflow's existing job without submitting another generation. Only jobs belonging to the current user and this workflow can be retrieved."""
        return await self._run("", "", __request__, __user__, __event_emitter__, existing=prompt_id)
