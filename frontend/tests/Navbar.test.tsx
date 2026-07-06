import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Navbar from "../src/components/Navbar";
import * as authApi from "../src/api/auth";

// Mock navigate so we can verify navigation without a real router.
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

// Replace useNavigate with the mocked function.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Navbar", () => {
  beforeEach(() => {
    // Reset mocks and simulate a logged-in user.
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    localStorage.setItem("access_token", "some-token");
  });

  // Verify the navigation links render.
  it("renders all navigation items", () => {
    render(<Navbar />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Add Tool")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  // Verify the profile menu opens.
  it("opens the profile menu and shows Sign out", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    expect(screen.getByText(/your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/send invite/i)).toBeInTheDocument();
  });

  // Verify signing out clears the token and redirects home.
  it("clears the token and navigates home on sign out", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "logoutUser").mockResolvedValue();

    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBeNull();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});