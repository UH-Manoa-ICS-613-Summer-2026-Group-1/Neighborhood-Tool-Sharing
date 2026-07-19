import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ToolCard from "../src/components/ToolCard";
import type { ToolDetails } from "../src/api/tools";

// A reusable fixture matching the ToolDetails shape.
const baseTool: ToolDetails = {
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
  tool_pickup_notes: null,
  tool_return_notes: null,
  tool_loan_duration_limit: 7,
  tool_status: "AVAILABLE",
  tool_created_at: "2026-01-01T00:00:00Z",
  tool_photos: [{ id: "p1", url: "https://example.com/photo1.jpg" }],
};

describe("ToolCard", () => {
  // Verify the basic content renders.
  it("renders the title, category, description, and condition", () => {
    render(<ToolCard tool={baseTool} />);

    expect(screen.getByText("DeWalt 20V Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Power Tools")).toBeInTheDocument();
    expect(screen.getByText("Great drill, barely used.")).toBeInTheDocument();
    expect(screen.getByText("GOOD")).toBeInTheDocument();
    expect(screen.getByText(/up to 7 days/i)).toBeInTheDocument();
  });

  // Verify singular pluralization for a 1-day loan limit.
  it("uses singular 'day' when the loan limit is 1", () => {
    render(<ToolCard tool={{ ...baseTool, tool_loan_duration_limit: 1 }} />);

    expect(screen.getByText(/up to 1 day$/i)).toBeInTheDocument();
  });

  // Verify the cover photo renders with the title as alt text.
  it("renders the first photo as the cover image", () => {
    render(<ToolCard tool={baseTool} />);

    const img = screen.getByRole("img", {
      name: /dewalt 20v cordless drill/i,
    });
    expect(img).toHaveAttribute("src", "https://example.com/photo1.jpg");
  });

  // Verify the placeholder shows when there are no photos.
  it("shows the wrench placeholder when there are no photos", () => {
    render(<ToolCard tool={{ ...baseTool, tool_photos: [] }} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("🔧")).toBeInTheDocument();
  });

  // Verify the owner name only shows when showOwner is set.
  it("shows the owner name only when showOwner is true", () => {
    const { rerender } = render(<ToolCard tool={baseTool} />);
    expect(screen.queryByText(/shared by jane doe/i)).not.toBeInTheDocument();

    rerender(<ToolCard tool={baseTool} showOwner />);
    expect(screen.getByText(/shared by jane doe/i)).toBeInTheDocument();
  });

  // Verify the status badge only shows when showStatus is set.
  it("shows the status badge only when showStatus is true", () => {
    const { rerender } = render(<ToolCard tool={baseTool} />);
    expect(screen.queryByText("AVAILABLE")).not.toBeInTheDocument();

    rerender(<ToolCard tool={baseTool} showStatus />);
    expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
  });

  // Verify clicking the card calls onClick with the tool id.
  it("calls onClick with the tool id when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<ToolCard tool={baseTool} onClick={onClick} />);

    await user.click(
      screen.getByRole("button", { name: /dewalt 20v cordless drill/i }),
    );

    expect(onClick).toHaveBeenCalledWith("tool-1");
  });
});