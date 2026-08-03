"""
Module for creating invitation and reset password links and sending them via email.
"""

import os

import resend
from dotenv import load_dotenv

load_dotenv()

sender_env = os.getenv("SENDER_EMAIL", "").strip()
SENDER_EMAIL = sender_env if sender_env != "" else "onboarding@resend.dev"

resend_api_key_env = os.getenv("RESEND_API_KEY", "").strip()
RESEND_API_KEY = resend_api_key_env if resend_api_key_env != "" else None

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")


def send_invitation_email(recipient_email, invite_token):

    invitation_link = f"{FRONTEND_BASE_URL}/register?token={invite_token}"

    # Stil send a link to console
    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Invitation link generated for {recipient_email}.")
    print(f"URL: {invitation_link}")
    print("=" * 20 + "\n")

    if RESEND_API_KEY:
        params: resend.Emails.SendParams = {
            "from": SENDER_EMAIL,
            "to": recipient_email,
            "subject": "You're Invited!",
            "html": f"""
                <h3>Registration Invitation</h3>
                <p>Hi {recipient_email},</p>
                <p>You've been invited to join our platform Neighborhood Tool Sharing</p>
                <p>Click the link below to register new account:</p>
                <p>Click <a href='{invitation_link}'>here</a> to complete registration.</p>
            """,
        }
        try:
            email: resend.Emails.SendResponse = resend.Emails.send(params)
            print(f"Email sent successfully! Message ID: {email['id']}")
            return email
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            # Do not raise error, since there will be no domain for email sending
            # raise e


def send_reset_password_email(recipient_email, reset_token):
    reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={reset_token}"

    # Stil send a link to console
    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Reset link generated for {recipient_email}.")
    print(f"URL: {reset_link}")
    print("=" * 20 + "\n")

    if RESEND_API_KEY:
        params: resend.Emails.SendParams = {
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
        try:
            email: resend.Emails.SendResponse = resend.Emails.send(params)
            print(f"Reset link sent successfully! Message ID: {email['id']}")
            return email
        except Exception as e:
            print(f"Failed to send reset email: {str(e)}")
            # Do not raise error, since there will be no domain for email sending
            # raise e
