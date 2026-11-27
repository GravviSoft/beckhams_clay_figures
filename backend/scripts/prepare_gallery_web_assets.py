"""Run one background gallery worker per database schema."""

import argparse
import logging
import sys
from pathlib import Path
from time import monotonic, sleep

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
from core.database import get_db, transaction
from domains.clay_gallery import repository, web_assets


def run(once=False):
    retry_after = {}
    while True:
        try:
            retry_after = {key: due for key, due in retry_after.items() if due > monotonic()}
            with transaction(get_db) as connection:
                candidate = repository.pending_web_asset(
                    connection, web_assets.WEB_MODEL_THRESHOLD, list(retry_after),
                )
            if candidate:
                figure_id = candidate["figure_id"]
                retry_after[figure_id] = monotonic() + 900
                published = web_assets.prepare_figure(get_db, candidate)
                logging.info("Figure %s: published %s", figure_id, ", ".join(published) or "no new derivatives")
        except Exception as error:
            # SDK and subprocess errors can include storage paths or URL details.
            logging.error("Gallery asset processing failed (%s)", type(error).__name__)
            if once:
                return 1
        if once:
            return 0
        sleep(10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with app.app_context():
        raise SystemExit(run(args.once))
