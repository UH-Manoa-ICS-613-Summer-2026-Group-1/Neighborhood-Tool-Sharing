import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App";

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