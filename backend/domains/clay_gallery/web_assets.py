"""Build browser-ready derivatives outside the upload request."""

import json
import logging
import os
import struct
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

WEB_MODEL_THRESHOLD = 4 * 1024 * 1024
TARGET_TRIANGLES = 100_000
RENDER_SCRIPT = Path(__file__).with_name("render_web_assets.py")


def embedded_model_metadata(source):
    with source.open("rb") as stream:
        magic, version, total, length, kind = struct.unpack("<4sIIII", stream.read(20))
        if (magic != b"glTF" or version != 2 or total != source.stat().st_size
                or kind != 0x4E4F534A or length > total - 20):
            raise ValueError("Invalid GLB metadata.")
        model = json.loads(stream.read(length))
    for asset in (*model.get("buffers", []), *model.get("images", [])):
        uri = asset.get("uri")
        if uri is not None and (not isinstance(uri, str) or not uri.startswith("data:")):
            raise ValueError("Gallery derivatives require a self-contained GLB.")
    return model


def triangle_count(model):
    accessors = model["accessors"]
    return sum(
        accessors[primitive.get("indices", primitive["attributes"]["POSITION"])]["count"] // 3
        for mesh in model["meshes"] for primitive in mesh["primitives"]
        if primitive.get("mode", 4) == 4
    )


def build_derivatives(source, output, *, optimize, render_card):
    metadata = embedded_model_metadata(source)
    model = None
    if optimize:
        candidate = output / "web.glb"
        ratio = min(1, TARGET_TRIANGLES / max(1, triangle_count(metadata)))
        try:
            subprocess.run([
                os.getenv("GLTFPACK_BIN", "gltfpack"), "-i", str(source), "-o", str(candidate),
                "-si", str(ratio), "-noq",
            ], check=True, timeout=300)
            if candidate.stat().st_size < source.stat().st_size:
                model = candidate
        except (OSError, subprocess.SubprocessError):
            if not render_card:
                raise
            logging.warning("Model optimization failed; attempting the thumbnail.")
    card = None
    if render_card:
        try:
            subprocess.run([
                os.getenv("BLENDER_BIN", "blender"), "--factory-startup", "-b", "-t", "2",
                "--disable-autoexec", "--python-exit-code", "1", "--python", str(RENDER_SCRIPT),
                "--", str(model or source), str(output), "--card-only",
            ], check=True, timeout=180)
            card = output / "card.png"
        except (OSError, subprocess.SubprocessError):
            if model is None:
                raise
            logging.warning("Thumbnail rendering failed; retaining the optimized model.")
    return model, card


def prepare_figure(get_db, candidate):
    from werkzeug.datastructures import FileStorage

    from core.database import transaction
    from . import repository, service, storage

    client, bucket = storage.bucket_client()
    with TemporaryDirectory(prefix="clay-web-") as temporary:
        output = Path(temporary)
        original = output / "original.glb"
        body = storage.open_asset(candidate["storage_key"])
        try:
            with original.open("wb") as stream:
                for chunk in body.iter_chunks():
                    stream.write(chunk)
        finally:
            body.close()
        if original.stat().st_size != candidate["size_bytes"]:
            raise ValueError("The original model download was incomplete.")
        model, card = build_derivatives(
            original, output, optimize=candidate["needs_model"], render_card=candidate["needs_card"],
        )
        published = []
        for asset_type, path in (("web_model", model), ("model_thumbnail", card)):
            if path is None:
                continue
            with path.open("rb") as stream:
                asset, _ = service.read_asset(FileStorage(stream, filename=path.name), asset_type)
                with transaction(get_db) as connection:
                    inserted = repository.add_web_derivatives(connection, candidate["figure_id"], [asset])
                    if inserted:
                        key, content_type, size = asset[1], asset[3], asset[4]
                        client.put_object(Bucket=bucket, Key=key, Body=stream, ContentType=content_type,
                                          ContentLength=size)
                        published.extend(inserted)
        return published
