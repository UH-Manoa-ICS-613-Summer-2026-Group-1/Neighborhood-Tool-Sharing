"""
Module for creating invitation and reset password links and sending them via email.
"""

import os

from dotenv import load_dotenv

load_dotenv()

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")


# Just mock and send the link to the console; the email service will be implemented later
def send_invitation_email(recipient_email, invite_token):
    invitation_link = f"{FRONTEND_BASE_URL}?token={invite_token}"

    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Invitation link generated for {recipient_email}.")
    print(f"URL: {invitation_link}")
    print("=" * 20 + "\n")
