"""Example-item business rules and transaction boundaries."""

from core.database import transaction
from core.errors import NotFoundError

from . import repository


def list_items(get_db, user_id):
    with transaction(get_db) as connection:
        return repository.list_items(connection, user_id)


def create_item(get_db, user_id, title):
    with transaction(get_db) as connection:
        return repository.insert_item(connection, user_id, title)


def update_item(get_db, user_id, item_id, changes):
    with transaction(get_db) as connection:
        item = repository.update_item(connection, user_id, item_id, changes["title"], changes["completed"])
    if not item:
        raise NotFoundError("Item not found.")
    return item


def delete_item(get_db, user_id, item_id):
    with transaction(get_db) as connection:
        deleted = repository.delete_item(connection, user_id, item_id)
    if not deleted:
        raise NotFoundError("Item not found.")
