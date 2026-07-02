"""
Module for creating invitation and reset password links and sending them via email.
"""


# Just mock and send the link to the console; the email service will be implemented later
def send_invitation_email(recipient_email, invite_token):
    frontend_base_url = "http://localhost:5173/register"
    invitation_link = f"{frontend_base_url}?token={invite_token}"

    print("\n" + "=" * 20)
    print(f"DEVELOPMENT MODE: Invitation link generated for {recipient_email}.")
    print(f"URL: {invitation_link}")
    print("=" * 20 + "\n")
