"""
Module for creating invitation and reset password links and sending them via email.
"""

import os

import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_EMAIL_API_KEY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
SENDER_EMAIL = "onboarding@resend.dev"


def send_invitation_email(recipient_email, invite_token):

    invitation_link = f"{FRONTEND_BASE_URL}/register?token={invite_token}"

    # Stil send a link to console
    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Invitation link generated for {recipient_email}.")
    print(f"URL: {invitation_link}")
    print("=" * 20 + "\n")

    if RESEND_API_KEY:
        try:
            email = resend.Emails.send(
                {
                    "from": SENDER_EMAIL,
                    "to": recipient_email,
                    "subject": "You're Invited!",
                    "html": f"""
            <h3>Welcome aboard!</h3>
            <p>You have been invited to join the platform.</p>
            <p><a href="{invitation_link}">Click here to complete registration</a></p>
        """,
                }
            )
            print(f"Email sent successfully! Message ID: {email['id']}")
            return email
        except Exception as e:
            print(f"Failed to send email: {e}")
            raise e


def send_reset_password_email(recipient_email, reset_token):
    reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={reset_token}"

    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Reset link generated for {recipient_email}.")
    print(f"URL: {reset_link}")
    print("=" * 20 + "\n")

    if RESEND_API_KEY:
        try:
            email = resend.Emails.send(
                {
                    "from": SENDER_EMAIL,
                    "to": recipient_email,
                    "subject": "Reset Your Password",
                    "html": f"""
                <h3>Password Reset Request</h3>
                <p>Click the link below to reset your password:</p>
                <p><a href="{reset_link}">Reset Password</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            """,
                }
            )
            print(f"Reset link sent successfully! Message ID: {email['id']}")
            return email
        except Exception as e:
            print(f"Failed to send reset email: {e}")
            raise e
