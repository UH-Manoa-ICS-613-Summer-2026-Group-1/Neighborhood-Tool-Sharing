import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AddTool from "../src/pages/Tools/AddTool";
import * as toolsApi from "../src/api/tools";
import * as mediaApi from "../src/api/media";

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

const toolTypes = [
  { id: 1, code: "POWER_TOOLS", display_name: "Power Tools", description: null },
  { id: 2, code: "GARDEN", display_name: "Garden", description: null },
];
const conditions = ["NEW", "GOOD", "FAIR", "POOR"];

// jsdom does not implement createObjectURL; stub it for photo previews.
beforeEach(() => {
  window.URL.createObjectURL = vi.fn(() => "blob:preview-url");
  window.URL.revokeObjectURL = vi.fn();
});

// Helper: attach a fake image file to the photo input.
async function addPhoto(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["fake-bytes"], "drill.jpg", { type: "image/jpeg" });
  // The file input has no label, so query it by its DOM type.
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await user.upload(input, file);
  return file;
}

// Helper: fill in all required fields with valid values.
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(/title/i),
    "DeWalt 20V Cordless Drill",
  );
  await user.selectOptions(screen.getByLabelText(/category/i), "POWER_TOOLS");
  await user.selectOptions(screen.getByLabelText(/condition/i), "GOOD");
  await user.type(
    screen.getByLabelText(/description/i),
    "Great drill, barely used.",
  );
  await addPhoto(user);
}

describe("AddTool", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    vi.spyOn(toolsApi, "fetchToolTypes").mockResolvedValue(toolTypes);
    vi.spyOn(toolsApi, "fetchToolConditions").mockResolvedValue(conditions);
  });

  // Verify the lookups load and populate the dropdowns.
  it("loads categories and conditions into the dropdowns", async () => {
    render(<AddTool />);

    expect(await screen.findByLabelText(/category/i)).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Power Tools" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Garden" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "GOOD" })).toBeInTheDocument();
  });

  // Verify a lookup failure shows an error.
  it("shows an error when the form options fail to load", async () => {
    vi.spyOn(toolsApi, "fetchToolTypes").mockRejectedValue(
      new Error("Failed to load tool categories."),
    );

    render(<AddTool />);

    expect(
      await screen.findByText(/failed to load tool categories/i),
    ).toBeInTheDocument();
  });

  // Verify validation: category is required.
  it("shows an error when no category is chosen", async () => {
    const user = userEvent.setup();
    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    await user.type(screen.getByLabelText(/title/i), "My Drill");
    await addPhoto(user); // enables the submit button
    await user.click(screen.getByRole("button", { name: /publish tool/i }));

    expect(
      await screen.findByText(/please choose a tool category/i),
    ).toBeInTheDocument();
  });

  // Verify validation: title length.
  it("shows an error when the title is too short", async () => {
    const user = userEvent.setup();
    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    await user.selectOptions(screen.getByLabelText(/category/i), "POWER_TOOLS");
    await user.type(screen.getByLabelText(/title/i), "ab");
    await addPhoto(user);
    await user.click(screen.getByRole("button", { name: /publish tool/i }));

    expect(
      await screen.findByText(/title must be between 3 and 255 characters/i),
    ).toBeInTheDocument();
  });

  // Verify the submit button stays disabled with no photos.
  it("disables the publish button when there are no photos", async () => {
    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    expect(
      screen.getByRole("button", { name: /publish tool/i }),
    ).toBeDisabled();
  });

  // Verify the happy path: photos upload, tool is created, user is redirected.
  it("uploads photos, creates the tool, and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    vi.spyOn(mediaApi, "uploadPhoto").mockResolvedValue(
      "https://storage.example.com/drill.jpg",
    );
    const createSpy = vi.spyOn(toolsApi, "createTool").mockResolvedValue({
      id: "tool-1",
      tool_type_id: 1,
      title: "DeWalt 20V Cordless Drill",
      description: "Great drill, barely used.",
      condition: "GOOD",
      photos: [],
      pickup_notes: null,
      return_notes: null,
      loan_duration_limit: 7,
      status: "AVAILABLE",
      created_at: "2026-01-01T00:00:00Z",
    });

    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /publish tool/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_type_code: "POWER_TOOLS",
          title: "DeWalt 20V Cordless Drill",
          condition: "GOOD",
          photo_urls: ["https://storage.example.com/drill.jpg"],
          loan_duration_limit: 7,
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
      state: { toolCreated: "DeWalt 20V Cordless Drill" },
    });
  });

  // Verify a failed creation shows the backend error and re-enables the form.
  it("shows an error when publishing fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(mediaApi, "uploadPhoto").mockResolvedValue(
      "https://storage.example.com/drill.jpg",
    );
    vi.spyOn(toolsApi, "createTool").mockRejectedValue(
      new Error("Failed to create tool listing."),
    );

    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /publish tool/i }));

    expect(
      await screen.findByText(/failed to create tool listing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publish tool/i }),
    ).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "/dashboard",
      expect.anything(),
    );
  });

  // Verify a photo can be removed before submitting.
  it("removes a photo when the delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<AddTool />);
    await screen.findByLabelText(/category/i);

    await addPhoto(user);
    expect(screen.getByText(/photos \(1\/5\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove photo 1/i }));

    expect(screen.getByText(/photos \(0\/5\)/i)).toBeInTheDocument();
  });
});