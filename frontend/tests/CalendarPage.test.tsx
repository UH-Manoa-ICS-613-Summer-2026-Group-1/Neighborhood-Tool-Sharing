// tests/CalendarPage.test.tsx
// Vitest tests for the CalendarPage component
//
// US 26 Scenario 3: Reminder banner shown for upcoming APPROVED reservations

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "../src/pages/Calendar/CalendarPage";
import * as reservationsApi from "../src/api/reservations";
import type { ReservationDetails } from "../src/api/reservations";

// Mock navigate
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Stub Navbar
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

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
  borrower_id: "user-1",
  borrower_first_name: "John",
  borrower_last_name: "Smith",
  borrower_middle_name: null,
  owner_id: "user-2",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_photos: [],
  ...overrides,
});

function renderCalendarPage() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  );
}

describe("CalendarPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  // Verify loading state
  it("shows the loading state while fetching reservations", () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockImplementation(
      () => new Promise(() => {}),
    );
    renderCalendarPage();
    expect(screen.getByText(/loading calendar/i)).toBeInTheDocument();
  });

  // Verify calendar renders with month navigation
  it("renders the calendar with month navigation", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
    renderCalendarPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /previous month/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /next month/i }),
      ).toBeInTheDocument();
    });
  });

  // Verify error state
  it("shows an error when reservations fail to load", async () => {
    vi.spyOn(reservationsApi, "fetchReservations").mockRejectedValue(
      new Error("Failed to load reservations."),
    );
    renderCalendarPage();
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/failed to load reservations/i);
  });

  // Verify clicking a date shows the detail panel
  it("shows the detail panel when a date is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
    renderCalendarPage();

    // Wait for calendar to load
    await screen.findByRole("button", { name: /previous month/i });

    // Click on any numbered date button
    const dateCells = screen.getAllByRole("button").filter(
      (btn) => /^\d+,/.test(btn.getAttribute("aria-label") ?? "")
    );

    if (dateCells.length > 0) {
      await user.click(dateCells[0]);
      expect(
        screen.getByText(/no reservations on this day/i),
      ).toBeInTheDocument();
    }
  });

  // US 26 Scenario 3: Reminder banner for APPROVED reservations within 3 days
  it("shows reminder banner for upcoming APPROVED reservations", async () => {
    // Create an APPROVED reservation starting tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({
        reservation_status: "APPROVED",
        reservation_start_date: tomorrowISO,
      }),
    ]);

    renderCalendarPage();

    expect(
      await screen.findByText(/upcoming pickup reminders/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/dewalt drill/i)).toBeInTheDocument();
  });

  // US 26 Scenario 3: No reminder for reservations more than 3 days away
  it("does not show reminder banner for reservations far in the future", async () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 10);

    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([
      makeReservation({
        reservation_status: "APPROVED",
        reservation_start_date: farFuture.toISOString(),
      }),
    ]);

    renderCalendarPage();

    await screen.findByRole("button", { name: /previous month/i });
    expect(
      screen.queryByText(/upcoming pickup reminders/i),
    ).not.toBeInTheDocument();
  });

  // Verify month navigation works
  it("navigates to the previous month when Previous is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
    renderCalendarPage();

    await screen.findByRole("button", { name: /previous month/i });

    // Get current month heading
    const currentMonth = screen.getAllByRole("heading")[1]?.textContent ?? "";

    await user.click(screen.getByRole("button", { name: /previous month/i }));

    const newMonth = screen.getAllByRole("heading")[1]?.textContent ?? "";
    expect(newMonth).not.toBe(currentMonth);
  });
});
