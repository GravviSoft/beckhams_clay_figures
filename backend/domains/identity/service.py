"""Identity business rules and transaction boundaries."""

from werkzeug.security import check_password_hash, generate_password_hash

from core.database import transaction
from core.errors import ConflictError, DomainError, NotFoundError

from . import repository


class InvalidCredentialsError(DomainError):
    status = 401
    code = "invalid_credentials"


def register(get_db, email, password):
    with transaction(get_db) as connection:
        user = repository.insert_user(connection, email, generate_password_hash(password))
    if not user:
        raise ConflictError("An account with this email already exists.")
    return user


def authenticate(get_db, email, password):
    with transaction(get_db) as connection:
        user = repository.find_user_with_password(connection, email)
    if not user or not check_password_hash(user["password_hash"], password):
        raise InvalidCredentialsError("Email or password is incorrect.")
    return {key: value for key, value in user.items() if key != "password_hash"}


def current_user(get_db, user_id):
    with transaction(get_db) as connection:
        user = repository.find_user(connection, user_id)
    if not user:
        raise NotFoundError("User not found.")
    return user
