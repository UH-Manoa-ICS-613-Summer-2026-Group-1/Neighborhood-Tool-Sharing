// tests/NotificationBell.test.tsx
// Vitest tests for the NotificationBell navbar component.
// Rows are display-only; the "Mark all read" button is the only action.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NotificationBell from "../src/components/NotificationBell";
import * as notificationsApi from "../src/api/notifications";
import type { NotificationItem } from "../src/api/notifications";

// Notification fixture; unread and "just now" by default.
const makeNotification = (
  overrides: Partial<NotificationItem> = {},
): NotificationItem => ({
  id: "n1",
  recipient_id: "user-1",
  category: "RESERVATION",
  title: "Reservation approved",
  content: "Your request for the Drill was approved.",
  target_id: "res-1",
  target_type: "RESERVATION",
  is_read: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

// A timestamp `ms` milliseconds in the past.
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Sensible defaults; individual tests override as needed.
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(0);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([]);
    vi.spyOn(notificationsApi, "markAllNotificationsRead").mockResolvedValue(
      undefined,
    );
  });

  // Verify the badge reflects the unread-count endpoint.
  it("shows the unread badge from the count endpoint", async () => {
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(3);
    render(<NotificationBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  // Verify the badge is capped at 9+.
  it("caps the badge at 9+", async () => {
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(42);
    render(<NotificationBell />);
    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  // Verify no badge renders when there are zero unread.
  it("shows no badge when there are zero unread", async () => {
    render(<NotificationBell />);
    await waitFor(() =>
      expect(notificationsApi.fetchUnreadCount).toHaveBeenCalled(),
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  // Verify the badge is left unchanged when the count fetch fails.
  it("keeps the badge unchanged when the count fetch fails", async () => {
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockRejectedValue(
      new Error("offline"),
    );
    render(<NotificationBell />);
    await waitFor(() =>
      expect(notificationsApi.fetchUnreadCount).toHaveBeenCalled(),
    );
    // Nothing threw, and with the fetch failed the count stays at 0 (no badge).
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  // Verify opening the panel loads and lists notifications.
  it("loads and lists notifications when the panel opens", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(1);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification(),
    ]);

    render(<NotificationBell />);
    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );

    expect(
      await screen.findByText("Reservation approved"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your request for the Drill was approved."),
    ).toBeInTheDocument();
    expect(notificationsApi.fetchNotifications).toHaveBeenCalled();
  });

  // Verify relative timestamps for the minute, hour, and day branches.
  it("formats relative timestamps for minutes, hours, and days", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(3);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification({ id: "n1", title: "Minutes", created_at: isoAgo(5 * MINUTE) }),
      makeNotification({ id: "n2", title: "Hours", created_at: isoAgo(3 * HOUR) }),
      makeNotification({ id: "n3", title: "Days", created_at: isoAgo(2 * DAY) }),
    ]);

    render(<NotificationBell />);
    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );

    expect(await screen.findByText("5m")).toBeInTheDocument();
    expect(screen.getByText("3h")).toBeInTheDocument();
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  // Verify a "just now" label for very recent notifications.
  it("labels very recent notifications as 'just now'", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(1);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification({ created_at: isoAgo(5_000) }),
    ]);

    render(<NotificationBell />);
    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );

    expect(await screen.findByText(/just now/i)).toBeInTheDocument();
  });

  // Verify the empty state when there are no notifications.
  it("shows the empty state when there are no notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  // Verify the empty state also shows when loading the list fails.
  it("falls back to the empty state when loading the list fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchNotifications").mockRejectedValue(
      new Error("offline"),
    );

    render(<NotificationBell />);
    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );

    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  // Verify rows are display-only (not wrapped in a clickable button).
  it("renders rows as display-only", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(1);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification(),
    ]);

    render(<NotificationBell />);
    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );

    const row = await screen.findByText("Reservation approved");
    expect(row.closest("button")).toBeNull();
  });

  // Verify "Mark all read" calls the API and clears the badge.
  it("marks all read and clears the badge", async () => {
    const user = userEvent.setup();
    vi.spyOn(notificationsApi, "fetchUnreadCount").mockResolvedValue(2);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification(),
    ]);

    render(<NotificationBell />);
    expect(await screen.findByText("2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /mark all read/i }),
    );

    expect(notificationsApi.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText("2")).not.toBeInTheDocument(),
    );
  });

  // Verify a failed "Mark all read" re-syncs the badge from the server.
  it("re-fetches the count when marking all read fails", async () => {
    const user = userEvent.setup();
    // First call is the mount; the second is the refresh triggered by the catch.
    vi.spyOn(notificationsApi, "fetchUnreadCount")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue([
      makeNotification(),
    ]);
    vi.spyOn(notificationsApi, "markAllNotificationsRead").mockRejectedValue(
      new Error("server error"),
    );

    render(<NotificationBell />);
    expect(await screen.findByText("2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /view notifications/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /mark all read/i }),
    );

    // The optimistic clear is rolled back to the refreshed server count.
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(2);
  });
});