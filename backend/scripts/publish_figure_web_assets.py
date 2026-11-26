"""Attach a verified web GLB and thumbnail to an existing saved figure."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from werkzeug.datastructures import FileStorage

from app import app
from core.database import get_db, transaction
from domains.clay_gallery import repository, service, storage


def publish(figure_id, source_md5, web_model, thumbnail):
    with transaction(get_db) as connection:
        original = repository.find_display_asset(connection, figure_id, "display_model")
    if not original:
        raise ValueError("This figure has no saved original GLB.")
    client, bucket = storage.bucket_client()
    source = client.head_object(Bucket=bucket, Key=original["storage_key"])
    if source["ETag"].strip('"').lower() != source_md5.lower():
        raise ValueError("The source checksum does not match the saved model.")

    with web_model.open("rb") as model_stream, thumbnail.open("rb") as image_stream:
        model, _ = service.read_asset(FileStorage(model_stream, filename=web_model.name), "web_model")
        image, _ = service.read_asset(FileStorage(image_stream, filename=thumbnail.name), "model_thumbnail")
        if model[4] >= original["size_bytes"]:
            raise ValueError("The web model must be smaller than the saved original.")
        with transaction(get_db) as connection:
            inserted = repository.add_web_derivatives(connection, figure_id, [model, image])
            for asset, stream in ((model, model_stream), (image, image_stream)):
                if asset[0] not in inserted:
                    continue
                _, key, _, content_type, size = asset
                client.put_object(Bucket=bucket, Key=key, Body=stream, ContentType=content_type, ContentLength=size)
                if client.head_object(Bucket=bucket, Key=key)["ContentLength"] != size:
                    raise RuntimeError(f"{asset[0]} upload verification failed.")
    return inserted


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("figure_id", type=int)
    parser.add_argument("source_md5")
    parser.add_argument("web_model", type=Path)
    parser.add_argument("thumbnail", type=Path)
    args = parser.parse_args()
    with app.app_context():
        print("Published:", ", ".join(publish(
            args.figure_id, args.source_md5, args.web_model, args.thumbnail,
        )) or "already present")
