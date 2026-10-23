import io
import asyncio
import re
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, JSONResponse

from .auth import require_admin


class OpeningImages:
    """Curated world illustrations, accessible only through an authorized hole."""

    def __init__(self, settings, auth, catalog):
        self.root = settings.data / "opening-images"
        self.root.mkdir(exist_ok=True)
        self.auth, self.catalog = auth, catalog

    def path(self, ident):
        if not re.fullmatch(r"[a-f0-9]{32}", ident):
            raise HTTPException(404, "Example image not found")
        path = self.root / (ident + ".webp")
        if not path.is_file():
            raise HTTPException(404, "Example image not found")
        return path

    async def upload(self, request):
        session = await self.auth.require(request)
        require_admin(session)
        data = bytearray()
        async for part in request.stream():
            data.extend(part)
            if len(data) > 8 * 1024 * 1024:
                raise HTTPException(413, "Choose an example image under 8 MB")
        ident = uuid.uuid4().hex
        try:
            await asyncio.to_thread(self.save_image, bytes(data), ident)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
            raise HTTPException(400, "Choose a valid PNG, JPEG or WebP image under 16 megapixels") from error
        return JSONResponse({"image": ident})

    def save_image(self, data, ident):
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"PNG", "JPEG", "WEBP"} or image.width * image.height > 16_000_000:
                raise ValueError("Unsupported image")
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1536, 1536))
            image.save(self.root / (ident + ".webp"), "WEBP", quality=88)

    async def admin_image(self, request):
        session = await self.auth.require(request)
        require_admin(session)
        return FileResponse(self.path(request.path_params["image"]), media_type="image/webp")

    async def image(self, request):
        session = await self.auth.require(request)
        recipe = await self.catalog.require(session, request.path_params["id"])
        ident = request.path_params["image"]
        if not any(row["image"] == ident for row in (recipe.get("opening") or {}).get("examples", [])):
            raise HTTPException(404, "This example is not part of this hole")
        return FileResponse(self.path(ident), media_type="image/webp")
