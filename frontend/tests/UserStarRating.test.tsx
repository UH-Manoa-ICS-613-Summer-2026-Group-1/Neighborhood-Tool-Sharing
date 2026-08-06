import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UserStarRating from "../src/components/UserStarRating";
import * as reviewApi from "../src/api/review";
import type { ReviewDetails } from "../src/api/review";

const mockUserId = "user-123";

const mockReviews: ReviewDetails[] = [
  {
    review_id: "rev-1",
    reservation_id: "res-1",
    reviewee_id: mockUserId,
    reviewee_first_name: "Jane",
    reviewee_last_name: "Doe",
    reviewee_middle_name: null,
    reviewee_photo_url: null,
    reviewer_id: "user-456",
    reviewer_first_name: "John",
    reviewer_last_name: "Smith",
    reviewer_middle_name: null,
    reviewer_photo_url: null,
    rating: 5,
    comment: "Great experience!",
    created_at: "2026-07-20T00:00:00Z",
  },
  {
    review_id: "rev-2",
    reservation_id: "res-2",
    reviewee_id: mockUserId,
    reviewee_first_name: "Jane",
    reviewee_last_name: "Doe",
    reviewee_middle_name: null,
    reviewee_photo_url: null,
    reviewer_id: "user-789",
    reviewer_first_name: "Bob",
    reviewer_last_name: "Builder",
    reviewer_middle_name: null,
    reviewer_photo_url: null,
    rating: 3,
    comment: "Decent borrower.",
    created_at: "2026-07-21T00:00:00Z",
  },
];

describe("UserStarRating Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates and displays average star rating and review count", async () => {
    vi.spyOn(reviewApi, "fetchUserReviews").mockResolvedValue(mockReviews);

    render(<UserStarRating userId={mockUserId} showCount={true} />);

    await waitFor(() => {
      expect(screen.getByText("4.0")).toBeInTheDocument();
    });

    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(reviewApi.fetchUserReviews).toHaveBeenCalledWith(mockUserId);
  });

  it("renders 'No reviews yet' state when user has zero reviews", async () => {
    vi.spyOn(reviewApi, "fetchUserReviews").mockResolvedValue([]);

    render(<UserStarRating userId={mockUserId} showCount={true} />);

    await waitFor(() => {
      expect(screen.getByText(/No reviews yet/i)).toBeInTheDocument();
    });
  });

  it("handles API error without crashing", async () => {
    vi.spyOn(reviewApi, "fetchUserReviews").mockRejectedValue(
      new Error("Failed to fetch reviews")
    );

    render(<UserStarRating userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.queryByText("4.0")).not.toBeInTheDocument();
    });
  });

  it("hides review count when showCount is false or omitted", async () => {
    vi.spyOn(reviewApi, "fetchUserReviews").mockResolvedValue(mockReviews);

    render(<UserStarRating userId={mockUserId} showCount={false} />);

    await waitFor(() => {
      expect(screen.getByText("4.0")).toBeInTheDocument();
    });

    expect(screen.queryByText("(2)")).not.toBeInTheDocument();
  });
});