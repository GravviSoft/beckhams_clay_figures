"""Private R2 object access for the clay gallery."""

import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from core.errors import DomainError


def unavailable():
    return DomainError("Figure storage is unavailable. Please try again later.",
                       status=503, code="storage_unavailable")


def bucket_client():
    account, key, secret, bucket = (
        os.getenv(name) for name in
        ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    )
    if not all((account, key, secret, bucket)):
        raise unavailable()
    client = boto3.client(
        "s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        region_name=os.getenv("R2_REGION") or "auto",
        aws_access_key_id=key, aws_secret_access_key=secret,
    )
    return client, bucket


def open_asset(key):
    try:
        client, bucket = bucket_client()
        return client.get_object(Bucket=bucket, Key=key)["Body"]
    except (BotoCoreError, ClientError) as error:
        raise unavailable() from error


def signed_model_url(key):
    try:
        client, bucket = bucket_client()
        return client.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=300,
        )
    except (BotoCoreError, ClientError) as error:
        raise unavailable() from error
