import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import Navbar from "../src/components/Navbar";
import * as authApi from "../src/api/auth";
import * as usersApi from "../src/api/users";
import type { UserProfile } from "../src/api/users";

// Mock navigate so we can verify navigation without a real router.
const { mockNavigate } = vi.hoisted(() => {
  return { mockNavigate: vi.fn() };
});

// Replace useNavigate only — useLocation stays real, so the component
// must be rendered inside a MemoryRouter (it reads the current URL to
// highlight the active nav item).
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

// Render helper: Navbar needs a router for useLocation, and the initial
// URL controls which nav item is marked as current.
function renderNavbar(
  props: { user?: UserProfile | null } = {},
  url = "/dashboard",
) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Navbar {...props} />
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    localStorage.setItem("access_token", "some-token");
    // Navbar fetches the profile itself when no user prop is passed;
    // mock it so no real network request is attempted.
    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(profile);
  });

  // Verify the mobile panel's nav buttons navigate too.
  // (Desktop bar and mobile panel each render their own buttons; the mobile
  // one is second in the DOM.)
  it("navigates when a mobile nav item is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /open main menu/i }));
    await user.click(screen.getAllByRole("button", { name: /add tool/i })[1]);

    expect(mockNavigate).toHaveBeenCalledWith("/tools/new");
  });

  // Verify the navigation links render.
  // (The current nav has Home, Add Tool, and Calendar — no Search item.)
  it("renders all navigation items", () => {
    renderNavbar();

    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add tool/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /calendar/i }),
    ).toBeInTheDocument();
  });

  // Verify the active nav item is marked with aria-current.
  it("marks the current page based on the URL", () => {
    renderNavbar({}, "/tools/new");

    expect(screen.getByRole("button", { name: /add tool/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /home/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Verify the Calendar item is current on the transactions tab,
  // and Home is not (they share the /dashboard pathname).
  it("distinguishes dashboard tabs via the ?tab query param", () => {
    renderNavbar({}, "/calendar");

    expect(screen.getByRole("button", { name: /calendar/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /home/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Verify clicking a nav item navigates to its href.
  it("navigates when a nav item is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /add tool/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/tools/new");

    await user.click(screen.getByRole("button", { name: /calendar/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/calendar");
  });

  // Verify the avatar shows the user's initials when passed as a prop
  // (no extra API call should be made in that case).
  it("shows the user's initials from the user prop without refetching", () => {
    renderNavbar({ user: profile });

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(usersApi.fetchCurrentUser).not.toHaveBeenCalled();
  });

  // Verify the photo avatar is used when the profile has a photo URL.
  it("shows the profile photo when the user has one", () => {
    renderNavbar({
      user: { ...profile, user_photo_url: "https://example.com/me.jpg" },
    });

    const img = screen.getByRole("img", { name: /jane doe/i });
    expect(img).toHaveAttribute("src", "https://example.com/me.jpg");
  });

  // Verify the Navbar fetches the profile itself when no prop is given.
  it("fetches the current user when no user prop is passed", async () => {
    renderNavbar();

    // The fetched profile's initials appear once the request resolves.
    expect(await screen.findByText("JD")).toBeInTheDocument();
    expect(usersApi.fetchCurrentUser).toHaveBeenCalledTimes(1);
  });

  // Verify the profile menu opens and shows the user's details and actions.
  it("opens the profile menu with the user header and actions", async () => {
    const user = userEvent.setup();
    renderNavbar({ user: profile });

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /your profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /send invite/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  // Verify the menu actions navigate to the right pages.
  it("navigates to profile and invite pages from the menu", async () => {
    const user = userEvent.setup();
    renderNavbar({ user: profile });

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /your profile/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /send invite/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/invite");
  });

  // Verify signing out clears the token and redirects home.
  it("clears the token and navigates home on sign out", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "logoutUser").mockResolvedValue();

    renderNavbar({ user: profile });

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBeNull();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  // Verify sign-out still clears local state when the API call fails.
  it("clears the token and navigates home even when logout fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "logoutUser").mockRejectedValue(
      new Error("Network down"),
    );
    // Silence the expected console.error from the component's catch block.
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderNavbar({ user: profile });

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBeNull();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(consoleSpy).toHaveBeenCalled();
  });

  // Verify the mobile menu opens and contains the nav items.
  it("opens the mobile menu and shows the navigation items", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /open main menu/i }));

    // Each nav item now appears twice: desktop bar + mobile panel.
    expect(screen.getAllByText("Home")).toHaveLength(2);
    expect(screen.getAllByText("Add Tool")).toHaveLength(2);
    expect(screen.getAllByText("Calendar")).toHaveLength(2);
  });
});