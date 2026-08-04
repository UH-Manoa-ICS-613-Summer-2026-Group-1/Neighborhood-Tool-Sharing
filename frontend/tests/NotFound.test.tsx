import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import NotFound from "../src/pages/NotFound/NotFound";

// Mock navigate so we can verify button click redirect
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Navbar so its own fetching/rendering logic doesn't interfere
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  );
}

describe("NotFound Page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  it("renders the 404 header, title, and description", () => {
    renderNotFound();

    expect(screen.getByRole("heading", { level: 1, name: /404/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /page not found/i })).toBeInTheDocument();
    expect(
      screen.getByText(/the page or resource you are looking for does not exist/i)
    ).toBeInTheDocument();
  });

  it("navigates to /dashboard when 'Return to Dashboard' button is clicked", async () => {
    const user = userEvent.setup();

    renderNotFound();

    const button = screen.getByRole("button", { name: /return to dashboard/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});