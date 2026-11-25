"""Passkey credentials and replay protection for the identity domain."""


def account_for_enrollment(connection, user_id):
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, email, password_hash FROM users WHERE id = %s", (user_id,))
        return cursor.fetchone()


def credentials_for_user(connection, user_id, rp_id):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT credential_id FROM identity_passkeys WHERE user_id = %s AND rp_id = %s",
            (user_id, rp_id),
        )
        return [bytes(row["credential_id"]) for row in cursor.fetchall()]


def store_credential(connection, user_id, rp_id, result):
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO identity_passkeys (credential_id, user_id, rp_id, public_key, sign_count)
               VALUES (%s, %s, %s, %s, %s) ON CONFLICT (credential_id) DO NOTHING
               RETURNING credential_id""",
            (result.credential_id, user_id, rp_id, result.credential_public_key, result.sign_count),
        )
        return cursor.fetchone() is not None


def consume_challenge(connection, challenge_id, expires_at):
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM identity_passkey_uses WHERE expires_at <= NOW()")
        cursor.execute(
            """INSERT INTO identity_passkey_uses (challenge_id, expires_at)
               SELECT %s, to_timestamp(%s) WHERE to_timestamp(%s) > NOW()
               ON CONFLICT (challenge_id) DO NOTHING RETURNING challenge_id""",
            (challenge_id, expires_at, expires_at),
        )
        return cursor.fetchone() is not None


def locked_credential(connection, credential_id, rp_id):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT p.public_key, p.sign_count, u.id, u.email, u.created_at
               FROM identity_passkeys p JOIN users u ON u.id = p.user_id
               WHERE p.credential_id = %s AND p.rp_id = %s FOR UPDATE OF p""",
            (credential_id, rp_id),
        )
        return cursor.fetchone()


def set_sign_count(connection, credential_id, sign_count):
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE identity_passkeys SET sign_count = %s WHERE credential_id = %s",
            (sign_count, credential_id),
        )
