import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SendInvite from "../src/pages/Invite/SendInvite";
import * as invitationsApi from "../src/api/invitations";

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

describe("SendInvite", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  // Verify the form renders.
  it("renders the email field and submit button", () => {
    render(<SendInvite />);

    expect(
      screen.getByPlaceholderText(/neighbor@example\.com/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send invite/i }),
    ).toBeInTheDocument();
  });

  // Verify the Back button returns to the dashboard.
  it("navigates back to the dashboard when Back is clicked", async () => {
    const user = userEvent.setup();
    render(<SendInvite />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  // Verify client-side email validation blocks the API call.
  it("shows a validation error for an invalid email", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(invitationsApi, "sendInvite");

    render(<SendInvite />);

    await user.type(
      screen.getByPlaceholderText(/neighbor@example\.com/i),
      "not-an-email",
    );
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(
      await screen.findByText(/please enter a valid email address/i),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  // Verify a successful invite shows the confirmation and clears the form.
  it("shows the success message and clears the input on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "sendInvite").mockResolvedValue({
      message: "Invitation sent to friend@example.com",
    });

    render(<SendInvite />);

    const input = screen.getByPlaceholderText(/neighbor@example\.com/i);
    await user.type(input, "friend@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(
      await screen.findByText(/invitation sent to friend@example\.com/i),
    ).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  // Verify a backend error is surfaced to the user.
  it("shows an error message when the API call fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(invitationsApi, "sendInvite").mockRejectedValue(
      new Error("An invitation is already pending for this email."),
    );

    render(<SendInvite />);

    await user.type(
      screen.getByPlaceholderText(/neighbor@example\.com/i),
      "friend@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(
      await screen.findByText(/an invitation is already pending/i),
    ).toBeInTheDocument();
  });

  // Verify the loading state while the request is pending.
  it("shows the loading state while submitting", async () => {
    const user = userEvent.setup();
    let resolveInvite: (value: { message: string }) => void = () => {};

    vi.spyOn(invitationsApi, "sendInvite").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvite = resolve;
        }),
    );

    render(<SendInvite />);

    await user.type(
      screen.getByPlaceholderText(/neighbor@example\.com/i),
      "friend@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(
      screen.getByRole("button", { name: /sending/i }),
    ).toBeInTheDocument();

    resolveInvite({ message: "done" });
  });
});