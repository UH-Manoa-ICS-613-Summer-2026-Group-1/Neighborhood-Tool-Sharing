"""
Token generator for creating secure invitation and reset password tokens.
"""

import secrets


def generate_token() -> str:
    return secrets.token_urlsafe(16)
