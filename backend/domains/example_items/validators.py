from core.errors import ValidationError

MAX_TITLE_LENGTH = 200


def title(value, *, required=True):
    if value is None and not required:
        return None
    text = str(value or "").strip()
    if not text:
        raise ValidationError("Title is required.")
    if len(text) > MAX_TITLE_LENGTH:
        raise ValidationError(f"Title must be {MAX_TITLE_LENGTH} characters or fewer.")
    return text


def completed(value):
    if value is None:
        return None
    if not isinstance(value, bool):
        raise ValidationError("Completed must be true or false.")
    return value


def item_update(body):
    body = body if isinstance(body, dict) else {}
    changes = {
        "title": title(body.get("title"), required=False),
        "completed": completed(body.get("completed")),
    }
    if changes["title"] is None and changes["completed"] is None:
        raise ValidationError("Provide a title or completed value to update.")
    return changes
