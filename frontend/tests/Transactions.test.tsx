// tests/Transactions.test.tsx
// Vitest tests for the Transactions component
//
// User stories tested:
//   US 3: Cancel button shown for REQUESTED/APPROVED, hidden otherwise
//   US 4: Approve/Deny buttons shown to owner for REQUESTED only
//   US 5: Confirm Return shown to owner for PICKED_UP only
//   US 7: Confirm Pickup shown to borrower for APPROVED only
//   US 9 & 10: Shows reservations for both owner and borrower roles

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Transactions from "../src/pages/Reservations/Transactions";
import * as reservationsApi from "../src/api/reservations";
import * as usersApi from "../src/api/users";
import type { ReservationDetails } from "../src/api/reservations";
import type { UserProfile } from "../src/api/users";

// Mock navigate
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
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
    // Owner sees "Outgoing" label
    expect(screen.getByText(/outgoing/i)).toBeInTheDocument();
  });

  // US 10: Borrower sees reservation with owner name
  it("renders a reservation card with owner info for borrower", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({ owner_id: "user-2", borrower_id: "user-1" }),
    ]);
    renderTransactions();
    expect(await screen.findByText(/owned by jane doe/i)).toBeInTheDocument();
    // Borrower sees "Incoming" label
    expect(screen.getByText(/incoming/i)).toBeInTheDocument();
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
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
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
});
