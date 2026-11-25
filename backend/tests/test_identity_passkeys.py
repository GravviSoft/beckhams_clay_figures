import base64
import hashlib
import json
import struct

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from werkzeug.security import generate_password_hash

from domains.identity import passkey_repository as repository


ORIGIN = "http://test.localhost"
ROOT = "/api/auth/passkeys"
PASSWORD = "a test account password"


def b64(data):
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def test_passkey_options_require_trusted_origin_and_password(client, auth_headers, monkeypatch):
    monkeypatch.setattr(repository, "account_for_enrollment", lambda *_: {
        "id": 7, "email": "maker@example.test", "password_hash": generate_password_hash(PASSWORD),
    })
    assert client.post(f"{ROOT}/login/options", headers={"Origin": "https://other.test"}).status_code == 400
    assert client.post(f"{ROOT}/enroll/options", json={"password": PASSWORD}, headers={"Origin": ORIGIN}).status_code == 401
    assert client.post(f"{ROOT}/enroll/options", json={"password": "wrong"},
                       headers={**auth_headers, "Origin": ORIGIN}).status_code == 403


def test_passkey_enrollment_login_and_replay(client, auth_headers, monkeypatch):
    records = {}
    used = set()

    def store(_, user_id, rp_id, result):
        assert user_id == 7 and rp_id == "test.localhost"
        records[result.credential_id] = {
            "id": 7, "email": "maker@example.test", "created_at": None,
            "public_key": result.credential_public_key, "sign_count": result.sign_count,
        }
        return True

    def consume(_, challenge, __):
        if challenge in used:
            return False
        used.add(challenge)
        return True

    monkeypatch.setattr(repository, "account_for_enrollment", lambda *_: {
        "id": 7, "email": "maker@example.test", "password_hash": generate_password_hash(PASSWORD),
    })
    monkeypatch.setattr(repository, "credentials_for_user", lambda *_: [])
    monkeypatch.setattr(repository, "store_credential", store)
    monkeypatch.setattr(repository, "consume_challenge", consume)
    monkeypatch.setattr(repository, "locked_credential", lambda _, credential, rp: records.get(credential))
    monkeypatch.setattr(repository, "set_sign_count", lambda *_: None)

    private_key = ec.generate_private_key(ec.SECP256R1())
    points = private_key.public_key().public_numbers()
    cose = cbor2.dumps({1: 2, 3: -7, -1: 1, -2: points.x.to_bytes(32, "big"), -3: points.y.to_bytes(32, "big")})
    credential_id = b"test-credential-id"
    rp_hash = hashlib.sha256(b"test.localhost").digest()

    def payload(options, ceremony, extra):
        client_data = json.dumps({
            "type": ceremony, "challenge": options["public_key"]["challenge"], "origin": ORIGIN,
        }).encode()
        return {
            "challenge_token": options["challenge_token"],
            "credential": {
                "type": "public-key", "id": b64(credential_id), "rawId": b64(credential_id),
                "response": {"clientDataJSON": b64(client_data), **extra(client_data)},
            },
        }

    headers = {**auth_headers, "Origin": ORIGIN}
    enroll = client.post(f"{ROOT}/enroll/options", headers=headers, json={"password": PASSWORD}).get_json()
    assert enroll["public_key"]["authenticatorSelection"]["residentKey"] == "required"
    attestation_data = rp_hash + b"\x45" + bytes(20) + struct.pack(">H", len(credential_id)) + credential_id + cose
    registration = payload(enroll, "webauthn.create", lambda _: {
        "attestationObject": b64(cbor2.dumps({"fmt": "none", "authData": attestation_data, "attStmt": {}})),
    })
    assert client.post(f"{ROOT}/enroll/verify", headers=headers, json=registration).status_code == 204
    assert client.post(f"{ROOT}/enroll/verify", headers=headers, json=registration).status_code == 400

    login = client.post(f"{ROOT}/login/options", headers={"Origin": ORIGIN}).get_json()
    assert login["public_key"]["userVerification"] == "required"
    assertion_data = rp_hash + b"\x05" + bytes(4)
    assertion = payload(login, "webauthn.get", lambda client_data: {
        "authenticatorData": b64(assertion_data), "userHandle": b64(b"7"),
        "signature": b64(private_key.sign(assertion_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))),
    })
    assert client.post(f"{ROOT}/login/verify", headers={"Origin": "https://other.test"}, json=assertion).status_code == 400
    response = client.post(f"{ROOT}/login/verify", headers={"Origin": ORIGIN}, json=assertion)
    assert response.status_code == 200
    assert response.get_json()["user"]["id"] == 7
    assert response.get_json()["token"]
    assert client.post(f"{ROOT}/login/verify", headers={"Origin": ORIGIN}, json=assertion).status_code == 400
