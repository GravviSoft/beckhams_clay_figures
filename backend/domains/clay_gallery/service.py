"""Clay-gallery business operations and transaction boundaries."""

from core.database import transaction

from . import repository


def list_figures(get_db, owner_user_id):
    with transaction(get_db) as connection:
        return repository.list_figures(connection, owner_user_id)
