from datetime import timedelta

from app.models.reservation import ReservationStatus
from app.models.tool import Tool, ToolStatus
from app.models.user import UserStatus
from app.schemas.reservation import APP_TIMEZONE
from app.utils.seeder import run_tools_seeds, run_users_seeds
from sqlalchemy.orm import Session

from tests.conftest import get_auth_headers


# US 19 Scenario 1: Successful adding a new tool
def test_add_tool_success(client, db_session: Session, seed_user):
    """
    Test that a user can successfully add a new tool.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")
    payload = {
        "title": "DeWalt Cordless Drill",
        "description": "20V max brushless compact drill driver.",
        "condition": "GOOD",
        "tool_type_code": "POWER_TOOLS",
        "pickup_notes": "Pick up from front porch container.",
        "return_notes": "Please clean before return.",
        "loan_duration_limit": 7,
        "photo_urls": ["https://images.unsplash.com/photo-1504148455328-c376907d081c"],
    }
    response = client.post("/api/tools", headers=headers, json=payload)
    assert response.status_code == 201

    # Verify tool is saved in database and available for listing
    tool = response.json()
    assert tool["title"] == "DeWalt Cordless Drill"
    assert tool["status"] == ToolStatus.AVAILABLE


# US 19 Scenario 2: Missing required fields
def test_add_tool_missing_required_fields(client, seed_user):
    """
    Test that a user cannot add a tool with missing required fields.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Payload missing 'title' and 'condition'
    incomplete_payload = {
        "description": "Just a tool with missing properties.",
        "tool_type_code": "POWER_TOOLS",
        "loan_duration_limit": 5,
        "photo_urls": ["https://example.com/photo.jpg"],
    }

    response = client.post("/api/tools", headers=headers, json=incomplete_payload)
    assert response.status_code == 422


# US 19 Scenario 3: Invalid text fields
def test_add_tool_invalid_text_fields(client, seed_user):
    """
    Test that a user cannot add a tool with invalid text fields.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    payload = {
        "title": "",  # Empty titles are invalid
        "description": "Valid description",
        "condition": "GOOD",
        "tool_type_code": "POWER_TOOLS",
        "loan_duration_limit": 7,
        "photo_urls": ["https://example.com/photo.jpg"],
    }

    response = client.post("/api/tools", headers=headers, json=payload)
    assert response.status_code == 422


# US 19 Scenario 4: Uploading invalid file
def test_upload_media_invalid_file_format(client, seed_user):
    """
    Test that the system blocks generation of an upload ticket
    for insecure or invalid file extensions.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # The payload targeting MediaUploadRequest schema
    payload = {"filename": "malicious_file.exe"}

    # Hit the upload endpoint
    response = client.post("/api/media/upload", headers=headers, json=payload)

    # 400 code for invalid file
    assert response.status_code == 400

    # Verify the exact error message matches
    assert (
        response.json()["detail"]
        == "Invalid image format. Supported: jpg, jpeg, png, webp."
    )


# US 19 Scenario 5: Not logged in
def test_add_tool_not_logged_in(client):
    """
    Test that not logged in users cannot add a tool.
    """
    payload = {
        "title": "Anonymous Hammer",
        "description": "Some context provided.",
        "condition": "FAIR",
        "tool_type_code": "POWER_TOOLS",
        "loan_duration_limit": 7,
        "photo_urls": ["https://example.com/photo.jpg"],
    }

    response = client.post("/api/tools", json=payload)  # Missing auth headers
    assert response.status_code == 401


# US 19 Scenario 6: Suspended user
def test_add_tool_suspended_user(client, db_session: Session, seed_user):
    """
    Test that a suspended user cannot add a tool.
    """
    # Log in to get a valid token while user is active
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Simulate an admin suspending the user (will be a route later)
    suspended_status = (
        db_session.query(UserStatus).filter(UserStatus.code == "SUSPENDED").first()
    )
    seed_user.status = suspended_status
    db_session.commit()

    # Valid payload
    payload = {
        "title": "Drill",
        "description": "Asset description.",
        "condition": "GOOD",
        "tool_type_code": "POWER_TOOLS",
        "loan_duration_limit": 4,
        "photo_urls": ["https://example.com/photo.jpg"],
    }

    # Suspended user try to add a tool
    response = client.post("/api/tools", headers=headers, json=payload)
    assert response.status_code == 403  # Forbidden access operation
    assert (
        response.json()["detail"]
        == "Your account has been suspended. Please contact support."
    )


