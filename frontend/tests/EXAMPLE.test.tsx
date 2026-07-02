import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/EXAMPLE.App";

describe("App", () => {
  it("displays the project heading", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /neighborhood Tool Sharing App/i,
      }),
    ).toBeInTheDocument();
  });

  it("displays the subheading text", () => {
    render(<App />);

    expect(
      screen.getByText(/frontend qa and devOps prototype/i),
    ).toBeInTheDocument();
  });

});