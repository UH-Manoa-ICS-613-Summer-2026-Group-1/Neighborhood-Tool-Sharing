import uuid

from app.models.reservation import ReservationStatus
from app.models.review import Review


# US 25 Scenario 1: Successful review
def test_successful_review_submission_borrower(
    db_session, client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that borrower can submit a review.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Review created
    assert response.status_code == 201
    # API returns the created review object
    review = response.json()

    assert review["reservation_id"] == str(seed_reservation.id)
    assert review["rating"] == 5
    assert review["comment"] == "This tool was great!"


# US 25 Scenario 1: Successful review
def test_successful_review_submission_owner(
    db_session, client, seed_user, seed_reservation, get_auth_headers
):
    """
    Tests that owner can submit a review.
    """
    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    payload = {
        "rating": 5,
        "comment": "Return was on time!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Review created
    assert response.status_code == 201
    # API returns the created review object
    review = response.json()

    assert review["reservation_id"] == str(seed_reservation.id)
    assert review["rating"] == 5
    assert review["comment"] == "Return was on time!"


# US 25 Scenario 1: Successful review
def test_successful_review_submission(
    db_session, client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that both borrower and owner can submit a review.
    """
    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Review created
    assert response.status_code == 201
    # API returns the created review object
    review = response.json()

    assert review["reservation_id"] == str(seed_reservation.id)
    assert review["rating"] == 5
    assert review["comment"] == "This tool was great!"

    # seed_user is the owner
    headers = get_auth_headers(seed_user.id)

    payload = {
        "rating": 4,
        "comment": "Return was on time!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Review created
    assert response.status_code == 201
    # API returns the created review object
    review = response.json()

    assert review["reservation_id"] == str(seed_reservation.id)
    assert review["rating"] == 4
    assert review["comment"] == "Return was on time!"


# US 25 Scenario 2: Missing rating
def test_missing_rating(
    db_session, client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that user cannot submit a review without a rating.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    # Missing rating
    payload = {
        "comment": "This tool was great!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Pydantic error
    assert response.status_code == 422


# US 25 Scenario 3: Incomplete reservation
def test_incomplete_reservation(
    db_session, client, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that user cannot submit a review for an incomplete reservation.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }

    # List of reservation statuses that are not RETURNED
    not_allowed_reservation_statuses = [
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
        ReservationStatus.PICKED_UP,
        ReservationStatus.DENIED,
        ReservationStatus.CANCELED,
    ]
    for status in not_allowed_reservation_statuses:
        # Set the reservation status
        seed_reservation.status = status
        db_session.commit()

        # Submit review
        response = client.post(
            f"/api/reservations/{str(seed_reservation.id)}/reviews",
            headers=headers,
            json=payload,
        )

        db_session.refresh(seed_reservation)
        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Reviews can only be submitted for completed reservations."
        )


# US 25 Scenario 4: Duplicate reviews
def test_duplicate_reviews(
    db_session, client, seed_user, seed_user2, seed_reservation, get_auth_headers
):
    """
    Tests that user cannot submit a review for already reviewed reservation.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    # Create a review
    review = Review(
        reservation_id=seed_reservation.id,
        rating=5,
        comment="This tool was great!",
        reviewer_id=seed_user2.id,
        reviewee_id=seed_user.id,
    )
    db_session.add(review)
    db_session.commit()

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    # Submit a duplicate review
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        headers=headers,
        json=payload,
    )

    # Duplicate review
    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "You have already submitted a review for this reservation."
    )


def test_review_not_existing_reservation(client, seed_user2, get_auth_headers):
    """
    Tests that user cannot submit a review for not existing reservation.
    """
    # seed_user2 is the borrower
    headers = get_auth_headers(seed_user2.id)

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    # Submit a review
    response = client.post(
        f"/api/reservations/{str(uuid.uuid4())}/reviews",
        headers=headers,
        json=payload,
    )

    # Reservation not found
    assert response.status_code == 404
    assert response.json()["detail"] == "Reservation not found."


def test_review_not_logged_in(db_session, client, seed_reservation):
    """
    Tests that user cannot submit a review without being logged in.
    """
    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        json=payload,
    )

    # Unauthorized
    assert response.status_code == 401


def test_third_party_review(
    db_session, client, seed_user3, seed_reservation, get_auth_headers
):
    # seed_user3 is not borrower or owner
    headers = get_auth_headers(seed_user3.id)

    # Set the reservation status to returned that the reservation becomes complete
    seed_reservation.status = ReservationStatus.RETURNED
    db_session.commit()

    payload = {
        "rating": 5,
        "comment": "This tool was great!",
    }
    response = client.post(
        f"/api/reservations/{str(seed_reservation.id)}/reviews",
        json=payload,
        headers=headers,
    )

    # Forbidden
    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "You are not authorized to review a reservation you were not a party to."
    )