# US 6 Scenario 1 and 3: View tool details (including lending rules)
def test_view_tool_details(client, seed_user, seed_tool):
    """
    Test that a user can view a tool's details
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    response = client.get(f"/api/tools/{seed_tool.id}", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["tool_title"] == "Stihl Grass Eater"
    assert data["tool_description"] == "Gas trimmer engine edger."
    assert data["tool_loan_duration_limit"] == 3
    assert data["tool_pickup_notes"] == "Meet by garage."
    assert data["tool_return_notes"] == "Clean grass off guards."
    assert len(data["tool_photos"]) == 1


# US 6 Scenario 2: View availability information
def test_view_tool_availability(db_session, client, seed_user3, seed_reservation):
    """
    Tests that tool availability endpoint returns correct list of blocked dates.
    """
    headers = get_auth_headers(client, "someemail3@mail.com", "Correctpassword123!")

    # Set the reservation status to approved that the reservation becomes active
    seed_reservation.status = ReservationStatus.APPROVED
    db_session.commit()

    # The endpoint returns a list of blocked dates for active reservations
    response = client.get(
        f"/api/tools/{seed_reservation.tool_id}/availability", headers=headers
    )

    # seed_reservation is the reservation for two days (today and tomorrow)
    assert response.status_code == 200
    blocked_dates = response.json()

    # The tool has a reservation for two days
    assert len(blocked_dates) == 2

    # The days are today (start_date) and tomorrow (end_date)
    # Get UTC start date -> convert to local time zone -> grab isoformat date
    assert blocked_dates[0] == (
        seed_reservation.start_date.astimezone(APP_TIMEZONE).date().isoformat()
    )
    assert (
        blocked_dates[1]
        == seed_reservation.end_date.astimezone(APP_TIMEZONE).date().isoformat()
    )


# US 6 Scenario 4: View tool listing not exist
def test_view_tool_listing_not_found(client, seed_user):
    """
    Test that a user got a 404 error when view a tool that does not exist.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Query an invalid non-existent UUID string
    missing_uuid = "e0000000-0000-0000-0000-000000000999"
    response = client.get(f"/api/tools/{missing_uuid}", headers=headers)

    assert response.status_code == 404


# US 21 Scenario 1: Successful search
def test_search_tools_by_keyword_and_category(client, seed_user, seed_tool):
    """criteria extraction"""
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Search by keyword match ("grass")
    # The title of the tool contains "Grass"; the search should work in case-insensitive manner
    keyword_response = client.get("/api/tools?keyword=grass", headers=headers)
    assert keyword_response.status_code == 200
    assert len(keyword_response.json()) >= 1
    assert any("Grass" in tool["tool_title"] for tool in keyword_response.json())

    # Search by Category mapping ("GARDENING")
    category_response = client.get("/api/tools?category=GARDENING", headers=headers)
    assert category_response.status_code == 200
    assert len(category_response.json()) >= 1


# US 21 Scenario 2: Unavailable tools (hidden/suspended/deleted status values filtered out)
def test_search_filters_out_unavailable_tools(client, db_session: Session, seed_user):
    """
    Test that a user cannot view unavailable tools when browsing tools.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    # Seed some users for testing to create some tools
    run_users_seeds(db_session)

    # Seed tools. Include 1 deleted, 1 suspended, and 1 hidden tools. Also include 6 available tools.
    # e0000000-0000-0000-0000-000000000009 deleted tool
    # e0000000-0000-0000-0000-000000000007 suspended tool
    # e0000000-0000-0000-0000-000000000003 hidden tool
    # e0000000-0000-0000-0000-000000000008 one of the available tools
    run_tools_seeds(db_session)

    # The user searches for tools. 'is_mine=true' means show only the user's tools.
    # 'is_mine=false' means show all tools that are available.
    response = client.get("/api/tools?is_mine=false", headers=headers)

    assert response.status_code == 200

    tools = response.json()
    # The response should not contain any deleted, suspended, or hidden tools.
    assert len(tools) == 6

    # The response should contain one of the available tools.
    assert any(
        tool["tool_id"] == "e0000000-0000-0000-0000-000000000008" for tool in tools
    )

    # Ensure that e0000000-0000-0000-0000-000000000007 is suspended
    suspended_tool = db_session.get(Tool, "e0000000-0000-0000-0000-000000000007")
    assert suspended_tool
    assert suspended_tool.status == ToolStatus.SUSPENDED

    # The response should not contain any deleted, suspended, or hidden tools.
    assert not any(
        tool["tool_id"] == "e0000000-0000-0000-0000-000000000009" for tool in tools
    )
    assert not any(
        tool["tool_id"] == "e0000000-0000-0000-0000-000000000007" for tool in tools
    )
    assert not any(
        tool["tool_id"] == "e0000000-0000-0000-0000-000000000003" for tool in tools
    )


# US 21 Scenario 3: No results
def test_search_no_results_found(client, seed_user):
    """
    When there is no result found, return an empty list.
    The message "No results found." should will be handled in frontend.
    """
    headers = get_auth_headers(client, "someemail@mail.com", "Correctpassword123!")

    response = client.get(
        "/api/tools?keyword=UnobtainableSpaceshipTool", headers=headers
    )

    # No resulsts is the success code
    assert response.status_code == 200
    # return an empty list
    assert response.json() == []
