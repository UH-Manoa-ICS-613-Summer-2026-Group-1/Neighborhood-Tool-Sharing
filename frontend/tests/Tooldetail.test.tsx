import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import ToolDetail from "../src/pages/Tools/ToolDetail";
import * as toolsApi from "../src/api/tools";
import type { ToolDetails } from "../src/api/tools";

// Mock navigate so we can verify navigation without a real router.
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

// The Navbar fetches the current user on its own; stub it out so
// these tests stay focused on the ToolDetail page itself.
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

const tool: ToolDetails = {
  tool_id: "tool-1",
  owner_id: "user-1",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  tool_title: "DeWalt 20V Cordless Drill",
  tool_description: "Great drill, barely used.",
  tool_condition: "GOOD",
  tool_pickup_notes: "Porch pickup after 5pm",
  tool_return_notes: "Please return with a full charge",
  tool_loan_duration_limit: 7,
  tool_status: "AVAILABLE",
  tool_created_at: "2026-01-01T00:00:00Z",
  tool_photos: [
    { id: "p1", url: "https://example.com/photo1.jpg" },
    { id: "p2", url: "https://example.com/photo2.jpg" },
  ],
};

// Render the page at a real /tools/:toolId URL so useParams works.
function renderToolDetail(toolId = "tool-1") {
  return render(
    <MemoryRouter initialEntries={[`/tools/${toolId}`]}>
      <Routes>
        <Route path="/tools/:toolId" element={<ToolDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ToolDetail", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  // Verify the loading state shows before the fetch resolves.
  it("shows the loading state while fetching", () => {
    vi.spyOn(toolsApi, "fetchToolById").mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderToolDetail();

    expect(screen.getByText(/loading tool/i)).toBeInTheDocument();
  });

  // Verify the details render after a successful fetch.
  it("renders the tool details on success", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);

    renderToolDetail();

    expect(
      await screen.findByRole("heading", {
        name: /dewalt 20v cordless drill/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/shared by jane doe/i)).toBeInTheDocument();
    expect(screen.getByText(/condition: good/i)).toBeInTheDocument();
    expect(screen.getByText(/loan up to 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/porch pickup after 5pm/i)).toBeInTheDocument();
    expect(
      screen.getByText(/please return with a full charge/i),
    ).toBeInTheDocument();
    expect(toolsApi.fetchToolById).toHaveBeenCalledWith("tool-1");
  });

  // Verify an error message renders when the fetch fails.
  it("shows an error message when the tool cannot be loaded", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockRejectedValue(
      new Error("Tool not found."),
    );

    renderToolDetail("missing-id");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /tool not found/i,
    );
  });

  // Verify clicking a thumbnail switches the large photo.
  it("switches the active photo when a thumbnail is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);

    renderToolDetail();
    await screen.findByRole("heading", { name: /dewalt/i });

    // The main image starts on photo 1.
    expect(
      screen.getByRole("img", { name: /photo 1/i }),
    ).toHaveAttribute("src", "https://example.com/photo1.jpg");

    await user.click(screen.getByRole("button", { name: /show photo 2/i }));

    expect(
      screen.getByRole("img", { name: /photo 2/i }),
    ).toHaveAttribute("src", "https://example.com/photo2.jpg");
  });

  // UPDATED BY MARITZA — 07/19/2026
  // US 2: Request Reservation button is now enabled and navigates to the reservation form
  // Previously: button was disabled (backend not ready)
  // Now: button is enabled and routes to /tools/:toolId/reserve
  it("renders an enabled Request Reservation button and navigates to reservation form", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);

    renderToolDetail();
    await screen.findByRole("heading", { name: /dewalt/i });

    const reserveButton = screen.getByRole("button", { name: /request reservation/i });

    // Button should now be enabled (US 2 — reservation backend is ready)
    expect(reserveButton).not.toBeDisabled();

    // Clicking should navigate to the reservation form for this tool
    await user.click(reserveButton);
    expect(mockNavigate).toHaveBeenCalledWith("/tools/tool-1/reserve");
  });

  // Verify the back link returns to the dashboard.
  it("navigates back to the dashboard when Back is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);

    renderToolDetail();

    await user.click(
      screen.getByRole("button", { name: /back to dashboard/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
