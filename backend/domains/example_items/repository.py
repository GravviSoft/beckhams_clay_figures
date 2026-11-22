"""SQL for `example_items` in the configured schema.

Every statement is scoped by `user_id`, so another account's item is
indistinguishable from a missing item.
"""

COLUMNS = "id, title, completed, created_at, updated_at"


def list_items(connection, user_id):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {COLUMNS} FROM example_items WHERE user_id = %s ORDER BY id", (user_id,))
        return cursor.fetchall()


def insert_item(connection, user_id, title):
    with connection.cursor() as cursor:
        cursor.execute(
            f"INSERT INTO example_items (user_id, title) VALUES (%s, %s) RETURNING {COLUMNS}",
            (user_id, title),
        )
        return cursor.fetchone()


def update_item(connection, user_id, item_id, title, completed):
    with connection.cursor() as cursor:
        cursor.execute(
            f"""UPDATE example_items
                SET title = COALESCE(%s, title), completed = COALESCE(%s, completed), updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING {COLUMNS}""",
            (title, completed, item_id, user_id),
        )
        return cursor.fetchone()


def delete_item(connection, user_id, item_id):
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM example_items WHERE id = %s AND user_id = %s RETURNING id", (item_id, user_id))
        return cursor.fetchone()
