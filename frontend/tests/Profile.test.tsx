import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Profile from "../src/pages/Profile/Profile";
import * as usersApi from "../src/api/users";
import type { UserProfile } from "../src/api/users";

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

// Stub the Navbar (tested separately).
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

const profile: UserProfile = {
  user_id: "user-1",
  user_first_name: "Jane",
  user_last_name: "Doe",
  user_middle_name: null,
  user_email: "jane@example.com",
  user_bio: "I like fixing things.",
  user_location: "Maple Street",
  user_created_at: "2026-01-01T00:00:00Z",
  user_photo_url: null,
  role_code: "MEMBER",
  role_name: "Member",
  role_description: null,
  status_code: "ACTIVE",
  status_name: "Active",
  status_description: null,
};

describe("Profile", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(profile);
  });

  // Verify the form is seeded from the loaded profile.
  it("loads the profile and pre-fills the form", async () => {
    render(<Profile />);

    expect(await screen.findByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("I like fixing things."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maple Street")).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.com/i)).toBeInTheDocument();
  });

  // Verify a load failure shows an error message.
  it("shows an error when the profile fails to load", async () => {
    vi.spyOn(usersApi, "fetchCurrentUser").mockRejectedValue(
      new Error("Session expired or invalid token"),
    );

    render(<Profile />);

    expect(
      await screen.findByText(/session expired or invalid token/i),
    ).toBeInTheDocument();
  });

  // Verify client-side validation for a missing first name.
  it("shows an error when the first name is cleared", async () => {
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(usersApi, "updateUserProfile");

    render(<Profile />);
    const firstName = await screen.findByDisplayValue("Jane");

    await user.clear(firstName);
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(
      await screen.findByText(/first name is required/i),
    ).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // Verify a successful save calls the API and shows the confirmation.
  it("saves the profile and shows a success message", async () => {
    const user = userEvent.setup();
    const updateSpy = vi
      .spyOn(usersApi, "updateUserProfile")
      .mockResolvedValue({ ...profile, user_first_name: "Janet" });

    render(<Profile />);
    const firstName = await screen.findByDisplayValue("Jane");

    await user.clear(firstName);
    await user.type(firstName, "Janet");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(
      await screen.findByText(/profile updated successfully/i),
    ).toBeInTheDocument();
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Janet",
        last_name: "Doe",
        bio: "I like fixing things.",
        location: "Maple Street",
      }),
    );
    // No photo change: photo_url must not be included in the payload.
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("photo_url");
  });

  // Verify mismatched new passwords are rejected client-side.
  it("shows an error when new passwords do not match", async () => {
    const user = userEvent.setup();
    const changeSpy = vi.spyOn(usersApi, "changePassword");

    render(<Profile />);
    await screen.findByDisplayValue("Jane");

    await user.type(screen.getByLabelText(/current password/i), "OldPass1!");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass1!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Different1!",
    );
    await user.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(
      await screen.findByText(/new passwords do not match/i),
    ).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();
  });

  // Verify weak new passwords are rejected client-side.
  it("shows an error when the new password is too weak", async () => {
    const user = userEvent.setup();

    render(<Profile />);
    await screen.findByDisplayValue("Jane");

    await user.type(screen.getByLabelText(/current password/i), "OldPass1!");
    await user.type(screen.getByLabelText(/^new password$/i), "weakpass1!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "weakpass1!",
    );
    await user.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(
      await screen.findByText(/at least one uppercase letter/i),
    ).toBeInTheDocument();
  });

  // Verify a successful password change clears the fields.
  it("changes the password and clears the form on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(usersApi, "changePassword").mockResolvedValue({
      message: "Password updated successfully.",
    });

    render(<Profile />);
    await screen.findByDisplayValue("Jane");

    const current = screen.getByLabelText(/current password/i);
    const next = screen.getByLabelText(/^new password$/i);
    const confirm = screen.getByLabelText(/confirm new password/i);

    await user.type(current, "OldPass1!");
    await user.type(next, "NewPass1!");
    await user.type(confirm, "NewPass1!");
    await user.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    expect(
      await screen.findByText(/password updated successfully/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(current).toHaveValue("");
      expect(next).toHaveValue("");
      expect(confirm).toHaveValue("");
    });
    expect(usersApi.changePassword).toHaveBeenCalledWith(
      "OldPass1!",
      "NewPass1!",
    );
  });
});