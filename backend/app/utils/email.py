"""
Module for creating invitation and reset password links and sending them via email.
"""

import os

from dotenv import load_dotenv

load_dotenv()

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")


# Just mock and send the link to the console; the email service will be implemented later
def send_invitation_email(recipient_email, invite_token):
    invitation_link = f"{FRONTEND_BASE_URL}/register?token={invite_token}"

    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Invitation link generated for {recipient_email}.")
    print(f"URL: {invitation_link}")
    print("=" * 20 + "\n")


def send_reset_password_email(recipient_email, reset_token):
    reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={reset_token}"

    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Reset link generated for {recipient_email}.")
    print(f"URL: {reset_link}")
    print("=" * 20 + "\n")
