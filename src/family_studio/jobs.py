import asyncio
import hashlib
import json
import time
import types
import uuid

from starlette.exceptions import HTTPException

from .catalog import builder


class Jobs:
    def __init__(self, settings, store, catalog):
        self.settings, self.store, self.catalog = settings, store, catalog
        self.tasks = {}
        self.semaphore = asyncio.Semaphore(1)
        self.state = types.SimpleNamespace()
        self.store.interrupt_old_jobs()

    async def submit(self, session, data):
        recipe = await self.catalog.require(session, data["workflow"])
        options = dict(data.get("options") or {})
        if options.get("loras") or options.get("lora_strength", 1) != 1:
            raise HTTPException(403, "LoRAs are fixed by this hole's administrator.")
        options["loras"] = recipe.get("default_loras", [])
        options["lora_strength"] = 1
        data = {**data, "options": options}
        image_style = recipe.get("image_prompt", "")
        if self.catalog.profiles:
            image_style = self.catalog.profiles.image_guidance(session) + image_style
        if recipe.get("image_inputs") and not data.get("input_image"):
            raise HTTPException(400, "Attach an image for this workflow.")
        module = types.ModuleType("studio_workflow")
        exec(builder.build(recipe, self.settings.comfy)["content"], module.__dict__)
        # Validate before creating or queuing any work.
        try:
            module.Tools()._graph(data["prompt"], "input-validation.png", data.get("options"))
        except (ValueError, TypeError) as error:
            raise HTTPException(400, str(error)) from error
        owner = session.user["id"]
        # Only one active render per account; reconnect/retry cannot enqueue duplicates.
        active = [j for j in self.store.list(owner, "job") if j["state"] in {"queued", "running"}]
        if active:
            if active[0]["workflow"] != recipe["id"]:
                raise HTTPException(409, "An image is still being created in another hole. Let it finish first.")
            return active[0]
        job = self.store.put(owner, "job", {"state": "queued", "message": "Waiting for the image server",
            "progress": None, "prompt": data["prompt"], "workflow": recipe["id"], "workflow_name": recipe["name"],
            "options": data.get("options") or {}, "image_style": image_style, "images": [], "comfy_id": None,
            "input_image": data.get("input_image"), "elapsed": 0})
        self.tasks[job["id"]] = asyncio.create_task(self.run(session.user, job, recipe))
        return job

    def update(self, owner, ident, **patch):
        current = self.store.get(owner, ident, "job")
        return self.store.put(owner, "job", {**current, **patch}, ident)

    async def recover(self, session, ident):
        job = self.store.get(session.user["id"], ident, "job")
        if not job:
            raise HTTPException(404, "Job not found")
        recipe = await self.catalog.require(session, job["workflow"])
        if ident in self.tasks:
            return job
        if not job.get("comfy_id"):
            raise HTTPException(409, "No confirmed ComfyUI job ID. Check the server before trying again.")
        self.tasks[ident] = asyncio.create_task(self.run(session.user, job, recipe, recover=True))
        return self.update(session.user["id"], ident, state="queued", message="Recovering your existing image")

    async def run(self, user, job, recipe, recover=False):
        owner, ident = user["id"], job["id"]
        started = time.monotonic()
        try:
            async with self.semaphore:
                module = types.ModuleType("studio_job_" + ident.replace("-", ""))
                exec(builder.build(recipe, self.settings.comfy)["content"], module.__dict__)
                tool = module.Tools()

                async def emit(emitter, message, progress=None, elapsed=None, job_id=None, done=False, online=True):
                    patch = {"message": message, "progress": progress, "elapsed": round(time.monotonic()-started)}
                    if job_id:
                        patch["comfy_id"] = job_id
                    if not done:
                        patch["state"] = "running"
                    self.update(owner, ident, **patch)

                async def store(client, image, request, user, prompt_id):
                    response = await client.get(tool._url("/view"), params={
                        "filename": image["filename"], "subfolder": image.get("subfolder", ""), "type": image.get("type", "output")}, timeout=60)
                    response.raise_for_status()
                    mime = response.headers.get("content-type", "").split(";")[0]
                    suffix = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(mime)
                    if not suffix or len(response.content) > 50*1024*1024:
                        raise ValueError("Image output is unsupported or too large")
                    file_id = str(uuid.uuid4())
                    filename = file_id + suffix
                    (self.store.media / filename).write_bytes(response.content)
                    saved = self.store.put(owner, "image", {"file": filename, "mime": mime,
                        "prompt": job["prompt"], "workflow": recipe["id"], "workflow_name": recipe["name"],
                        "options": job["options"], "job": ident, "sha256": hashlib.sha256(response.content).hexdigest()}, file_id)
                    current = self.store.get(owner, ident, "job")
                    self.update(owner, ident, images=[*current["images"], saved["id"]])
                    return {"url": "/api/media/" + file_id, "filename": image["filename"]}

                async def input_image(client, image, files, current_user):
                    saved = self.store.get(owner, job.get("input_image"), "input")
                    if not saved:
                        raise ValueError("Input image is not available to this account")
                    data = (self.store.media / saved["file"]).read_bytes()
                    response = await client.post(tool._url("/upload/image"), files={"image": (
                        saved["file"], data, saved["mime"])}, data={"type": "input", "overwrite": "false"})
                    response.raise_for_status()
                    result = response.json()
                    return "/".join(filter(None, [result.get("subfolder"), result["name"]]))

                tool._emit, tool._store, tool._input = emit, store, input_image
                request = types.SimpleNamespace(app=types.SimpleNamespace(state=self.state))
                result = await tool._run((job.get("image_style", "") + "\n" + job["prompt"]).strip(), "", request, user, None,
                    existing=job.get("comfy_id") if recover else None,
                    metadata={"chat_id": "family-studio", "message_id": ident}, options=job["options"])
                current = self.store.get(owner, ident, "job")
                state = "ready" if current["images"] else "interrupted" if "still running" in result else "error"
                self.update(owner, ident, state=state, progress=100 if state == "ready" else None,
                            message="Your image is ready" if state == "ready" else result,
                            elapsed=round(time.monotonic()-started))
        except asyncio.CancelledError:
            self.update(owner, ident, state="interrupted", message="Studio stopped. Recover this job when it is back online.")
            raise
        except Exception as error:
            self.update(owner, ident, state="error", message=str(error))
        finally:
            self.tasks.pop(ident, None)

    async def close(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
