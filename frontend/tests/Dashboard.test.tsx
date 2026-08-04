import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import Dashboard from "../src/pages/Dashboard/Dashboard";
import * as usersApi from "../src/api/users";
import * as toolsApi from "../src/api/tools";
import * as reservationsApi from "../src/api/reservations";
import type { UserProfile } from "../src/api/users";
import type { ToolDetails } from "../src/api/tools";

// Mock navigate so we can verify navigation without a real router.
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

// Keep useSearchParams/useLocation real (the tab state lives in the URL),
// only replace useNavigate.
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// The Navbar is tested separately; stub it out here.
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

const profile: UserProfile = {
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

const makeTool = (id: string, title: string): ToolDetails => ({
  tool_id: id,
  owner_id: "user-1",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  tool_title: title,
  tool_description: "A useful tool.",
  tool_condition: "GOOD",
  tool_pickup_notes: null,
  tool_return_notes: null,
  tool_loan_duration_limit: 7,
  tool_status: "AVAILABLE",
  tool_created_at: "2026-01-01T00:00:00Z",
  tool_photos: [],
});

function renderDashboard(url = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    localStorage.setItem("access_token", "some-token");

    // Sensible defaults; individual tests override as needed.
    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(profile);
    vi.spyOn(toolsApi, "fetchToolTypes").mockResolvedValue([]);
    vi.spyOn(toolsApi, "fetchToolConditions").mockResolvedValue([]);
    vi.spyOn(toolsApi, "fetchTools").mockResolvedValue([]);

    // ADDED BY MARITZA — 07/19/2026
    // Mock reservations API so the Transactions tab doesn't make real requests
    // fetchReservations is called when the Transactions tab is rendered (US 9, 10)
    vi.spyOn(reservationsApi, "fetchReservations").mockResolvedValue([]);
  });

  // Verify unauthenticated users are bounced to login.
  it("redirects to /login when no token is stored", () => {
    localStorage.clear();

    renderDashboard();

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  // Verify the welcome header renders after the profile loads.
  it("shows the welcome message with the user's name", async () => {
    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: /welcome back, jane/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  // Verify the profile error path clears the token.
  it("shows an error and clears the token when the profile fails to load", async () => {
    vi.spyOn(usersApi, "fetchCurrentUser").mockRejectedValue(
      new Error("Session expired or invalid token"),
    );

    renderDashboard();

    expect(
      await screen.findByText(/session expired or invalid token/i),
    ).toBeInTheDocument();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(
      screen.getByRole("button", { name: /go to login/i }),
    ).toBeInTheDocument();
  });

  // Verify the user's tools render on the default tab.
  it("renders the tool grid on the My Tools tab", async () => {
    vi.spyOn(toolsApi, "fetchTools").mockResolvedValue([
      makeTool("t1", "Cordless Drill"),
      makeTool("t2", "Circular Saw"),
    ]);

    renderDashboard();

    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Circular Saw")).toBeInTheDocument();

    // The default tab requests the user's own tools.
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenCalledWith(
        expect.objectContaining({ isMine: true, offset: 0 }),
      );
    });
  });

  // Verify the empty state for a user with no tools.
  it("shows the empty Tool Shed state with an Add button", async () => {
    const user = userEvent.setup();

    renderDashboard();

    expect(
      await screen.findByText(/your tool shed is empty/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /add your first tool/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tools/new");
  });

  // Verify switching to the neighborhood tab fetches other people's tools.
  it("fetches neighborhood tools when switching tabs", async () => {
    const user = userEvent.setup();

    renderDashboard();
    await screen.findByRole("heading", { name: /welcome back/i });

    await user.click(
      screen.getByRole("button", { name: /browse neighborhood/i }),
    );

    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenCalledWith(
        expect.objectContaining({ isMine: false }),
      );
    });
  });

  // UPDATED BY MARITZA — 07/19/2026
  // US 9 & 10: Transactions tab now shows the real Transactions component
  // instead of a placeholder. When there are no reservations it shows
  // "No Transactions Yet" with a Browse Tools button.
  it("shows the empty transactions state on the transactions tab", async () => {
    const user = userEvent.setup();

    renderDashboard();
    await screen.findByRole("heading", { name: /welcome back/i });

    await user.click(screen.getByRole("button", { name: /transactions/i }));

    // Wait for the Transactions component to finish loading
    expect(
      await screen.findByText(/no transactions yet/i),
    ).toBeInTheDocument();
  });

  // Verify submitting the search form triggers a filtered fetch.
  it("applies the search filter when the search form is submitted", async () => {
    const user = userEvent.setup();

    renderDashboard();
    await screen.findByRole("heading", { name: /welcome back/i });

    await user.type(
      screen.getByPlaceholderText(/search title or description/i),
      "drill",
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenCalledWith(
        expect.objectContaining({ search: "drill" }),
      );
    });
  });

  // Verify the success banner appears after publishing a tool.
  it("shows the success banner passed via navigation state", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/dashboard", state: { toolCreated: "Cordless Drill" } },
        ]}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/"cordless drill" was published/i),
    ).toBeInTheDocument();
  });

  // ADDED BY MARITZA — 07/19/2026
  // US 2 Scenario 1: success banner shows after a reservation is created
  it("shows the reservation success banner when reservationCreated state is passed", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/dashboard", state: { reservationCreated: "Cordless Drill" } },
        ]}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/reservation request for "cordless drill" was submitted/i),
    ).toBeInTheDocument();
  });

  // Verify the tool list error path.
  it("shows an error when the tool list fails to load", async () => {
    vi.spyOn(toolsApi, "fetchTools").mockRejectedValue(
      new Error("Failed to load tools."),
    );

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed to load tools/i,
    );
  });

  // Verify the Go to Login button on the profile error screen.
  it("navigates to login when Go to Login is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(usersApi, "fetchCurrentUser").mockRejectedValue(
      new Error("Session expired or invalid token"),
    );

    renderDashboard();

    await user.click(
      await screen.findByRole("button", { name: /go to login/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  // Verify the success banner can be dismissed.
  it("hides the success banner when the dismiss button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/dashboard", state: { toolCreated: "Cordless Drill" } },
        ]}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    const banner = await screen.findByText(/"cordless drill" was published/i);
    expect(banner).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(
      screen.queryByText(/"cordless drill" was published/i),
    ).not.toBeInTheDocument();
  });

  // Verify switching back to the default tab clears the ?tab param and refetches.
  it("returns to the My Tools tab after visiting the neighborhood tab", async () => {
    const user = userEvent.setup();

    renderDashboard();
    await screen.findByRole("heading", { name: /welcome back/i });

    await user.click(
      screen.getByRole("button", { name: /browse neighborhood/i }),
    );
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ isMine: false }),
      );
    });

    await user.click(screen.getByRole("button", { name: /your tool shed/i }));
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ isMine: true }),
      );
    });
  });

  // Verify the category and condition dropdowns filter the tool list.
  it("filters the tool list by category and condition", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchToolTypes").mockResolvedValue([
      { id: 1, code: "POWER_TOOLS", display_name: "Power Tools", description: null },
    ]);
    vi.spyOn(toolsApi, "fetchToolConditions").mockResolvedValue(["GOOD"]);

    renderDashboard();
    await screen.findByRole("heading", { name: /welcome back/i });

    // The two selects are the category and condition filters, in that order.
    const [categorySelect, conditionSelect] = await screen.findAllByRole("combobox");

    await user.selectOptions(categorySelect, "POWER_TOOLS");
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ toolType: "POWER_TOOLS" }),
      );
    });

    await user.selectOptions(conditionSelect, "GOOD");
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ toolCondition: "GOOD" }),
      );
    });

    // With filters applied, the empty state explains why nothing matched.
    expect(
      await screen.findByText(/no tools match your filters/i),
    ).toBeInTheDocument();
  });

  // Verify clicking a tool card opens its detail page.
  it("navigates to the tool detail page when a card is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(toolsApi, "fetchTools").mockResolvedValue([
      makeTool("t1", "Cordless Drill"),
    ]);

    renderDashboard();

    await user.click(
      await screen.findByRole("button", { name: /cordless drill/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tools/t1", {
      state: { user: expect.anything() },
    });
  });

  // Verify pagination when the API returns a full page of results.
  it("pages forward and back when a full page is returned", async () => {
    const user = userEvent.setup();
    // PAGE_SIZE is 12; a full page means there may be more results.
    vi.spyOn(toolsApi, "fetchTools").mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => makeTool(`t${i}`, `Tool ${i}`)),
    );

    renderDashboard();

    await user.click(await screen.findByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 12 }),
      );
    });
    expect(screen.getByText(/page 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() => {
      expect(toolsApi.fetchTools).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0 }),
      );
    });
  });
});