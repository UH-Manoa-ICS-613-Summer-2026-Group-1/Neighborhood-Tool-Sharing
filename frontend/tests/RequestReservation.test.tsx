// tests/RequestReservation.test.tsx
// Vitest tests for the RequestReservation page
//
// US 2 scenarios tested:
//   Scenario 1: Valid request — calls createReservation and navigates to transactions
//   Scenario 2: End date before start date → validation error
//   Scenario 3: Missing dates → validation error
//   Scenario 4 & 5: Overlap conflicts — backend error shown to user

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequestReservation from "../src/pages/Reservations/RequestReservation";
import * as toolsApi from "../src/api/tools";
import * as reservationsApi from "../src/api/reservations";
import type { ToolDetails } from "../src/api/tools";
import type { ReservationDetails } from "../src/api/reservations";

// Mock navigate so we can verify navigation without a real router.
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Stub the Navbar so it doesn't trigger its own API calls.
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

// Minimal tool fixture
const tool: ToolDetails = {
  tool_id: "tool-1",
  owner_id: "owner-1",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  tool_title: "DeWalt 20V Cordless Drill",
  tool_description: "Great drill.",
  tool_condition: "GOOD",
  tool_pickup_notes: null,
  tool_return_notes: null,
  tool_loan_duration_limit: 7,
  tool_status: "AVAILABLE",
  tool_created_at: "2026-01-01T00:00:00Z",
  tool_photos: [],
};

// Minimal reservation fixture
const reservation: ReservationDetails = {
  reservation_id: "res-1",
  reservation_status: "REQUESTED",
  reservation_start_date: "2026-07-22T00:00:00Z",
  reservation_end_date: "2026-07-23T23:59:59Z",
  reservation_loan_duration_limit: 7,
  reservation_pickup_notes: null,
  reservation_return_notes: null,
  reservation_created_at: "2026-07-21T00:00:00Z",
  tool_id: "tool-1",
  tool_title: "DeWalt 20V Cordless Drill",
  tool_description: "Great drill.",
  tool_condition: "GOOD",
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  borrower_id: "borrower-1",
  borrower_first_name: "John",
  borrower_last_name: "Smith",
  borrower_middle_name: null,
  owner_id: "owner-1",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_photos: [],
};

// Render the page at /tools/:toolId/reserve so useParams works.
function renderRequestReservation(toolId = "tool-1") {
  return render(
    <MemoryRouter initialEntries={[`/tools/${toolId}/reserve`]}>
      <Routes>
        <Route path="/tools/:toolId/reserve" element={<RequestReservation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequestReservation", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
  });

  // Verify the loading state shows before the fetch resolves.
  it("shows the loading state while fetching the tool", () => {
    vi.spyOn(toolsApi, "fetchToolById").mockImplementation(
      () => new Promise(() => {}),
    );
    renderRequestReservation();
    expect(screen.getByText(/loading tool details/i)).toBeInTheDocument();
  });

  // Verify the form renders after a successful fetch.
  it("renders the tool summary and date form on success", async () => {
    renderRequestReservation();
    expect(
      await screen.findByRole("heading", { name: /request reservation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/dewalt 20v cordless drill/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
  });

  // Verify an error shows when the tool fetch fails.
  it("shows an error when the tool cannot be loaded", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockRejectedValue(
      new Error("Tool not found."),
    );
    renderRequestReservation("missing");
    expect(await screen.findByRole("alert")).toHaveTextContent(/tool not found/i);
  });

  // US 2 Scenario 3: missing dates → validation error.
  it("shows an error when dates are missing on submit", async () => {
    const user = userEvent.setup();
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /please select both a start and end date/i,
    );
  });

  // US 2 Scenario 2: end date before start date → validation error.
  it("shows an error when end date is before start date", async () => {
    const user = userEvent.setup();
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.type(screen.getByLabelText(/start date/i), "2026-07-25");
    await user.type(screen.getByLabelText(/end date/i), "2026-07-22");
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /end date must be on or after start date/i,
    );
  });

  // US 2 Scenario 1: valid request → calls API and navigates.
  it("submits the reservation and navigates to transactions on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "createReservation").mockResolvedValue(reservation);
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.type(screen.getByLabelText(/start date/i), "2026-07-22");
    await user.type(screen.getByLabelText(/end date/i), "2026-07-23");
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    await waitFor(() => {
      expect(reservationsApi.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({ tool_id: "tool-1" }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard?tab=transactions",
      expect.anything(),
    );
  });

  // US 2 Scenarios 4 & 5: overlap → backend error shown.
  it("shows the backend error when reservation conflicts", async () => {
    const user = userEvent.setup();
    vi.spyOn(reservationsApi, "createReservation").mockRejectedValue(
      new Error("The tool is already reserved during this period."),
    );
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.type(screen.getByLabelText(/start date/i), "2026-07-22");
    await user.type(screen.getByLabelText(/end date/i), "2026-07-23");
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already reserved/i);
  });

  // Verify Cancel navigates back to tool detail.
  it("navigates back to tool detail when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/tool-1");
  });

  // Verify Back link navigates to tool detail.
  it("navigates back to tool detail when Back is clicked", async () => {
    const user = userEvent.setup();
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });
    await user.click(screen.getByRole("button", { name: /back to tool/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/tool-1");
  });

  // Verify the owner's loan duration limit is enforced client-side.
  // The fixture allows 7 days; this range is 14.
  it("shows an error when the range exceeds the loan duration limit", async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(reservationsApi, "createReservation");
    renderRequestReservation();
    await screen.findByRole("heading", { name: /request reservation/i });

    await user.type(screen.getByLabelText(/start date/i), "2026-07-22");
    await user.type(screen.getByLabelText(/end date/i), "2026-08-05");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /can only be loaned for up to 7 days/i,
    );
    expect(createSpy).not.toHaveBeenCalled();
  });
});