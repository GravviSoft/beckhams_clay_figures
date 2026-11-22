"""SQL for the canonical `users` identity record in the configured schema."""

PUBLIC_COLUMNS = "id, email, created_at"


def insert_user(connection, email, password_hash):
    """Return the new user, or ``None`` when the email is already registered."""

    with connection.cursor() as cursor:
        cursor.execute(
            f"""INSERT INTO users (email, password_hash) VALUES (%s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING {PUBLIC_COLUMNS}""",
            (email, password_hash),
        )
        return cursor.fetchone()


def find_user_with_password(connection, email):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {PUBLIC_COLUMNS}, password_hash FROM users WHERE email = %s", (email,))
        return cursor.fetchone()


def find_user(connection, user_id):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {PUBLIC_COLUMNS} FROM users WHERE id = %s", (user_id,))
        return cursor.fetchone()
