from core.errors import ValidationError

MIN_PASSWORD_LENGTH = 8
MAX_EMAIL_LENGTH = 320


def credentials(body):
    """Normalize untrusted sign-in/registration input."""

    body = body if isinstance(body, dict) else {}
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    if not email or "@" not in email or len(email) > MAX_EMAIL_LENGTH:
        raise ValidationError("A valid email address is required.")
    return email, password


def new_password(password):
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    return password
