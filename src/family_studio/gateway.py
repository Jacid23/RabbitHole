import httpx
from starlette.exceptions import HTTPException

from .auth import Auth


class Gateway:
    def __init__(self, settings):
        self.settings = settings

    async def json(self, session, method, path, payload=None):
        async with httpx.AsyncClient(timeout=30) as client:
            reply = await client.request(method, self.settings.openwebui + path, headers=Auth.headers(session), json=payload)
        if reply.status_code >= 400:
            raise HTTPException(reply.status_code if reply.status_code < 500 else 502,
                                "Open WebUI could not complete this request.")
        return reply.json()

    async def models(self, session):
        value = await self.json(session, "GET", "/api/models")
        return [item for item in value.get("data", []) if item.get("id") and not item.get("id", "").startswith("arena")]

    async def tools(self, session):
        value = await self.json(session, "GET", "/api/v1/tools/")
        return {item["id"] for item in value}

    async def require_model(self, session, ident):
        if not any(item["id"] == ident for item in await self.models(session)):
            raise HTTPException(403, "This model is not available to your account.")
