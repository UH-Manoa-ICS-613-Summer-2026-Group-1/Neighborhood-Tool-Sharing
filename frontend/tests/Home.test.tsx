import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Home from "../src/pages/Landing/Home";

// Mock navigate so we can verify navigation without a real router.
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

// Replace useNavigate with our mocked function.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Home", () => {
  // Clear mock calls before each test.
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // Verify the main heading renders.
  it("displays the main heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /neighborhood tool sharing/i }),
    ).toBeInTheDocument();
  });

  // Verify all feature cards are displayed.
  it("displays all three feature cards", () => {
    render(<Home />);

    expect(screen.getByText(/list your tools/i)).toBeInTheDocument();
    expect(screen.getByText(/reserve with ease/i)).toBeInTheDocument();
    expect(screen.getByText(/invite only/i)).toBeInTheDocument();
  });

  // Verify the Sign In button navigates to the login page.
  it("navigates to /login when Sign In is clicked", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});