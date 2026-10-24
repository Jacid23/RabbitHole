import asyncio
import json
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles

from .auth import Auth, require_admin
from .catalog import Catalog
from .chat import Chat
from .config import ROOT, Settings
from .gateway import Gateway
from .enhance import PromptEnhancer
from .jobs import Jobs
from .store import Store
from .profiles import Profiles, UserProfile
from .opening_images import OpeningImages


class Signin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


class Generation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workflow: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=12000)
    options: dict = Field(default_factory=dict)
    input_image: str | None = None


class TemporaryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20000)


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=20000)
    conversation: str | None = None
    temporary: bool = False
    temporary_history: list[TemporaryMessage] = Field(default_factory=list, max_length=100)
    workflow: str | None = Field(default=None, min_length=1, max_length=100)


class PurgeChats(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(min_length=1, max_length=10000)
    confirmed: Literal[True]


class EnhancePrompt(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    model: str = Field(default="", max_length=200)
    workflow: str | None = Field(default=None, min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=12000)


class ViewMode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_mode: bool


async def body(request, schema):
    try:
        return schema.model_validate(await request.json()).model_dump()
    except (ValidationError, ValueError) as error:
        raise HTTPException(400, "Check the required fields and image settings.") from error


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and urlparse(origin).netloc != request.headers.get("host"):
            return JSONResponse({"error": "Cross-origin requests are not allowed."}, status_code=403)
        reply = await call_next(request)
        reply.headers["X-Content-Type-Options"] = "nosniff"
        reply.headers["Referrer-Policy"] = "same-origin"
        reply.headers["X-Frame-Options"] = "SAMEORIGIN"
        if request.url.path.startswith("/api/"):
            reply.headers["Cache-Control"] = "no-store"
        return reply


def create_app(settings=None):
    settings = settings or Settings()
    store = Store(settings.data)
    auth, gateway = Auth(settings), Gateway(settings)
    profiles = Profiles(store)
    catalog = Catalog(settings, gateway, profiles)
    opening_images = OpeningImages(settings, auth, catalog)
    jobs, chat = Jobs(settings, store, catalog), Chat(settings, store, gateway)
    enhancer = PromptEnhancer(settings, gateway)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await jobs.close()
        store.close()

    async def exception(request, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code)

    async def unavailable(request, error):
        return JSONResponse({"error": "The connected service is unavailable. Please try again shortly."}, status_code=502)

    async def signin(request):
        ident, session = await auth.signin(request, await body(request, Signin))
        reply = JSONResponse({"user": session.user})
        reply.set_cookie("studio_session", ident, httponly=True, samesite="strict",
                         secure=settings.secure_cookie, max_age=86400)
        return reply

    async def signout(request):
        auth.sessions.pop(request.cookies.get("studio_session", ""), None)
        reply = JSONResponse({"ok": True})
        reply.delete_cookie("studio_session")
        return reply

    def permitted_records(session, kind, recipes):
        return [row for row in store.list(session.user["id"], kind, limit=None if kind == "trashed_chat" else 200) if not row.get("workflow") or row["workflow"] in recipes]

    async def require_record(session, value):
        if value.get("workflow"):
            await catalog.require(session, value["workflow"])

    def chat_summary(row):
        return {**{key: row[key] for key in ("id", "title", "model", "created", "updated")},
                "workflow": row.get("workflow"), "locked": bool(row.get("locked", False))}

    async def bootstrap(request):
        session = await auth.require(request)
        models, recipes = await asyncio.gather(gateway.models(session), catalog.visible(session))
        public_user = {**session.user, "role": "user" if session.user_mode else session.user["role"], "is_admin": session.user["role"] == "admin", "user_mode": session.user_mode}
        return JSONResponse({"user": public_user, "profile": profiles.get(session.user), "models": [{"id": m["id"], "name": m.get("name") or m["id"],
            "description": (m.get("info", {}).get("meta", {}) or {}).get("description", "")} for m in models],
            "workflows": [catalog.public(r) for r in recipes.values()],
            "chats": [chat_summary(row) for row in permitted_records(session, "chat", recipes)],
            "trashed_chats": [chat_summary(row) for row in permitted_records(session, "trashed_chat", recipes)], "jobs": permitted_records(session, "job", recipes),
            "images": permitted_records(session, "image", recipes), "openwebui": settings.public_openwebui})

    async def health(request):
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=4) as client:
                response = await client.get(settings.comfy + "/system_stats")
            return JSONResponse({"online": response.status_code == 200, "checked": time.time(),
                                 "latency_ms": round((time.monotonic()-started)*1000)})
        except httpx.HTTPError:
            return JSONResponse({"online": False, "checked": time.time()})

    async def generate(request):
        session = await auth.require(request)
        return JSONResponse(await jobs.submit(session, await body(request, Generation)), status_code=202)

    async def view_mode(request):
        session = await auth.require(request)
        if session.user.get("role") != "admin":
            raise HTTPException(403, "Only an administrator can switch preview mode")
        session.user_mode = (await body(request, ViewMode))["user_mode"]
        return JSONResponse({"user_mode": session.user_mode})

    async def admin_profiles(request):
        session = await auth.require(request)
        require_admin(session)
        if request.method == "POST":
            target = request.path_params["id"]
            users = await gateway.json(session, "GET", "/api/v1/users/all")
            rows = users.get("users", []) if isinstance(users, dict) else users
            if not any(user["id"] == target for user in rows):
                raise HTTPException(404, "User not found")
            return JSONResponse(profiles.save(target, await body(request, UserProfile)))
        users = await gateway.json(session, "GET", "/api/v1/users/all")
        rows = users.get("users", []) if isinstance(users, dict) else users
        return JSONResponse({"users": [{"id": user["id"], "name": user.get("name") or "Unnamed user", "role": user.get("role"), "profile": profiles.get(user)} for user in rows]})

    async def enhance_prompt(request):
        session = await auth.require(request)
        data = await body(request, EnhancePrompt)
        if data["workflow"]:
            recipe = await catalog.require(session, data["workflow"])
            data["model"] = recipe.get("enhancer_model") or recipe.get("chat_model") or data["model"]
            data["instructions"] = recipe.get("enhancer_prompt", "")
        data["user_context"] = profiles.context(session)
        if not data["model"]:
            raise HTTPException(400, "Choose an enhancer model in the builder or select a chat model.")
        return JSONResponse(await enhancer.enhance(session, data))

    async def get_job(request):
        session = await auth.require(request)
        value = store.get(session.user["id"], request.path_params["id"], "job")
        if not value:
            raise HTTPException(404, "Image request not found")
        await require_record(session, value)
        return JSONResponse(value)

    async def recover(request):
        session = await auth.require(request)
        return JSONResponse(await jobs.recover(session, request.path_params["id"]))

    async def media(request):
        session = await auth.require(request)
        owner, ident = session.user["id"], request.path_params["id"]
        value = store.get(owner, ident, "image") or store.get(owner, ident, "input") or store.get(owner, ident, "trashed_image")
        if not value or "file" not in value:
            raise HTTPException(404, "Image not found")
        await require_record(session, value)
        return FileResponse(store.media / value["file"], media_type=value["mime"],
                            filename="studio-"+value["id"]+"."+value["file"].rsplit(".", 1)[-1],
                            content_disposition_type="attachment" if request.query_params.get("download") else "inline")

    async def image_trash(request):
        session = await auth.require(request)
        return JSONResponse(permitted_records(session, "trashed_image", await catalog.visible(session)))

    async def change_image(request):
        session = await auth.require(request)
        restore = request.path_params["action"] == "restore"
        if request.path_params["action"] not in {"delete", "restore"}:
            raise HTTPException(404, "Action not found")
        value = store.get(session.user["id"], request.path_params["id"], "trashed_image" if restore else "image")
        if value:
            await require_record(session, value)
        if not store.trash_image(session.user["id"], request.path_params["id"], restore):
            raise HTTPException(404, "Creation not found")
        return JSONResponse({"ok": True})

    async def upload(request):
        session = await auth.require(request)
        mime = request.headers.get("content-type", "").split(";")[0]
        suffix = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(mime)
        if not suffix:
            raise HTTPException(400, "Choose a PNG, JPEG or WebP image.")
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 30*1024*1024:
                raise HTTPException(413, "Choose an image smaller than 30 MB.")
        ident = str(uuid.uuid4())
        filename = ident + suffix
        (store.media / filename).write_bytes(data)
        return JSONResponse(store.put(session.user["id"], "input", {"file": filename, "mime": mime}, ident))

    async def chats(request):
        session = await auth.require(request)
        data = await body(request, Message)
        if data["workflow"]:
            recipe = await catalog.require(session, data["workflow"])
            data["model"] = recipe.get("chat_model") or data["model"]
            data["system_prompt"] = recipe.get("chat_prompt", "")
            data["greeting"] = (recipe.get("opening") or {}).get("greeting", "")
        data["system_prompt"] = ((data.get("system_prompt") or "") + "\n\n" + profiles.context(session)).strip()
        return await chat.send(session, data)

    async def get_chat(request):
        session = await auth.require(request)
        value = store.get(session.user["id"], request.path_params["id"], "chat")
        if not value:
            raise HTTPException(404, "Conversation not found")
        await require_record(session, value)
        return JSONResponse(value)

    async def purge_chats(request):
        session = await auth.require(request)
        data = await body(request, PurgeChats)
        ids = list(dict.fromkeys(data["ids"]))
        recipes = await catalog.visible(session)
        for ident in ids:
            value = store.get(session.user["id"], ident, "trashed_chat")
            if not value:
                raise HTTPException(404, "A selected conversation is no longer in your Trash. Refresh history.")
            if value.get("workflow") and value["workflow"] not in recipes:
                raise HTTPException(403, "This workflow is not available to your account.")
        try:
            deleted = store.purge_chats(session.user["id"], ids)
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        return JSONResponse({"deleted": deleted})

    async def manage_chat(request):
        session = await auth.require(request)
        action = request.path_params["action"]
        if action not in {"lock", "unlock", "trash", "restore"}:
            raise HTTPException(404, "Conversation action not found")
        owner, ident = session.user["id"], request.path_params["id"]
        value = store.get(owner, ident, "trashed_chat" if action == "restore" else "chat")
        if not value:
            raise HTTPException(404, "Conversation not found")
        await require_record(session, value)
        if action == "trash" and owner in chat.active:
            raise HTTPException(409, "Wait for the current reply to finish before deleting a conversation.")
        try:
            changed = store.manage_chat(owner, ident, action)
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        if not changed:
            raise HTTPException(404, "Conversation not found")
        return JSONResponse({"ok": True})

    async def proxy_file(request):
        session = await auth.require(request)
        # Fixed upstream path and owner authorization remain Open WebUI's responsibility.
        try:
            ident = str(uuid.UUID(request.path_params["id"]))
        except ValueError as error:
            raise HTTPException(404, "Image not found") from error
        async with httpx.AsyncClient(timeout=60) as client:
            reply = await client.get(settings.openwebui+"/api/v1/files/"+ident+"/content", headers=Auth.headers(session))
        if reply.status_code != 200:
            raise HTTPException(404, "File not found")
        return Response(reply.content, media_type=reply.headers.get("content-type", "application/octet-stream"))

    async def admin(request):
        session = await auth.require(request)
        require_admin(session)
        if request.method == "POST":
            try:
                return JSONResponse(await catalog.save(session, await request.json()))
            except (ValueError, KeyError, TypeError) as error:
                raise HTTPException(400, "Check the workflow recipe and its option mappings.") from error
        return JSONResponse({"recipes": list((await catalog.visible(session)).values()), "openwebui": settings.public_openwebui,
                             "models": [{"id": model["id"], "name": model.get("name") or model["id"]} for model in await gateway.models(session)]})

    async def admin_loras(request):
        session = await auth.require(request)
        require_admin(session)
        async with httpx.AsyncClient(timeout=20) as client:
            reply = await client.get(settings.comfy+"/object_info/LoraLoaderModelOnly")
        reply.raise_for_status()
        return JSONResponse(reply.json()["LoraLoaderModelOnly"]["input"]["required"]["lora_name"][0])

    async def admin_builder(request):
        session = await auth.require(request)
        require_admin(session)
        return FileResponse(ROOT / "integrations/comfyui/Workflow Tool Builder.html", media_type="text/html")

    async def preview(request):
        if not settings.preview:
            raise HTTPException(404, "Not found")
        sample = settings.data / "preview"
        sample.mkdir(exist_ok=True)
        sources = [("garden", ROOT / ".runtime/comfy-square-public.png"),
                   ("portrait", ROOT / ".runtime/comfy-portrait-public.png"),
                   ("rooftop", Path("D:/Shared Outputs/OpenWebUI/comfy_krea_square_00003_.png"))]
        images = []
        for name, source in sources:
            if source.exists():
                target = sample / (name + ".png")
                if not target.exists():
                    shutil.copy2(source, target)
                images.append({"id": name, "prompt": {"garden": "A tiny robot tending a greenhouse", "portrait": "A friendly robot gardener", "rooftop": "A rooftop garden at golden hour"}[name],
                               "url": "/api/preview/"+name, "workflow_name": "Krea", "created": time.time()})
        # Preview never reveals private recipe names, graph data or approved pools.
        example = {"id":"preview", "name":"Everyday images", "description":"Local image creation",
            "size":{"ratios":["1:1","2:3","3:2","3:4","4:3","9:16","16:9","21:9"],
                    "resolutions":{"1K":1024,"2K":2048},"default_ratio":"1:1","default_resolution":"1K"},
            "steps":{"min":1,"max":50,"default":8},"seed":True,"needs_image":False,"loras":[],"max_loras":0}
        return JSONResponse({"images": images, "workflows": [example]})

    async def preview_image(request):
        if not settings.preview or request.path_params["id"] not in {"garden", "portrait", "rooftop"}:
            raise HTTPException(404, "Not found")
        path = settings.data / "preview" / (request.path_params["id"]+".png")
        if not path.exists():
            raise HTTPException(404, "Not found")
        return FileResponse(path, media_type="image/png")

    async def index(request):
        if request.url.path.startswith("/api/"):
            raise HTTPException(404, "Not found")
        return FileResponse(settings.frontend / "index.html")

    routes = [Route("/api/auth/signin", signin, methods=["POST"]), Route("/api/auth/signout", signout, methods=["POST"]),
        Route("/api/bootstrap", bootstrap), Route("/api/health", health), Route("/api/generate", generate, methods=["POST"]),
        Route("/api/prompts/enhance", enhance_prompt, methods=["POST"]),
        Route("/api/auth/view", view_mode, methods=["POST"]),
        Route("/api/admin/profiles", admin_profiles), Route("/api/admin/profiles/{id}", admin_profiles, methods=["POST"]),
        Route("/api/jobs/{id}", get_job), Route("/api/jobs/{id}/recover", recover, methods=["POST"]),
        Route("/api/media/{id}", media), Route("/api/upload", upload, methods=["POST"]),
        Route("/api/images/trash", image_trash), Route("/api/images/{id}/{action}", change_image, methods=["POST"]),
        Route("/api/chat", chats, methods=["POST"]), Route("/api/chats/{id}", get_chat),
        Route("/api/chats/trash/purge", purge_chats, methods=["POST"]),
        Route("/api/chats/{id}/{action}", manage_chat, methods=["POST"]),
        Route("/api/v1/files/{id}/content", proxy_file), Route("/api/admin/workflows", admin, methods=["GET", "POST"]),
        Route("/api/admin/loras", admin_loras), Route("/api/admin/builder", admin_builder),
        Route("/api/admin/opening-images", opening_images.upload, methods=["POST"]),
        Route("/api/admin/opening-images/{image}", opening_images.admin_image),
        Route("/api/workflows/{id}/examples/{image}", opening_images.image),
        Route("/api/preview", preview), Route("/api/preview/{id}", preview_image)]
    if (settings.frontend / "assets").exists():
        routes.append(Mount("/assets", StaticFiles(directory=settings.frontend / "assets")))
    routes.append(Route("/{path:path}", index))
    app = Starlette(routes=routes, lifespan=lifespan,
                    exception_handlers={HTTPException: exception, httpx.HTTPError: unavailable})
    app.add_middleware(SecurityHeaders)
    app.state.auth, app.state.store, app.state.jobs = auth, store, jobs
    app.state.catalog, app.state.gateway, app.state.settings = catalog, gateway, settings
    return app
