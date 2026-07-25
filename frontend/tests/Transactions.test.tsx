// tests/Transactions.test.tsx
// Vitest tests for the Transactions component
//
// User stories tested:
//   US 3: Cancel button shown for REQUESTED/APPROVED, hidden otherwise
//   US 4: Approve/Deny buttons shown to owner for REQUESTED only
//   US 5: Confirm Return shown to owner for PICKED_UP only
//   US 7: Confirm Pickup shown to borrower for APPROVED only
//   US 9 & 10: Shows reservations for both owner and borrower roles
//   Reviews: state-aware review control on RETURNED reservations

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import Transactions from "../src/pages/Reservations/Transactions";
import * as reservationsApi from "../src/api/reservations";
import * as usersApi from "../src/api/users";
import * as reviewApi from "../src/api/review";
import type { ReservationDetails } from "../src/api/reservations";
import type { UserProfile } from "../src/api/users";
import type { ReviewDetails } from "../src/api/review";

// Mock navigate
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Current user fixture
const currentUser: UserProfile = {
  user_id: "user-1",
  user_first_name: "Jane",
  user_last_name: "Doe",
  user_middle_name: null,
  user_email: "jane@example.com",
  user_bio: null,
  user_location: null,
  user_created_at: "2026-01-01T00:00:00Z",
  user_photo_url: null,
  role_code: "MEMBER",
  role_name: "Member",
  role_description: null,
  status_code: "ACTIVE",
  status_name: "Active",
  status_description: null,
};

// Helper to create a reservation fixture
const makeReservation = (
  overrides: Partial<ReservationDetails> = {}
): ReservationDetails => ({
  reservation_id: "res-1",
  reservation_status: "REQUESTED",
  reservation_start_date: "2026-07-22T00:00:00Z",
  reservation_end_date: "2026-07-23T23:59:59Z",
  reservation_loan_duration_limit: 7,
  reservation_pickup_notes: null,
  reservation_return_notes: null,
  reservation_created_at: "2026-07-21T00:00:00Z",
  tool_id: "tool-1",
  tool_title: "DeWalt Drill",
  tool_description: "Great drill.",
  tool_condition: "GOOD",
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  borrower_id: "user-2",
  borrower_first_name: "John",
  borrower_last_name: "Smith",
  borrower_middle_name: null,
  owner_id: "user-1",       // current user is the owner by default
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_photos: [],
  ...overrides,
});

// Helper to create a review fixture.
// By default the reviewer is the OTHER party (user-2), i.e. a review the
// current user has RECEIVED ("theirs"). Set reviewer_id: "user-1" for a
// review the current user WROTE ("mine").
const makeReview = (overrides: Partial<ReviewDetails> = {}): ReviewDetails => ({
  review_id: "rev-1",
  reservation_id: "res-1",
  reviewer_id: "user-2",
  reviewee_id: "user-1",
  reviewer_first_name: "John",
  reviewer_last_name: "Smith",
  reviewer_middle_name: null,
  reviewer_photo_url: null,
  reviewee_first_name: "Jane",
  reviewee_last_name: "Doe",
  reviewee_middle_name: null,
  reviewee_photo_url: null,
  rating: 4,
  comment: "Great borrower",
  created_at: "2026-07-24T00:00:00Z",
  ...overrides,
});

function renderTransactions() {
  return render(
    <MemoryRouter>
      <Transactions />
    </MemoryRouter>,
  );
}

