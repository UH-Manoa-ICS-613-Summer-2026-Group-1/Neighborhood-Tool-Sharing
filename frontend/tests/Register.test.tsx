import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Register from "../src/pages/Register/Register";
import * as invitationsApi from "../src/api/invitations";
import * as authApi from "../src/api/auth";

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

// Render with (or without) a ?token=... query string.
// useSearchParams still works normally, so MemoryRouter controls the URL.
function renderRegister(url = "/register?token=valid-token") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Register />
    </MemoryRouter>,
  );
}

// A strong password matching all frontend/backend rules.
const GOOD_PASSWORD = "Str0ngPass!";

// Fill in the whole form with valid values.
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/first name/i), "Ada");
  await user.type(screen.getByPlaceholderText(/last name/i), "Lovelace");
  await user.type(
    screen.getByPlaceholderText(/^password/i),
    GOOD_PASSWORD,
  );
  await user.type(
    screen.getByPlaceholderText(/confirm password/i),
    GOOD_PASSWORD,
  );
}

// Fill the form using one password for both password fields, then submit.
async function submitWithPassword(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
) {
  await user.type(screen.getByPlaceholderText(/first name/i), "Ada");
  await user.type(screen.getByPlaceholderText(/last name/i), "Lovelace");
  await user.type(screen.getByPlaceholderText(/^password/i), password);
  await user.type(screen.getByPlaceholderText(/confirm password/i), password);
  await user.click(screen.getByRole("button", { name: /create account/i }));
}

// Mock a valid invitation and wait for the form to appear.
async function renderWithValidToken() {
  vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
    recipient_email: "invited@example.com",
  });
  renderRegister();
  await screen.findByDisplayValue("invited@example.com");
}

describe("Register", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  // Verify the missing-token error shows without calling the API.
  it("shows an error when no invite token is in the URL", async () => {
    const spy = vi.spyOn(invitationsApi, "validateInviteToken");

    renderRegister("/register");

    expect(
      await screen.findByText(/no invitation token found/i),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  // Verify the loading state while the token is being validated.
  it("shows the validating state while the token is checked", () => {
    vi.spyOn(invitationsApi, "validateInviteToken").mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderRegister();

    expect(
      screen.getByText(/validating your invitation/i),
    ).toBeInTheDocument();
  });

  // Verify a valid token pre-fills the email field.
  it("pre-fills the email from a valid invitation", async () => {
    vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
      recipient_email: "invited@example.com",
    });

    renderRegister();

    expect(
      await screen.findByDisplayValue("invited@example.com"),
    ).toBeInTheDocument();
    expect(invitationsApi.validateInviteToken).toHaveBeenCalledWith(
      "valid-token",
    );
  });

  // Verify an invalid token shows the token error screen.
  it("shows an error when the token is invalid", async () => {
    vi.spyOn(invitationsApi, "validateInviteToken").mockRejectedValue(
      new Error("This invitation link has expired."),
    );

    renderRegister();

    expect(
      await screen.findByText(/this invitation link has expired/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to login/i }),
    ).toBeInTheDocument();
  });

  // Verify mismatched passwords are rejected client-side.
  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
      recipient_email: "invited@example.com",
    });
    const registerSpy = vi.spyOn(authApi, "registerUser");

    renderRegister();
    await screen.findByDisplayValue("invited@example.com");

    await user.type(screen.getByPlaceholderText(/first name/i), "Ada");
    await user.type(screen.getByPlaceholderText(/last name/i), "Lovelace");
    await user.type(screen.getByPlaceholderText(/^password/i), GOOD_PASSWORD);
    await user.type(
      screen.getByPlaceholderText(/confirm password/i),
      "Different1!",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  // Verify password strength rules are enforced client-side.
  it("shows an error when the password has no uppercase letter", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
      recipient_email: "invited@example.com",
    });

    renderRegister();
    await screen.findByDisplayValue("invited@example.com");

    await user.type(screen.getByPlaceholderText(/first name/i), "Ada");
    await user.type(screen.getByPlaceholderText(/last name/i), "Lovelace");
    await user.type(screen.getByPlaceholderText(/^password/i), "weakpass1!");
    await user.type(
      screen.getByPlaceholderText(/confirm password/i),
      "weakpass1!",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/at least one uppercase letter/i),
    ).toBeInTheDocument();
  });

  // Verify successful registration calls the API and redirects to login.
  it("registers the user and navigates to login on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
      recipient_email: "invited@example.com",
    });
    const registerSpy = vi
      .spyOn(authApi, "registerUser")
      .mockResolvedValue({ message: "ok" });

    renderRegister();
    await screen.findByDisplayValue("invited@example.com");

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        email: "invited@example.com",
        password: GOOD_PASSWORD,
        inviteToken: "valid-token",
        firstName: "Ada",
        lastName: "Lovelace",
        middleName: undefined,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login?registered=true");
  });

  // Verify a failed registration shows an error message.
  it("shows an error when registration fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "validateInviteToken").mockResolvedValue({
      recipient_email: "invited@example.com",
    });
    vi.spyOn(authApi, "registerUser").mockRejectedValue(
      new Error("Email already registered."),
    );

    renderRegister();
    await screen.findByDisplayValue("invited@example.com");

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/could not connect to the server/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith("/login?registered=true");
  });

  // Verify the remaining password strength rules. The uppercase rule is
  // covered by its own test above.
  it.each([
    ["shorter than 8 characters", "Ab1!", /at least 8 characters/i],
    ["missing a lowercase letter", "STR0NGPASS!", /at least one lowercase letter/i],
    ["missing a number", "StrongPass!", /at least one number/i],
    ["missing a special character", "Str0ngPass1", /at least one special character/i],
  ])("rejects a password %s", async (_label, password, expected) => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(authApi, "registerUser");
    await renderWithValidToken();

    await submitWithPassword(user, password);

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  // Verify the required-name guards.
  it("shows an error when the first name is blank", async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(authApi, "registerUser");
    await renderWithValidToken();

    await user.type(screen.getByPlaceholderText(/last name/i), "Lovelace");
    await user.type(screen.getByPlaceholderText(/^password/i), GOOD_PASSWORD);
    await user.type(
      screen.getByPlaceholderText(/confirm password/i),
      GOOD_PASSWORD,
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/first name is required/i),
    ).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it("shows an error when the last name is blank", async () => {
    const user = userEvent.setup();
    const registerSpy = vi.spyOn(authApi, "registerUser");
    await renderWithValidToken();

    await user.type(screen.getByPlaceholderText(/first name/i), "Ada");
    await user.type(screen.getByPlaceholderText(/^password/i), GOOD_PASSWORD);
    await user.type(
      screen.getByPlaceholderText(/confirm password/i),
      GOOD_PASSWORD,
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/last name is required/i),
    ).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  // Verify the optional middle name is passed through when supplied.
  it("includes the middle name in the registration payload", async () => {
    const user = userEvent.setup();
    const registerSpy = vi
      .spyOn(authApi, "registerUser")
      .mockResolvedValue({ message: "ok" });
    await renderWithValidToken();

    await user.type(screen.getByPlaceholderText(/middle name/i), "Quinn");
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ middleName: "Quinn" }),
      );
    });
  });

  // Verify both navigation buttons.
  it("navigates to login from the invalid-token screen", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "validateInviteToken").mockRejectedValue(
      new Error("This invitation link has expired."),
    );

    renderRegister();

    await user.click(
      await screen.findByRole("button", { name: /back to login/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("navigates to login when Back is clicked on the form", async () => {
    const user = userEvent.setup();
    await renderWithValidToken();

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});