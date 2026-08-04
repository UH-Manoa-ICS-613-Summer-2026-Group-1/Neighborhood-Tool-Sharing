import { render, screen, waitFor, fireEvent} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import ToolDetail from "../src/pages/Tools/ToolDetail";
import * as toolsApi from "../src/api/tools";
import * as usersApi from "../src/api/users";
import type { ToolDetails, ToolResponse } from "../src/api/tools";
import type { UserProfile } from "../src/api/users";

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

// Create a mock owner, owner can hide, unhide, and delete the tool
const mockOwner: UserProfile = {
  user_id: "user-1",
  user_first_name: "Jane",
  user_last_name: "Doe",
  user_email: "jane@example.com",
  role_code: "MEMBER",
  role_name: "Member",
  role_description: null,
  status_code: "ACTIVE",
  status_name: "Active",
  status_description: null,
  user_middle_name: null,
  user_location: null,
  user_bio: null,
  user_photo_url: null,
  user_created_at: "2026-01-01T00:00:00Z",
};

// Create a mock borrower, borrower can see reservaion request button
const mockBorrower: UserProfile = {
  user_id: "user-2",
  user_first_name: "John",
  user_last_name: "Smith",
  user_email: "john@example.com",
  role_code: "MEMBER",
  role_name: "Member",
  role_description: null,
  status_code: "ACTIVE",
  status_name: "Active",
  status_description: null,
  user_middle_name: null,
  user_location: null,
  user_bio: null,
  user_photo_url: null,
  user_created_at: "2026-01-01T00:00:00Z",
};

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

const mockHiddenToolResponse: ToolResponse = {
  id: "tool-1",
  tool_type_id: 1,
  title: "DeWalt 20V Cordless Drill",
  description: "Great drill, barely used.",
  condition: "GOOD",
  photos: [],
  pickup_notes: "Porch pickup after 5pm",
  return_notes: "Please return with a full charge",
  loan_duration_limit: 7,
  status: "HIDDEN",
  created_at: "2026-01-01T00:00:00Z",
};

// Render the page at a real /tools/:toolId URL so useParams works.
// And pass the mock user (the owner by default)
function renderToolDetail(toolId = "tool-1", userState: UserProfile | null = mockOwner) {
  return render(
    <MemoryRouter initialEntries={[
        {
          pathname: `/tools/${toolId}`,
          state: { user: userState },
        },
      ]}
      >
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

    // Pass the mock borrower, only borrower can see request reservation button
    renderToolDetail(undefined, mockBorrower);
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

  // Verify hiding and unhiding a tool updates the UI and calls the API.
  it("handles hiding and unhiding a tool", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    const hideSpy = vi
      .spyOn(toolsApi, "hideTool")
      .mockResolvedValue(mockHiddenToolResponse);

    renderToolDetail();

    const hideButton = await screen.findByRole("button", {
      name: /hide listing/i,
    });
    await user.click(hideButton);

    // Hiding was called with the right tool ID
    expect(hideSpy).toHaveBeenCalledWith("tool-1");

    // There is a button to unhide the listing
    expect(
      await screen.findByRole("button", { name: /unhide listing/i })
    ).toBeInTheDocument();

    // Status is now hidden
    expect(screen.getByText(/status: hidden/i)).toBeInTheDocument();
  });

  // Verify deleting a tool calls API and navigates to dashboard.
  it("handles deleting a tool and navigating home", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteSpy = vi
      .spyOn(toolsApi, "deleteTool")
      .mockResolvedValue({ message: "Deleted" });

    renderToolDetail();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    // Delete was called with the right tool ID
    expect(deleteSpy).toHaveBeenCalledWith("tool-1");

    // Navigates to dashboard after delete
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  // Verify an alert is shown if hiding a tool fails.
  it("displays alert on hide error", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(toolsApi, "hideTool").mockRejectedValue(new Error("Hide failed"));

    renderToolDetail();

    const hideButton = await screen.findByRole("button", {
      name: /hide listing/i,
    });
    await user.click(hideButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Hide failed");
    });
  });

  // Verify user profile is fetched when omitted from router state.
  it("fetches user profile via API when not supplied in router state", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    const fetchUserSpy = vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(mockOwner);

    // Simulate no user in router state
    renderToolDetail("tool-1", null);

    // Expect user profile to be fetched
    await waitFor(() => {
      expect(fetchUserSpy).toHaveBeenCalled();
    });
  });

  // Error handling during user profile fetch failure
  it("handles error when fetching user profile fails", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    vi.spyOn(usersApi, "fetchCurrentUser").mockRejectedValue(new Error("Failed profile fetch"));

    renderToolDetail("tool-1", null);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed profile fetch");
  });

  // Error handling on delete failure
  it("displays alert on delete error", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(toolsApi, "deleteTool").mockRejectedValue(new Error("Delete failed"));

    renderToolDetail();

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Delete failed");
    });
  });

  // Main image onError handler
  it("replaces main image src with placeholder when main image fails to load", async () => {
    vi.spyOn(toolsApi, "fetchToolById").mockResolvedValue(tool);

    renderToolDetail();

    const mainImg = await screen.findByRole("img", { name: /photo 1/i });
    fireEvent.error(mainImg);

    // Main image should be replaced with placeholder
    expect(mainImg).toHaveAttribute(
      "src",
      "http://localhost:9000/community-tool-share-media/placeholders/default-placeholder-image.png"
    );
  });
});