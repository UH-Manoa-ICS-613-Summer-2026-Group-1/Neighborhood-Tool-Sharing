import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from 'react-router-dom';
import Login from "../src/pages/Login/Login";
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

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => {
    // Reset mocks and local storage before each test.
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // Verify the login form renders.
  it("renders the email and password fields", () => {
    renderLogin();

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  // Verify the Back button navigates to the home page.
  it("navigates back to home when Back is clicked", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  // Verify a successful login stores the token and redirects.
  it("calls loginUser, stores the token, and navigates to dashboard on success", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "loginUser").mockResolvedValue({
      access_token: "fake-token",
      token_type: "bearer",
    });

    renderLogin();

    await user.type(screen.getByPlaceholderText(/email/i), "test@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBe("fake-token");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  // Verify an error message is displayed when login fails.
  it("shows an error message when login fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(authApi, "loginUser").mockRejectedValue(
      new Error("Invalid credentials"),
    );

    renderLogin();

    await user.type(screen.getByPlaceholderText(/email/i), "test@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  // Verify the loading state appears while the login request is pending.
  it("shows the loading state while submitting", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: {
      access_token: string;
      token_type: string;
    }) => void = () => {};

    vi.spyOn(authApi, "loginUser").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    renderLogin();

    await user.type(screen.getByPlaceholderText(/email/i), "test@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(
      screen.getByRole("button", { name: /logging in/i }),
    ).toBeInTheDocument();

    // Resolve the pending promise to finish the test cleanly.
    resolveLogin({ access_token: "token", token_type: "bearer" });
  });

  // Verify the empty-field guard in handleSubmit. Both inputs are marked
  // `required`, so a real click is blocked by browser validation before the
  // handler runs — submitting the form directly is the only way to reach it.
  it("shows a validation error when the form is submitted empty", () => {
    const loginSpy = vi.spyOn(authApi, "loginUser");
    const { container } = renderLogin();

    fireEvent.submit(container.querySelector("form")!);

    expect(
      screen.getByText(/all fields are required/i),
    ).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });
});