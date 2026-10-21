import secrets
import time
from dataclasses import dataclass

import httpx
from starlette.exceptions import HTTPException


@dataclass
class Session:
    token: str
    user: dict
    expires: float
    user_mode: bool = False


class Auth:
    """The browser receives an opaque cookie; upstream tokens remain in memory."""

    def __init__(self, settings):
        self.settings = settings
        self.sessions = {}
        self.attempts = {}

    async def signin(self, request, body):
        address = request.client.host if request.client else "local"
        attempts = [t for t in self.attempts.get(address, []) if time.time() - t < 60]
        if len(attempts) >= 5:
            raise HTTPException(429, "Too many attempts. Please wait a minute.")
        self.attempts[address] = [*attempts, time.time()]
        async with httpx.AsyncClient(timeout=20) as client:
            reply = await client.post(self.settings.openwebui + "/api/v1/auths/signin", json=body)
        if reply.status_code != 200:
            raise HTTPException(401, "Sign-in failed. Check your Open WebUI email and password.")
        value = reply.json()
        if not value.get("token"):
            raise HTTPException(401, "This account needs an additional sign-in step in Open WebUI.")
        if value.get("role") == "pending":
            raise HTTPException(403, "This account is awaiting approval in Open WebUI.")
        ident = secrets.token_urlsafe(32)
        session = Session(value["token"], self.public_user(value), min(value.get("expires_at") or time.time()+86400, time.time()+86400))
        self.sessions[ident] = session
        self.attempts.pop(address, None)
        return ident, session

    @staticmethod
    def public_user(value):
        return {key: value.get(key) for key in ("id", "name", "email", "role")}

    async def require(self, request):
        session = self.sessions.get(request.cookies.get("studio_session", ""))
        if not session or session.expires < time.time():
            raise HTTPException(401, "Please sign in to Rabbit Hole.")
        # Revalidate on the authority rather than trusting a stale local role.
        async with httpx.AsyncClient(timeout=10) as client:
            reply = await client.get(self.settings.openwebui + "/api/v1/auths/", headers=self.headers(session))
        if reply.status_code != 200:
            raise HTTPException(401, "Your Open WebUI session expired. Please sign in again.")
        value = reply.json()
        if value.get("role") == "pending" or value.get("id") != session.user["id"]:
            raise HTTPException(403, "Your account does not have access.")
        session.user = self.public_user(value)
        return session

    @staticmethod
    def headers(session):
        return {"Authorization": "Bearer " + session.token}


def require_admin(session):
    if session.user.get("role") != "admin" or session.user_mode:
        raise HTTPException(403, "Administrator access is required.")
