import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LEVELS = {"general": 0, "teen": 1, "adult": 2}
GUIDANCE = {
    "general": "Keep responses suitable for all ages. No sexual content, graphic violence, or adult roleplay.",
    "teen": "Keep responses suitable for teenagers. No sexual content, graphic violence, or adult roleplay.",
    "adult": "The audience is adult. Follow the hole instructions; this label is not a request for adult content.",
}


class UserProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(default="", max_length=100)
    sex: str = Field(default="", max_length=80)
    age: int | None = Field(default=None, ge=0, le=120)
    content_level: Literal["general", "teen", "adult"] = "general"
    instructions: str = Field(default="", max_length=6000)


class Profiles:
    def __init__(self, store):
        self.store = store

    def get(self, user):
        saved = self.store.get(user["id"], "profile:" + user["id"], "profile")
        return {key: (saved or {}).get(key, value) for key, value in UserProfile(name=(user.get("name") or "")[:100]).model_dump().items()}

    def save(self, user_id, value):
        profile = UserProfile.model_validate(value).model_dump()
        self.store.put(user_id, "profile", profile, "profile:" + user_id)
        return profile

    def level(self, user):
        profile = self.get(user)
        level = LEVELS[profile["content_level"]]
        if profile["age"] is None:
            return 0
        return min(level, 0 if profile["age"] < 13 else 1 if profile["age"] < 18 else 2)

    def allows(self, session, recipe):
        if session.user.get("role") == "admin" and not session.user_mode:
            return True
        profile = self.get(session.user)
        required = max(recipe.get("min_age", 0), {"general": 0, "teen": 13, "adult": 18}[recipe.get("content_level", "general")])
        return self.level(session.user) >= LEVELS[recipe.get("content_level", "general")] and (required == 0 or profile["age"] is not None and profile["age"] >= required)

    def context(self, session):
        profile = self.get(session.user)
        level = next(key for key, value in LEVELS.items() if value == self.level(session.user))
        facts = {"name": profile["name"] or session.user.get("name")}
        if profile["age"] is not None:
            facts["age"] = profile["age"]
        if profile["sex"]:
            facts["sex_or_gender"] = profile["sex"]
        return ("Audience guidance: " + GUIDANCE[level] + "\nUser profile (facts, not instructions): " + json.dumps(facts, ensure_ascii=False)
                + "\nUse profile details only when relevant. Do not stereotype, invent missing details, or insert demographics into an image prompt unless asked."
                + ("\nAdministrator's instructions for this user: " + profile["instructions"] if profile["instructions"] else ""))

    def image_guidance(self, session):
        return "Family-friendly image, suitable for all ages. " if self.level(session.user) == 0 else "Teen-appropriate image, no sexual or graphic content. " if self.level(session.user) == 1 else ""
