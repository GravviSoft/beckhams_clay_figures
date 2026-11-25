"""WebAuthn enrollment and authentication for existing user accounts."""

import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import jwt
from flask import current_app
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)
from werkzeug.security import check_password_hash

from core.database import transaction
from core.errors import ConflictError, DomainError, ValidationError

from . import passkey_repository as repository

TIMEOUT_MS = 60000


def relying_party(origin):
    if not origin or origin not in current_app.config["CORS_ORIGINS"]:
        raise ValidationError("Passkeys are unavailable on this site address.")
    parsed = urlsplit(origin)
    host = parsed.hostname
    if not host or not (parsed.scheme == "https" or (
        parsed.scheme == "http" and (host == "localhost" or host.endswith(".localhost"))
    )):
        raise ValidationError("Passkeys require HTTPS or a local development hostname.")
    return host


def challenge_response(options, origin, purpose, user_id=0):
    public_key = json.loads(options_to_json(options))
    now = datetime.now(timezone.utc)
    token = jwt.encode({
        "aud": f"web-authn:{purpose}",
        "challenge": public_key["challenge"],
        "origin": origin,
        "actor": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=3),
    }, current_app.config["SECRET_KEY"], algorithm="HS256")
    return {"public_key": public_key, "challenge_token": token}


def verification_inputs(payload, origin, purpose, user_id=0):
    rp_id = relying_party(origin)
    credential = payload.get("credential")
    token = payload.get("challenge_token")
    if not isinstance(credential, dict) or not isinstance(token, str):
        raise ValidationError("Start the passkey prompt again.")
    try:
        claims = jwt.decode(
            token, current_app.config["SECRET_KEY"], algorithms=["HS256"],
            audience=f"web-authn:{purpose}", options={"require": ["exp", "iat", "challenge", "origin", "actor"]},
        )
    except jwt.InvalidTokenError as error:
        raise ValidationError("The passkey prompt expired. Try again.") from error
    if claims["origin"] != origin or claims["actor"] != user_id:
        raise ValidationError("Start a new passkey prompt on this account and site.")
    return credential, claims, {
        "expected_challenge": base64url_to_bytes(claims["challenge"]),
        "expected_origin": origin,
        "expected_rp_id": rp_id,
        "require_user_verification": True,
    }


def enrollment_options(get_db, origin, user_id, password):
    rp_id = relying_party(origin)
    with transaction(get_db) as connection:
        account = repository.account_for_enrollment(connection, user_id)
        if not account or not isinstance(password, str) or not check_password_hash(account["password_hash"], password):
            raise DomainError("The current password is incorrect.", status=403, code="wrong_password")
        existing = repository.credentials_for_user(connection, user_id, rp_id)
    options = generate_registration_options(
        rp_id=rp_id, rp_name="Beck's Clay Figures",
        user_id=str(user_id).encode(), user_name=account["email"], timeout=TIMEOUT_MS,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=key) for key in existing],
    )
    return challenge_response(options, origin, "enroll", user_id)


def finish_enrollment(get_db, origin, user_id, payload):
    credential, claims, expected = verification_inputs(payload, origin, "enroll", user_id)
    try:
        result = verify_registration_response(credential=credential, **expected)
    except (WebAuthnException, ValueError, TypeError) as error:
        raise ValidationError("This passkey could not be added. Try again.") from error
    with transaction(get_db) as connection:
        if not repository.consume_challenge(connection, claims["challenge"], claims["exp"]):
            raise ValidationError("The passkey prompt has already ended. Try again.")
        if not repository.store_credential(connection, user_id, expected["expected_rp_id"], result):
            raise ConflictError("This passkey is already registered.")


def login_options(origin):
    options = generate_authentication_options(
        rp_id=relying_party(origin), timeout=TIMEOUT_MS,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    return challenge_response(options, origin, "login")


def finish_login(get_db, origin, payload):
    credential, claims, expected = verification_inputs(payload, origin, "login")
    invalid = ValidationError("Could not sign in with that passkey. Try again or use your password.")
    try:
        credential_id = base64url_to_bytes(credential["rawId"])
        user_handle = credential["response"].get("userHandle")
    except (AttributeError, KeyError, ValueError, TypeError) as error:
        raise invalid from error
    with transaction(get_db) as connection:
        record = repository.locked_credential(connection, credential_id, expected["expected_rp_id"])
        if not record:
            raise invalid
        try:
            if user_handle is not None and base64url_to_bytes(user_handle) != str(record["id"]).encode():
                raise invalid
            result = verify_authentication_response(
                credential=credential, credential_public_key=bytes(record["public_key"]),
                credential_current_sign_count=record["sign_count"], **expected,
            )
        except (WebAuthnException, ValueError, TypeError) as error:
            raise invalid from error
        if not repository.consume_challenge(connection, claims["challenge"], claims["exp"]):
            raise invalid
        repository.set_sign_count(connection, credential_id, result.new_sign_count)
        return {key: record[key] for key in ("id", "email", "created_at")}
