"""Clay-gallery business operations and transaction boundaries."""

import os
import struct
from datetime import date
from uuid import uuid4

from botocore.exceptions import BotoCoreError, ClientError
from flask import current_app

from core.database import transaction
from core.errors import DomainError, NotFoundError, ValidationError

from . import repository, storage

POSTER_LIMIT = 5 * 1024 * 1024


def model_upload_limit():
    limit_mb = int(os.getenv("CLAY_GALLERY_MODEL_MAX_MB") or "250")
    if not 1 <= limit_mb <= 1024:
        raise RuntimeError("CLAY_GALLERY_MODEL_MAX_MB must be between 1 and 1024.")
    return limit_mb * 1024 * 1024


def list_figures(get_db):
    with transaction(get_db) as connection:
        return repository.list_figures(connection)


def can_feature(user_id):
    return str(user_id) == os.getenv("CLAY_GALLERY_OWNER_USER_ID", "").strip()


def feature_figure(get_db, figure_id, owner_id):
    if not can_feature(owner_id):
        raise DomainError("This account cannot feature figures.", status=403, code="forbidden")
    with transaction(get_db) as connection:
        if not repository.feature_figure(connection, figure_id, owner_id):
            raise NotFoundError("Figure not found.")


def get_authoring(get_db, user_id):
    with transaction(get_db) as connection:
        return {
            "can_upload": True,
            "can_feature": can_feature(user_id),
            "editable_figure_ids": repository.owned_figure_ids(connection, user_id),
        }


def figure_details(form):
    name = form.get("character_name", "").strip()
    description = form.get("description", "").strip()
    if not 1 <= len(name) <= 150 or len(description) > 2000:
        raise ValidationError("Enter a name up to 150 characters and a description up to 2,000.")
    try:
        made_on = date.fromisoformat(form["made_on"]) if form.get("made_on") else None
    except ValueError as error:
        raise ValidationError("Enter a valid date made.") from error
    return name, made_on, description or None


def read_asset(file, asset_type):
    model = asset_type == "display_model"
    limit = model_upload_limit() if model else POSTER_LIMIT
    stream = file.stream
    size = stream.seek(0, os.SEEK_END)
    stream.seek(0)
    if not size:
        raise ValidationError("Choose a file that is not empty.")
    if size > limit:
        raise ValidationError(f"This file exceeds the configured {limit // (1024 * 1024)} MB upload limit.")
    header = stream.read(12)
    stream.seek(0)
    if model:
        if (size < 20 or not file.filename.lower().endswith(".glb")
                or header != struct.pack("<4sII", b"glTF", 2, size)):
            raise ValidationError("Choose a valid GLB 2.0 file.")
        content_type, extension = "model/gltf-binary", "glb"
    elif header.startswith(b"\x89PNG\r\n\x1a\n"):
        content_type, extension = "image/png", "png"
    elif header.startswith(b"\xff\xd8\xff"):
        content_type, extension = "image/jpeg", "jpg"
    else:
        raise ValidationError("Choose a PNG or JPEG for the gallery photo.")
    key = f"figures/{uuid4().hex}.{extension}"
    return (asset_type, key, file.filename[:255], content_type, size), stream


def create_figure(get_db, owner_id, form, files):
    details = figure_details(form)
    if not files.get("model"):
        raise ValidationError("Choose a GLB model.")
    uploads = [read_asset(files["model"], "display_model")]
    if files.get("poster"):
        uploads.append(read_asset(files["poster"], "gallery_poster"))
    client, bucket = storage.bucket_client()
    staged = []
    try:
        for asset, stream in uploads:
            key = asset[1]
            staged.append(key)
            client.put_object(Bucket=bucket, Key=key, Body=stream, ContentType=asset[3], ContentLength=asset[4])
        with transaction(get_db) as connection:
            return repository.insert_figure(connection, owner_id, details, [asset for asset, _ in uploads])
    except Exception as error:
        for key in staged:
            try:
                client.delete_object(Bucket=bucket, Key=key)
            except (BotoCoreError, ClientError):
                current_app.logger.warning("Could not clean up an incomplete gallery upload.")
        if isinstance(error, (BotoCoreError, ClientError)):
            raise storage.unavailable() from error
        raise


def display_asset(get_db, figure_id, asset_type):
    if asset_type not in {"display_model", "gallery_poster"}:
        raise NotFoundError("Figure asset not found.")
    with transaction(get_db) as connection:
        asset = repository.find_display_asset(connection, figure_id, asset_type)
    if not asset:
        raise NotFoundError("Figure asset not found.")
    return asset, storage.open_asset(asset["storage_key"])


def update_figure(get_db, figure_id, owner_id, form, files):
    details = figure_details(form)
    uploaded = read_asset(files["poster"], "gallery_poster") if files.get("poster") else None
    if uploaded:
        client, bucket = storage.bucket_client()
        poster, stream = uploaded
    else:
        poster = None
    try:
        with transaction(get_db) as connection:
            found, previous = repository.update_figure(connection, figure_id, owner_id, details, poster)
            if not found:
                raise NotFoundError("Figure not found.")
            if uploaded:
                client.put_object(Bucket=bucket, Key=poster[1], Body=stream, ContentType=poster[3], ContentLength=poster[4])
    except (BotoCoreError, ClientError) as error:
        raise storage.unavailable() from error
    if previous:
        try:
            client.delete_object(Bucket=bucket, Key=previous)
        except (BotoCoreError, ClientError):
            current_app.logger.warning("Could not clean up a replaced gallery photo.")
