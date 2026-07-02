"""
Invitation routers.
Handles sending, validating, and retrieving invitations.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invitation import Invitation, InvitationHistory, InvitationStatus
from app.models.user import User
from app.schemas.common import DetailError, MessageResponse
from app.schemas.invitation import (
    InvitationCreateRequest,
    InvitationResponse,
    InvitationValidateResponse,
)
from app.utils.dependencies import get_current_user
from app.utils.email import send_invitation_email
from app.utils.token_generator import generate_token

router = APIRouter(prefix="/api/invitations", tags=["Invitations"])


def get_valid_invite(token: str, db: Session) -> Invitation:
    """
    Validates an invitation token against all business rules.
    Returns the Invitation record if valid, otherwise raises an HTTPException.
    """
    # Find the invite by token
    invite = db.query(Invitation).filter(Invitation.invitation_token == token).first()

    # Validate the invite exists
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This invitation link is invalid or does not exist. Please request a new invitation.",
        )

    # Validate invite token not used
    if invite.status == InvitationStatus.USED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation link has already been used.",
        )

    # Validate invite token not revoked
    if invite.status == InvitationStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation link has been revoked. Please contact support.",
        )

    # Validate invite token not expired
    if invite.status == InvitationStatus.EXPIRED or (
        datetime.now(timezone.utc) > invite.expires_at.replace(tzinfo=timezone.utc)
    ):
        invite.status = (
            InvitationStatus.EXPIRED
        )  # in case the status was not updated yet
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation link has expired. Please request a new invitation.",
        )

    return invite


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": DetailError},
        401: {"model": DetailError},
        403: {"model": DetailError},
    },
)
def send_invitation(
    invitation_data: InvitationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create an invite link and send it to an unregistered user.
    """
    recipient_email = invitation_data.recipient_email

    # If the user account already exists, raise an exeption
    existing_user = db.query(User).filter(User.email == recipient_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"The email address {recipient_email} is already associated with an account."
            ),
        )

    # If the invitation already pending, raise an exeption
    pending_invite = (
        db.query(Invitation)
        .filter(
            Invitation.recipient_email == recipient_email,
            Invitation.status == InvitationStatus.PENDING,
        )
        .first()
    )
    if pending_invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"An invitation has already been sent to the email address {recipient_email}."
            ),
        )

    # Generate invitation token and store in db
    invite_token = generate_token()
    new_invite = Invitation(
        invitation_token=invite_token,
        sender_id=current_user.id,
        recipient_email=recipient_email,
        status=InvitationStatus.PENDING,
    )

    db.add(new_invite)
    # Try to send the email, if it fails, rollback the db transaction and raise an error
    try:
        # It sends the invitation links to your console; the email service will be implemented later
        # To see console output, run: `docker compose logs -f`
        send_invitation_email(recipient_email, invite_token)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send invitation email. Please try again later.\nError: {str(e)}.",
        )
    db.commit()

    return MessageResponse(
        message=(f"Invitation to {recipient_email} sent successfully.")
    )


@router.get(
    "/validate",
    response_model=InvitationValidateResponse,
    responses={400: {"model": DetailError}, 404: {"model": DetailError}},
)
def validate_invitation(token: str, db: Session = Depends(get_db)):
    """
    Check if an invite link is valid and not expired.
    """

    # Validate the invite token
    invite = get_valid_invite(token, db)

    # Return the recipient email
    return InvitationValidateResponse(recipient_email=invite.recipient_email)


@router.get(
    "",
    response_model=list[InvitationResponse],
    responses={401: {"model": DetailError}, 403: {"model": DetailError}},
)
def get_invitation_history(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Retrieves historical list of all invites sent by the logged-in user.
    """

    # Query the view invitation_history_v to get the invitations sent by the current user
    invites = (
        db.query(InvitationHistory)
        .filter(InvitationHistory.sender_id == current_user.id)
        .all()
    )
    return invites
