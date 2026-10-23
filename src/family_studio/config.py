import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Settings:
    openwebui: str = os.getenv("STUDIO_OPENWEBUI", "http://127.0.0.1:3000")
    public_openwebui: str = os.getenv("STUDIO_OPENWEBUI_PUBLIC", "http://127.0.0.1:3000")
    comfy: str = os.getenv("STUDIO_COMFYUI", "http://127.0.0.1:8188")
    data: Path = Path(os.getenv("STUDIO_DATA", str(ROOT / ".runtime/family-studio")))
    frontend: Path = ROOT / "web/family-studio/dist"
    recipes: Path = Path(os.getenv("STUDIO_RECIPES", str(ROOT / "integrations/comfyui/workflows")))
    secure_cookie: bool = os.getenv("STUDIO_SECURE_COOKIE", "0") == "1"
    preview: bool = os.getenv("STUDIO_PREVIEW", "1") == "1"

    def __post_init__(self):
        for url in (self.openwebui, self.comfy):
            if not url.startswith(("http://", "https://")):
                raise ValueError("Upstream URLs must use HTTP or HTTPS")
        self.data.mkdir(parents=True, exist_ok=True)
