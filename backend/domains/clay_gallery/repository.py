"""Persistence for clay figures and their R2-backed asset metadata."""


def list_figures(connection):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT f.id, f.character_name, f.made_on::text AS made_on, f.description,
                      f.created_at, f.updated_at, (gf.figure_id IS NOT NULL) AS featured,
                      COALESCE(
                          jsonb_agg(
                              jsonb_build_object(
                                  'id', a.id,
                                  'asset_type', a.asset_type,
                                  'original_filename', a.original_filename,
                                  'content_type', a.content_type,
                                  'size_bytes', a.size_bytes,
                                  'caption', a.caption
                              ) ORDER BY a.id
                          ) FILTER (WHERE a.id IS NOT NULL),
                          '[]'::jsonb
                      ) AS assets
               FROM figures f
               LEFT JOIN assets a ON a.figure_id = f.id
               LEFT JOIN gallery_feature gf ON gf.figure_id = f.id
               GROUP BY f.id, gf.figure_id
               ORDER BY featured DESC, f.made_on DESC NULLS LAST, f.created_at DESC, f.id DESC""",
        )
        return cursor.fetchall()


def feature_figure(connection, figure_id, owner_id):
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO gallery_feature (singleton, figure_id)
               SELECT TRUE, id FROM figures WHERE id = %s AND owner_user_id = %s
               ON CONFLICT (singleton) DO UPDATE SET figure_id = EXCLUDED.figure_id
               RETURNING figure_id""",
            (figure_id, owner_id),
        )
        return cursor.fetchone()


def owned_figure_ids(connection, owner_id):
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM figures WHERE owner_user_id = %s", (owner_id,))
        return [row["id"] for row in cursor.fetchall()]


def insert_figure(connection, owner_id, details, assets):
    with connection.cursor() as cursor:
        cursor.execute(
            """INSERT INTO figures (owner_user_id, character_name, made_on, description)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (owner_id, *details),
        )
        figure_id = cursor.fetchone()["id"]
        cursor.executemany(
            """INSERT INTO assets (figure_id, asset_type, storage_key, original_filename,
                                    content_type, size_bytes)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [(figure_id, *asset) for asset in assets],
        )
        return figure_id


def find_display_asset(connection, figure_id, asset_type):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT id, storage_key, content_type, size_bytes FROM assets
               WHERE figure_id = %s AND asset_type = %s""",
            (figure_id, asset_type),
        )
        return cursor.fetchone()


def pending_web_asset(connection, threshold, excluded_ids):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT original.figure_id, COALESCE(web.storage_key, original.storage_key) AS storage_key,
                      COALESCE(web.size_bytes, original.size_bytes) AS size_bytes,
                      (original.size_bytes > %s AND web.id IS NULL) AS needs_model,
                      (card.id IS NULL AND poster.id IS NULL) AS needs_card
               FROM assets original
               LEFT JOIN assets web ON web.figure_id = original.figure_id AND web.asset_type = 'web_model'
               LEFT JOIN assets card ON card.figure_id = original.figure_id AND card.asset_type = 'model_thumbnail'
               LEFT JOIN assets poster ON poster.figure_id = original.figure_id AND poster.asset_type = 'gallery_poster'
               WHERE original.asset_type = 'display_model' AND NOT (original.figure_id = ANY(%s))
                 AND ((original.size_bytes > %s AND web.id IS NULL) OR (card.id IS NULL AND poster.id IS NULL))
               ORDER BY original.id
               LIMIT 1""",
            (threshold, excluded_ids, threshold),
        )
        return cursor.fetchone()


def lock_upload(connection, upload_id, owner_id, final_key):
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (upload_id,))
        cursor.execute(
            """SELECT f.id FROM figures f JOIN assets a ON a.figure_id = f.id
               WHERE f.owner_user_id = %s AND a.storage_key = %s""",
            (owner_id, final_key),
        )
        return cursor.fetchone()


def add_model_thumbnail(connection, figure_id, owner_id, asset):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT id FROM figures WHERE id = %s AND owner_user_id = %s FOR UPDATE""",
            (figure_id, owner_id),
        )
        if not cursor.fetchone():
            return None
        cursor.execute(
            """INSERT INTO assets (figure_id, asset_type, storage_key, original_filename, content_type, size_bytes)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (figure_id, asset_type) DO NOTHING RETURNING id""",
            (figure_id, *asset),
        )
        return cursor.fetchone() is not None


def add_web_derivatives(connection, figure_id, assets):
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM figures WHERE id = %s FOR UPDATE", (figure_id,))
        if not cursor.fetchone():
            return []
        inserted = []
        for asset in assets:
            cursor.execute(
                """INSERT INTO assets (figure_id, asset_type, storage_key, original_filename,
                                       content_type, size_bytes)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (figure_id, asset_type) DO NOTHING RETURNING asset_type""",
                (figure_id, *asset),
            )
            row = cursor.fetchone()
            if row:
                inserted.append(row["asset_type"])
        return inserted


def update_figure(connection, figure_id, owner_id, details, poster):
    with connection.cursor() as cursor:
        cursor.execute(
            """UPDATE figures SET character_name = %s, made_on = %s, description = %s, updated_at = NOW()
               WHERE id = %s AND owner_user_id = %s RETURNING id""",
            (*details, figure_id, owner_id),
        )
        if not cursor.fetchone():
            return False, None
        if not poster:
            return True, None
        cursor.execute(
            "SELECT storage_key FROM assets WHERE figure_id = %s AND asset_type = 'gallery_poster'",
            (figure_id,),
        )
        previous = cursor.fetchone()
        cursor.execute(
            """INSERT INTO assets (figure_id, asset_type, storage_key, original_filename, content_type, size_bytes)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (figure_id, asset_type) DO UPDATE SET storage_key = EXCLUDED.storage_key,
                   original_filename = EXCLUDED.original_filename, content_type = EXCLUDED.content_type,
                   size_bytes = EXCLUDED.size_bytes""",
            (figure_id, *poster),
        )
        return True, previous["storage_key"] if previous else None
