"""Authorize one staged browser upload and publish it after verifying storage."""

import struct
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from botocore.exceptions import BotoCoreError, ClientError
from flask import current_app

from core.database import transaction
from core.errors import ValidationError

from . import repository, service, storage

MODEL_TYPE = "model/gltf-binary"
UPLOAD_SECONDS = 900
AUDIENCE = "clay-gallery-upload"


def start_upload(owner_id, payload):
    filename = payload.get("filename")
    size = payload.get("size")
    if not isinstance(filename, str) or not filename.lower().endswith(".glb"):
        raise ValidationError("Choose a valid GLB file.")
    limit = service.model_upload_limit()
    if type(size) is not int or not 20 <= size <= limit:
        raise ValidationError(f"Choose a GLB within the configured {limit // (1024 * 1024)} MB upload limit.")
    upload_id = uuid4().hex
    now = datetime.now(timezone.utc)
    token = jwt.encode({
        "jti": upload_id, "aud": AUDIENCE, "actor": owner_id, "name": filename[:255], "bytes": size,
        "iat": now, "exp": now + timedelta(seconds=UPLOAD_SECONDS * 2),
    }, current_app.config["SECRET_KEY"], algorithm="HS256")
    try:
        client, bucket = storage.bucket_client()
        url = client.generate_presigned_url("put_object", Params={
            "Bucket": bucket, "Key": f"staging/{upload_id}.glb", "ContentType": MODEL_TYPE,
            "ContentLength": size,
        }, ExpiresIn=UPLOAD_SECONDS)
    except (BotoCoreError, ClientError) as error:
        raise storage.unavailable() from error
    return {"url": url, "upload_token": token}


def finish_upload(get_db, owner_id, payload):
    token = payload.get("upload_token")
    if not isinstance(token, str):
        raise ValidationError("Start the upload again.")
    try:
        claims = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"],
                            audience=AUDIENCE, options={"require": ["exp", "jti", "actor", "name", "bytes"]})
    except jwt.InvalidTokenError as error:
        raise ValidationError("The upload link expired. Choose the file again.") from error
    if claims["actor"] != owner_id:
        raise ValidationError("Start a new upload for this account.")
    details = service.figure_details(payload)
    upload_id = claims["jti"]
    staging_key, final_key = f"staging/{upload_id}.glb", f"figures/{upload_id}.glb"
    size = claims["bytes"]
    try:
        with transaction(get_db) as connection:
            existing = repository.lock_upload(connection, upload_id, owner_id, final_key)
            if existing:
                return existing["id"]
            client, bucket = storage.bucket_client()
            info = client.head_object(Bucket=bucket, Key=staging_key)
            if info["ContentLength"] != size or info["ContentType"] != MODEL_TYPE:
                raise ValidationError("The uploaded file does not match the selected GLB.")
            body = client.get_object(Bucket=bucket, Key=staging_key, Range="bytes=0-11", IfMatch=info["ETag"])["Body"]
            try:
                if body.read(12) != struct.pack("<4sII", b"glTF", 2, size):
                    raise ValidationError("Choose a valid GLB 2.0 file.")
            finally:
                body.close()
            client.copy_object(Bucket=bucket, Key=final_key, CopySource={"Bucket": bucket, "Key": staging_key},
                               CopySourceIfMatch=info["ETag"])
            figure_id = repository.insert_figure(connection, owner_id, details, [
                ("display_model", final_key, claims["name"], MODEL_TYPE, size),
            ])
    except ClientError as error:
        if error.response["ResponseMetadata"]["HTTPStatusCode"] in (404, 412):
            raise ValidationError("The staged upload is missing or changed. Upload the file again.") from error
        raise storage.unavailable() from error
    except BotoCoreError as error:
        raise storage.unavailable() from error
    try:
        client.delete_object(Bucket=bucket, Key=staging_key)
    except (BotoCoreError, ClientError):
        current_app.logger.warning("Could not remove a finalized upload's staging object.")
    return figure_id
