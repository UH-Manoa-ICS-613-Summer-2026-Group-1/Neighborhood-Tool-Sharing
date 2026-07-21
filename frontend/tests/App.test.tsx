import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";

// Mock all protected pages so the router tests stay focused on routing only
// and don't trigger real API calls from nested components

vi.mock("../src/pages/Dashboard/Dashboard", () => ({
  default: () => <div>Dashboard Page</div>,
}));

vi.mock("../src/pages/Tools/AddTool", () => ({
  default: () => <div>Add Tool Page</div>,
}));

vi.mock("../src/pages/Tools/ToolDetail", () => ({
  default: () => <div>Tool Detail Page</div>,
}));

vi.mock("../src/pages/Profile/Profile", () => ({
  default: () => <div>Profile Page</div>,
}));

vi.mock("../src/pages/Invite/SendInvite", () => ({
  default: () => <div>Send Invite Page</div>,
}));

// ADDED BY MARITZA — 07/19/2026
// Mock the new RequestReservation page so routing tests don't trigger real API calls
vi.mock("../src/pages/Reservations/RequestReservation", () => ({
  default: () => <div>Request Reservation Page</div>,
}));

// Integration tests use the real router with browser history.
describe("App routing (integration)", () => {
  // Verify the Home page renders at the root route.
  it("renders the Home page at /", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /neighborhood tool sharing/i }),
    ).toBeInTheDocument();
  });

  // Verify the Login page renders at /login.
  it("renders the Login page at /login", () => {
    window.history.pushState({}, "", "/login");
    render(<App />);

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });

  // Verify the Sign In button navigates to the Login page.
  it("navigates from Home to Login when Sign In is clicked", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });
});