describe("Transactions", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(currentUser);
    // Default: no reviews. Keeps RETURNED cards from hitting a real fetch.
    vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([]);
  });

  // Verify loading state
  it("shows the loading state while fetching", () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockImplementation(
      () => new Promise(() => {}),
    );
    renderTransactions();
    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
  });

  // Verify empty state when no reservations
  it("shows the empty state when there are no reservations", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
    renderTransactions();
    expect(
      await screen.findByText(/no transactions yet/i),
    ).toBeInTheDocument();
  });

  // Verify empty state Browse Tools button navigates correctly
  it("navigates to neighborhood tab when Browse Tools is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
    renderTransactions();
    await screen.findByText(/no transactions yet/i);
    await user.click(screen.getByRole("button", { name: /browse tools/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard?tab=neighborhood");
  });

  // US 9: Owner sees reservation with tool name and borrower name
  it("renders a reservation card with tool name and borrower info for owner", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation(),
    ]);
    renderTransactions();
    expect(await screen.findByText(/dewalt drill/i)).toBeInTheDocument();
    expect(screen.getByText(/requested by john smith/i)).toBeInTheDocument();
    // Owner sees the "Incoming" direction label (scoped to the badge span so
    // it doesn't match the "Incoming (on my tools)" filter option).
    expect(screen.getByText("Incoming", { selector: "span" })).toBeInTheDocument();
  });

  // US 10: Borrower sees reservation with owner name
  it("renders a reservation card with owner info for borrower", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ owner_id: "user-2", borrower_id: "user-1" }),
    ]);
    renderTransactions();
    expect(await screen.findByText(/owned by jane doe/i)).toBeInTheDocument();
    // Borrower sees the "Outgoing" direction label (scoped to the badge span).
    expect(screen.getByText("Outgoing", { selector: "span" })).toBeInTheDocument();
  });

  // US 4 Scenario 1 & 2: Owner sees Approve and Deny for REQUESTED
  it("shows Approve and Deny buttons to owner for REQUESTED reservation", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "REQUESTED" }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deny/i })).toBeInTheDocument();
  });

  // US 4 Scenario 3 & 4: Non-owner does NOT see Approve/Deny
  it("does not show Approve or Deny to borrower", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ owner_id: "user-2", borrower_id: "user-1" }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deny/i })).not.toBeInTheDocument();
  });

  // US 5: Owner sees Confirm Return for PICKED_UP
  it("shows Confirm Return to owner for PICKED_UP reservation", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "PICKED_UP" }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(
      screen.getByRole("button", { name: /confirm return/i }),
    ).toBeInTheDocument();
  });

  // US 7: Borrower sees Confirm Pickup for APPROVED
  it("shows Confirm Pickup to borrower for APPROVED reservation", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({
        reservation_status: "APPROVED",
        owner_id: "user-2",
        borrower_id: "user-1",
      }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(
      screen.getByRole("button", { name: /confirm pickup/i }),
    ).toBeInTheDocument();
  });

  // US 3: Cancel shown for REQUESTED and APPROVED, hidden for others
  it("shows Cancel for REQUESTED reservations", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "REQUESTED" }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not show Cancel for RETURNED reservations", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "RETURNED" }),
    ]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
  });

  // Verify approve action updates status locally without refetching
  it("updates the status to APPROVED locally when Approve is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "REQUESTED" }),
    ]);
    vi.spyOn(reservationsApi, "approveReservation").mockResolvedValue(
      makeReservation({ reservation_status: "APPROVED" }),
    );
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => {
      expect(screen.getByText("APPROVED", { selector: "span" })).toBeInTheDocument();
    });
  });

  // Verify error shown when action fails
  it("shows an error message when an action fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "REQUESTED" }),
    ]);
    vi.spyOn(reservationsApi, "approveReservation").mockRejectedValue(
      new Error("Cannot approve at this time."),
    );
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(
      await screen.findByText(/cannot approve at this time/i),
    ).toBeInTheDocument();
  });

  // Verify the load error path.
  it("shows an error when reservations fail to load", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockRejectedValue(
      new Error("Failed to load reservations."),
    );
    renderTransactions();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load reservations/i,
    );
  });

  // Verify the tool name links to the tool detail page.
  it("navigates to the tool detail page when the tool name is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation(),
    ]);
    renderTransactions();
    await user.click(await screen.findByRole("button", { name: /dewalt drill/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/tool-1");
  });

  // US 4 Scenario 2: Deny updates the status locally.
  it("updates the status to DENIED when Deny is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "REQUESTED" }),
    ]);
    vi.spyOn(reservationsApi, "denyReservation").mockResolvedValue(
      makeReservation({ reservation_status: "DENIED" }),
    );
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    await user.click(screen.getByRole("button", { name: /deny/i }));
    expect(await screen.findByText("DENIED", { selector: "span" })).toBeInTheDocument();
  });

  // US 7 Scenario 1: Borrower confirms pickup on an APPROVED reservation.
  it("updates the status to PICKED_UP when Confirm Pickup is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({
        reservation_status: "APPROVED",
        owner_id: "user-2",
        borrower_id: "user-1",
      }),
    ]);
    vi.spyOn(reservationsApi, "pickupReservation").mockResolvedValue(
      makeReservation({ reservation_status: "PICKED_UP" }),
    );
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    await user.click(screen.getByRole("button", { name: /confirm pickup/i }));
    expect(await screen.findByText("PICKED_UP", { selector: "span" })).toBeInTheDocument();
  });

  // US 5 Scenario 1: Owner confirms return on a PICKED_UP reservation.
  it("updates the status to RETURNED when Confirm Return is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_status: "PICKED_UP" }),
    ]);
    vi.spyOn(reservationsApi, "returnReservation").mockResolvedValue(
      makeReservation({ reservation_status: "RETURNED" }),
    );
    renderTransactions();
    await screen.findByText(/dewalt drill/i);
    await user.click(screen.getByRole("button", { name: /confirm return/i }));
    expect(await screen.findByText("RETURNED", { selector: "span" })).toBeInTheDocument();
  });

  // US 3: Cancel updates only the clicked reservation and leaves siblings alone.
  it("cancels only the clicked reservation", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ reservation_id: "res-1", tool_title: "DeWalt Drill" }),
      makeReservation({ reservation_id: "res-2", tool_title: "Circular Saw" }),
    ]);
    vi.spyOn(reservationsApi, "cancelReservation").mockResolvedValue(
      makeReservation({ reservation_status: "CANCELED" }),
    );
    renderTransactions();
    await screen.findByText(/circular saw/i);

    await user.click(screen.getAllByRole("button", { name: /cancel/i })[0]);

    expect(await screen.findByText("CANCELED", { selector: "span" })).toBeInTheDocument();
    // The second card is untouched.
    expect(screen.getByText("REQUESTED", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/circular saw/i)).toBeInTheDocument();
  });

  // Pagination appears once a full page is returned (PAGE_SIZE is 10).
  it("pages forward and back through reservations", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(reservationsApi, "fetchReservations")
      .mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeReservation({ reservation_id: `res-${i}`, tool_title: `Tool ${i}` }),
        ),
      );
    renderTransactions();
    await screen.findByText("Tool 0");

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 10 }),
      );
    });
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0 }),
      );
    });
  });

  // Filters are applied server-side. Selecting a status resets to the first
  // page and passes the status through to the API. Selected by VALUE so a
  // future label rename won't break this.
  it("applies the status filter and resets to the first page", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(reservationsApi, "fetchReservations")
      .mockResolvedValue([makeReservation({ reservation_status: "RETURNED" })]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);

    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "RETURNED",
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "RETURNED", offset: 0 }),
      );
    });
  });

  // Selecting a role passes the mapped role param through to the API.
  it("applies the role filter", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(reservationsApi, "fetchReservations")
      .mockResolvedValue([makeReservation()]);
    renderTransactions();
    await screen.findByText(/dewalt drill/i);

    await user.selectOptions(
      screen.getByLabelText(/filter by role/i),
      "owner",
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: "owner", offset: 0 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Reviews on RETURNED reservations — the four states of the review control
  // -------------------------------------------------------------------------
  describe("reviews on RETURNED reservations", () => {
    const returned: Partial<ReservationDetails> = { reservation_status: "RETURNED" };

    // Neither party reviewed -> gold "Make a Review", no pills.
    it("shows 'Make a Review' when neither party has reviewed", async () => {
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      // fetchReservationReviews defaults to [] from beforeEach
      renderTransactions();
      expect(
        await screen.findByRole("button", { name: /make a review/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/review sent/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/from john/i)).not.toBeInTheDocument();
    });

    // You reviewed, they didn't -> "View Reviews" + "Review sent" + "Awaiting their review".
    it("shows 'Review sent' and 'Awaiting their review' after you review", async () => {
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
        makeReview({ reviewer_id: "user-1" }), // current user wrote it -> "mine"
      ]);
      renderTransactions();
      expect(
        await screen.findByRole("button", { name: /view reviews/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/review sent/i)).toBeInTheDocument();
      expect(screen.getByText(/awaiting their review/i)).toBeInTheDocument();
    });

    // They reviewed you, you haven't -> gold "Make a Review" + "★ 4/5 from John".
    it("shows the rating received when the other party reviewed you", async () => {
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
        makeReview({ reviewer_id: "user-2", rating: 4 }), // other party -> "theirs"
      ]);
      renderTransactions();
      expect(await screen.findByText(/4\/5 from john/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /make a review/i }),
      ).toBeInTheDocument();
    });

    // Both reviewed -> "View Reviews" + "Review sent" + "★" pill, and NO "Awaiting".
    it("shows both pills when both parties have reviewed", async () => {
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
        makeReview({ review_id: "rev-a", reviewer_id: "user-1" }), // mine
        makeReview({ review_id: "rev-b", reviewer_id: "user-2" }), // theirs
      ]);
      renderTransactions();
      expect(await screen.findByText(/review sent/i)).toBeInTheDocument();
      expect(screen.getByText(/4\/5 from john/i)).toBeInTheDocument();
      expect(screen.queryByText(/awaiting their review/i)).not.toBeInTheDocument();
    });

    // The catch fallback: fetching reviews rejects -> the button still renders.
    it("still renders the review button when fetching reviews fails", async () => {
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      vi.spyOn(reviewApi, "fetchReservationReviews").mockRejectedValue(
        new Error("boom"),
      );
      renderTransactions();
      expect(
        await screen.findByRole("button", { name: /make a review/i }),
      ).toBeInTheDocument();
    });

    // Navigation to the review page from the review button.
    it("navigates to the review page when the review button is clicked", async () => {
      const user = userEvent.setup();
      vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
        makeReservation(returned),
      ]);
      renderTransactions();
      await user.click(
        await screen.findByRole("button", { name: /make a review/i }),
      );
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/res-1/review");
    });
  });
});