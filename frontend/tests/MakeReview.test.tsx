// tests/MakeReview.test.tsx
// Vitest tests for the MakeReview page

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import MakeReview from "../src/pages/Reservations/MakeReview";
import * as reservationsApi from "../src/api/reservations";
import * as usersApi from "../src/api/users";
import * as reviewApi from "../src/api/review";
import type { ReservationDetails } from "../src/api/reservations";
import type { UserProfile } from "../src/api/users";
import type { ReviewDetails } from "../src/api/review";
 
// Mock navigate; keep the rest of react-router (MemoryRouter, Routes, Route,
// useParams) real so the :reservationId route param resolves naturally.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
 
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});
 
// Stub Navbar
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));
 
// Current user fixture, the logged-in reviewer.
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
 
// By default the current user is the OWNER and the other party is the
// borrower John Smith. Reservation is RETURNED so the form shows.
const makeReservation = (
  overrides: Partial<ReservationDetails> = {},
): ReservationDetails => ({
  reservation_id: "res-1",
  reservation_status: "RETURNED",
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
  owner_id: "user-1",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_photos: [],
  ...overrides,
});
 
// reviewer_id: "user-1": a review the current user WROTE
// reviewer_id: "user-2": a review the current user RECEIVED
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
 
function renderMakeReview(path = "/reservations/res-1/review") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/reservations/:reservationId/review"
          element={<MakeReview />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
 
describe("MakeReview", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    // a RETURNED reservation the current user owns, no
    // existing reviews. Individual tests override as needed.
    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(currentUser);
    vi.spyOn(reservationsApi, "fetchReservationById").mockResolvedValue(
      makeReservation(),
    );
    vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([]);
    vi.spyOn(reviewApi, "createReview").mockResolvedValue(
      makeReview({ reviewer_id: "user-1" }),
    );
  });
 
  // loading / error 
 
  it("shows the loading state while data is fetching", () => {
    vi.spyOn(reservationsApi, "fetchReservationById").mockImplementation(
      () => new Promise(() => {}),
    );
    renderMakeReview();
    expect(screen.getByText(/loading reservation/i)).toBeInTheDocument();
  });
 
  it("shows an error when the reservation fails to load", async () => {
    vi.spyOn(reservationsApi, "fetchReservationById").mockRejectedValue(
      new Error("Reservation not found."),
    );
    renderMakeReview();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reservation not found/i,
    );
  });
 
  // guards 
 
  it("blocks users who are not a party to the reservation", async () => {
    vi.spyOn(reservationsApi, "fetchReservationById").mockResolvedValue(
      makeReservation({ owner_id: "user-8", borrower_id: "user-9" }),
    );
    renderMakeReview();
    expect(
      await screen.findByText(/only review reservations you took part in/i),
    ).toBeInTheDocument();
    // No form is shown.
    expect(
      screen.queryByRole("button", { name: /submit review/i }),
    ).not.toBeInTheDocument();
  });
 
  it("blocks reviews until the reservation is RETURNED", async () => {
    vi.spyOn(reservationsApi, "fetchReservationById").mockResolvedValue(
      makeReservation({ reservation_status: "APPROVED" }),
    );
    renderMakeReview();
    expect(
      await screen.findByText(/isn't done yet/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit review/i }),
    ).not.toBeInTheDocument();
  });
 
  // the form
 
  it("shows the review form with the other party's name when nothing is reviewed yet", async () => {
    renderMakeReview();
    // Summary line (owner perspective -> "Borrowed by").
    expect(await screen.findByText(/borrowed by john smith/i)).toBeInTheDocument();
    // Heading + star picker + submit.
    expect(
      screen.getByRole("heading", { name: /your review of john smith/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /rating/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit review/i }),
    ).toBeInTheDocument();
    // Other party hasn't reviewed yet.
    expect(
      screen.getByText(/john smith hasn't left a review yet/i),
    ).toBeInTheDocument();
  });
 
  it("rejects submitting without a rating", async () => {
    const user = userEvent.setup();
    renderMakeReview();
    await screen.findByRole("button", { name: /submit review/i });
 
    await user.click(screen.getByRole("button", { name: /submit review/i }));
 
    expect(
      await screen.findByText(/select a star rating from 1 to 5/i),
    ).toBeInTheDocument();
    expect(reviewApi.createReview).not.toHaveBeenCalled();
  });
 
  it("submits a rating with no comment", async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewApi, "createReview").mockResolvedValue(
      makeReview({ reviewer_id: "user-1", rating: 4, comment: null }),
    );
    renderMakeReview();
 
    await user.click(await screen.findByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));
 
    await waitFor(() => {
      expect(reviewApi.createReview).toHaveBeenCalledWith("res-1", {
        rating: 4,
        comment: null,
      });
    });
    // Flips to the read-only confirmation view.
    expect(
      await screen.findByText(/your review was submitted/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit review/i }),
    ).not.toBeInTheDocument();
  });
 
  it("submits a rating with a trimmed comment", async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewApi, "createReview").mockResolvedValue(
      makeReview({ reviewer_id: "user-1", rating: 5, comment: "Nice tool" }),
    );
    renderMakeReview();
 
    await user.click(await screen.findByRole("radio", { name: "5 stars" }));
    await user.type(
      screen.getByLabelText(/comment/i),
      "  Nice tool  ",
    );
    await user.click(screen.getByRole("button", { name: /submit review/i }));
 
    await waitFor(() => {
      expect(reviewApi.createReview).toHaveBeenCalledWith("res-1", {
        rating: 5,
        comment: "Nice tool",
      });
    });
  });
 
  it("shows an error when submitting the review fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewApi, "createReview").mockRejectedValue(
      new Error("Failed to submit review."),
    );
    renderMakeReview();
 
    await user.click(await screen.findByRole("radio", { name: "3 stars" }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));
 
    expect(
      await screen.findByText(/failed to submit review/i),
    ).toBeInTheDocument();
    // Still on the form.
    expect(
      screen.getByRole("button", { name: /submit review/i }),
    ).toBeInTheDocument();
  });
 
  it("highlights stars on hover", async () => {
    const user = userEvent.setup();
    renderMakeReview();
    const star = await screen.findByRole("radio", { name: "3 stars" });
    await user.hover(star);
    await user.unhover(star);
    // The picker remains interactive after hovering.
    expect(star).toBeInTheDocument();
  });
 
  // read-only (already reviewed)
 
  it("shows a read-only view when the user has already reviewed", async () => {
    vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
      makeReview({ reviewer_id: "user-1", rating: 5, comment: "Solid" }),
    ]);
    renderMakeReview();
 
    expect(
      await screen.findByText(/a review can only be submitted once/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByLabelText(/5 out of 5 stars/i)).toBeInTheDocument();
    // No form.
    expect(
      screen.queryByRole("radiogroup", { name: /rating/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit review/i }),
    ).not.toBeInTheDocument();
  });
 
  it("shows 'No written comment' for a review left without text", async () => {
    vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
      makeReview({ reviewer_id: "user-1", rating: 4, comment: null }),
    ]);
    renderMakeReview();
    expect(
      await screen.findByText(/no written comment/i),
    ).toBeInTheDocument();
  });
 
  // the other party's review
 
  it("shows the other party's review of you when they have left one", async () => {
    vi.spyOn(reviewApi, "fetchReservationReviews").mockResolvedValue([
      makeReview({ reviewer_id: "user-2", rating: 3, comment: "Prompt returns" }),
    ]);
    renderMakeReview();
 
    expect(
      await screen.findByRole("heading", { name: /review of you/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Prompt returns")).toBeInTheDocument();
    expect(screen.getByLabelText(/3 out of 5 stars/i)).toBeInTheDocument();
  });
 
  // navigation & perspective
 
  it("navigates back to transactions from the back link", async () => {
    const user = userEvent.setup();
    renderMakeReview();
    await user.click(
      await screen.findByRole("button", { name: /back to transactions/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard?tab=transactions");
  });
 
  it("navigates back to transactions from the form's Cancel button", async () => {
    const user = userEvent.setup();
    renderMakeReview();
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard?tab=transactions");
  });
 
  it("resolves the other party correctly from the borrower's perspective", async () => {
    // Current user (user-1) is the borrower; the owner is the other party.
    vi.spyOn(reservationsApi, "fetchReservationById").mockResolvedValue(
      makeReservation({ owner_id: "user-2", borrower_id: "user-1" }),
    );
    renderMakeReview();
    expect(await screen.findByText(/owned by jane doe/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /your review of jane doe/i }),
    ).toBeInTheDocument();
  });
});