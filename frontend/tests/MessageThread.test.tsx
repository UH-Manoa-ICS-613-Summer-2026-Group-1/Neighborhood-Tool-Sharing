// tests/MessageThread.test.tsx
// Vitest tests for the MessageThread page.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import MessageThread from "../src/pages/Messages/MessageThread";
import * as usersApi from "../src/api/users";
import * as reservationsApi from "../src/api/reservations";
import * as messagesApi from "../src/api/messages";
import type { UserProfile } from "../src/api/users";
import type { ReservationDetails } from "../src/api/reservations";
import type { ChatMessage } from "../src/api/messages";

// Mock navigate; keep MemoryRouter, Routes, Route and useParams real so the
// reservationId route param resolves naturally.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Stub Navbar
vi.mock("../src/components/Navbar", () => ({
  default: () => <nav data-testid="navbar" />,
}));

// Current user is the borrower; the owner (Jane Doe) is the other party.
const currentUser: UserProfile = {
  user_id: "user-1",
  user_first_name: "John",
  user_last_name: "Smith",
  user_middle_name: null,
  user_email: "john@example.com",
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

const makeReservation = (
  overrides: Partial<ReservationDetails> = {},
): ReservationDetails => ({
  reservation_id: "res-1",
  reservation_status: "APPROVED",
  reservation_start_date: "2026-07-22T00:00:00Z",
  reservation_end_date: "2026-07-23T23:59:59Z",
  reservation_loan_duration_limit: 7,
  reservation_pickup_notes: null,
  reservation_return_notes: null,
  reservation_created_at: "2026-07-21T00:00:00Z",
  tool_id: "tool-1",
  tool_title: "DeWalt Drill",
  tool_description: "Great drill.",
  tool_condition: "GOOD",
  tool_type_id: 1,
  tool_type_code: "POWER_TOOLS",
  tool_type_name: "Power Tools",
  borrower_id: "user-1",
  borrower_first_name: "John",
  borrower_last_name: "Smith",
  borrower_middle_name: null,
  owner_id: "user-2",
  owner_first_name: "Jane",
  owner_last_name: "Doe",
  owner_middle_name: null,
  tool_photos: [],
  ...overrides,
});

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  reservation_id: "res-1",
  sender_id: "user-2",
  content: "Ready for pickup!",
  is_read: true,
  created_at: "2026-07-22T10:00:00Z",
  ...overrides,
});

function renderMessageThread(path = "/reservations/res-1/messages") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/reservations/:reservationId/messages"
          element={<MessageThread />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MessageThread", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    // jsdom does not implement scrollIntoView; the auto-scroll effect uses it.
    Element.prototype.scrollIntoView = vi.fn();

    vi.spyOn(usersApi, "fetchCurrentUser").mockResolvedValue(currentUser);
    vi.spyOn(reservationsApi, "fetchReservationById").mockResolvedValue(
      makeReservation(),
    );
    vi.spyOn(messagesApi, "fetchMessages").mockResolvedValue([makeMessage()]);
    vi.spyOn(messagesApi, "sendMessage").mockResolvedValue(
      makeMessage({ id: "m2", sender_id: "user-1", content: "hello" }),
    );
  });

  // Verify the header, other participant, and messages render.
  it("renders the tool title, the other participant, and the messages", async () => {
    renderMessageThread();

    expect(await screen.findByText("DeWalt Drill")).toBeInTheDocument();
    expect(
      screen.getByText(/conversation with jane doe/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Ready for pickup!")).toBeInTheDocument();
  });

  // Verify the empty state when there are no messages.
  it("shows the empty state when there are no messages", async () => {
    vi.spyOn(messagesApi, "fetchMessages").mockResolvedValue([]);
    renderMessageThread();
    expect(await screen.findByText(/no messages yet/i)).toBeInTheDocument();
  });

  // Verify own messages align right and the other party's align left.
  it("aligns own messages right and the other party left", async () => {
    vi.spyOn(messagesApi, "fetchMessages").mockResolvedValue([
      makeMessage({ id: "m1", sender_id: "user-2", content: "from them" }),
      makeMessage({ id: "m2", sender_id: "user-1", content: "from me" }),
    ]);
    renderMessageThread();

    const theirs = await screen.findByText("from them");
    const mine = screen.getByText("from me");
    expect(theirs.closest(".justify-start")).not.toBeNull();
    expect(mine.closest(".justify-end")).not.toBeNull();
  });

  // Verify Send is disabled until there is a non-empty draft.
  it("disables Send until there is a non-empty draft", async () => {
    renderMessageThread();
    await screen.findByText("DeWalt Drill");

    const sendBtn = screen.getByRole("button", { name: "Send" });
    expect(sendBtn).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText(/type a message/i),
      "hi",
    );
    expect(sendBtn).toBeEnabled();
  });

  // Verify sending posts the message, appends it, and clears the draft.
  it("sends a message, appends it, and clears the draft", async () => {
    const user = userEvent.setup();
    renderMessageThread();
    const box = await screen.findByPlaceholderText(/type a message/i);

    await user.type(box, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(messagesApi.sendMessage).toHaveBeenCalledWith("res-1", {
        content: "hello",
      });
    });
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  // Verify a send failure surfaces the backend error.
  it("surfaces a send error and keeps the thread usable", async () => {
    const user = userEvent.setup();
    vi.spyOn(messagesApi, "sendMessage").mockRejectedValue(
      new Error("You cannot send messages for finished reservations."),
    );
    renderMessageThread();

    await user.type(
      await screen.findByPlaceholderText(/type a message/i),
      "late note",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(
        /cannot send messages for finished reservations/i,
      ),
    ).toBeInTheDocument();
  });

  // Verify a load failure shows an error and hides the composer.
  it("shows an error and hides the composer when loading fails", async () => {
    vi.spyOn(messagesApi, "fetchMessages").mockRejectedValue(
      new Error("Not authorized to view messages."),
    );
    renderMessageThread();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not authorized to view messages/i,
    );
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();
  });

  // Verify the back link returns toward the transactions view.
  it("navigates back toward transactions from the back link", async () => {
    const user = userEvent.setup();
    renderMessageThread();
    await screen.findByText("DeWalt Drill");

    await user.click(
      screen.getByRole("button", { name: /back to transactions/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard"),
    );
  });
});