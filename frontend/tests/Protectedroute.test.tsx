import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import ProtectedRoute from "../src/components/ProtectedRoute";

// Renders a tiny route tree so we can observe where the router lands.
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Login Page</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<p>Dashboard Page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Verify unauthenticated users are redirected to the login page.
  it("redirects to /login when no access token is stored", () => {
    renderAt("/dashboard");

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
  });

  // Verify authenticated users can access the protected content.
  it("renders the protected page when an access token exists", () => {
    localStorage.setItem("access_token", "some-token");

    renderAt("/dashboard");

    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});