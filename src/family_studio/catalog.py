import asyncio
import importlib.util
import json
from pathlib import Path

from starlette.exceptions import HTTPException

from .config import ROOT

spec = importlib.util.spec_from_file_location("studio_tool_builder", ROOT / "scripts/build_comfyui_tool.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class Catalog:
    def __init__(self, settings, gateway, profiles=None):
        self.settings, self.gateway = settings, gateway
        self.lock = asyncio.Lock()
        self.profiles = profiles

    def recipes(self):
        values = {}
        for path in self.settings.recipes.glob("*.recipe.json"):
            recipe = json.loads(path.read_text(encoding="utf-8-sig"))
            builder.validate_recipe(recipe)
            values[recipe["id"]] = recipe
        return values

    async def visible(self, session):
        allowed = await self.gateway.tools(session)
        return {key: value for key, value in self.recipes().items() if key in allowed and (not self.profiles or self.profiles.allows(session, value))}

    async def require(self, session, ident):
        recipe = (await self.visible(session)).get(ident)
        if not recipe:
            raise HTTPException(403, "This workflow is not available to your account.")
        return recipe

    @staticmethod
    def public(recipe):
        options = recipe.get("options") or {}
        pool = options.get("loras") or {}
        steps = options.get("steps") or {}
        default_steps = recipe["workflow"].get(steps.get("node"), {}).get("inputs", {}).get(steps.get("key"), 8)
        return {"id": recipe["id"], "name": recipe["name"].replace("ComfyUI ", ""),
                "enhancer_model": recipe.get("enhancer_model", ""),
                "chat_model": recipe.get("chat_model", ""),
                "theme": recipe.get("theme", "custom"), "content_level": recipe.get("content_level", "general"),
                "opening": recipe.get("opening"),
                "description": recipe["description"], "size": options.get("size"),
                "steps": {**steps, "default": default_steps} if steps else None,
                "seed": bool(recipe.get("seed_inputs")), "needs_image": bool(recipe.get("image_inputs")),
                "loras": [{"id": row["id"], "label": row.get("label") or row["id"]} for row in pool.get("entries", [])],
                "max_loras": pool.get("max_count", 0)}

    async def save(self, session, recipe):
        """Publish generated tool source, preserving its existing access grants."""
        builder.validate_recipe(recipe)
        for example in (recipe.get("opening") or {}).get("examples", []):
            if not (self.settings.data / "opening-images" / (example["image"] + ".webp")).is_file():
                raise HTTPException(400, "Upload the postcard images in Manage Rabbit Hole before publishing.")
        if recipe.get("enhancer_model"):
            await self.gateway.require_model(session, recipe["enhancer_model"])
        if recipe.get("chat_model"):
            await self.gateway.require_model(session, recipe["chat_model"])
        async with self.lock:
            try:
                existing = await self.gateway.json(session, "GET", "/api/v1/tools/id/" + recipe["id"])
            except HTTPException as error:
                if error.status_code != 404:
                    raise
                existing = None
            exported = builder.build(recipe, self.settings.comfy)
            exported["access_grants"] = existing.get("access_grants", []) if existing else []
            exported["commit_message"] = "Update approved Rabbit Hole workflow options"
            path = self.settings.recipes / (recipe["id"] + ".recipe.json")
            pending = path.with_suffix(".pending")
            pending.write_text(json.dumps(recipe, indent=2, ensure_ascii=False), encoding="utf8")
            try:
                if path.exists():
                    import time
                    backup = self.settings.data / "recipe-backups"
                    backup.mkdir(exist_ok=True)
                    (backup / (recipe["id"]+"-"+str(time.time_ns())+".json")).write_bytes(path.read_bytes())
                endpoint = "/api/v1/tools/id/" + recipe["id"] + "/update" if existing else "/api/v1/tools/create"
                await self.gateway.json(session, "POST", endpoint, exported)
                pending.replace(path)
            finally:
                pending.unlink(missing_ok=True)
        return self.public(recipe)
