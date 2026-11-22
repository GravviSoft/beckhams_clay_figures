"""Persistence for clay figures and their R2-backed asset metadata."""


def list_figures(connection, owner_user_id):
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT f.id, f.character_name, f.made_on, f.description,
                      f.created_at, f.updated_at,
                      COALESCE(
                          jsonb_agg(
                              jsonb_build_object(
                                  'id', a.id,
                                  'asset_type', a.asset_type,
                                  'storage_key', a.storage_key,
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
               WHERE f.owner_user_id = %s
               GROUP BY f.id
               ORDER BY f.made_on DESC NULLS LAST, f.created_at DESC""",
            (owner_user_id,),
        )
        return cursor.fetchall()
