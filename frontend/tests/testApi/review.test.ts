// tests/testApi/review.test.ts
// Vitest unit tests for the reviews API client.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fetchReservationReviews,
  createReview,
  fetchUserReviews,
  type ReviewDetails,
} from "../../src/api/review";

const mockUserId = "user-123";  

// A minimal review fixture returned by the API.
const review: ReviewDetails = {
  review_id: "rev-1",
  reservation_id: "res-1",
  reviewee_id: "user-1",
  reviewee_first_name: "Jane",
  reviewee_last_name: "Doe",
  reviewee_middle_name: null,
  reviewee_photo_url: null,
  reviewer_id: "user-2",
  reviewer_first_name: "John",
  reviewer_last_name: "Smith",
  reviewer_middle_name: null,
  reviewer_photo_url: null,
  rating: 4,
  comment: "Great borrower",
  created_at: "2026-07-24T00:00:00Z",
};

// Build a fake Response with a given ok flag and JSON body.
const jsonResponse = (ok: boolean, body: unknown) => ({
  ok,
  json: async () => body,
});

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  localStorage.setItem("access_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("fetchReservationReviews", () => {
  it("GETs the reviews endpoint with auth headers and returns the data", async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, [review]));

    const result = await fetchReservationReviews("res-1");

    expect(result).toEqual([review]);
    expect(mockFetch).toHaveBeenCalledWith("/api/reservations/res-1/reviews", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
    });
  });

  it("throws the backend's string detail on failure", async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, { detail: "Not allowed." }));
    await expect(fetchReservationReviews("res-1")).rejects.toThrow("Not allowed.");
  });

  it("throws the fallback message when no detail is present", async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, {}));
    await expect(fetchReservationReviews("res-1")).rejects.toThrow(
      "Failed to load reviews.",
    );
  });

  it("sends 'Bearer null' when no token is stored", async () => {
    localStorage.clear();
    mockFetch.mockResolvedValue(jsonResponse(true, []));

    await fetchReservationReviews("res-1");

    expect(mockFetch).toHaveBeenCalledWith("/api/reservations/res-1/reviews", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer null",
      },
    });
  });
});

describe("createReview", () => {
  it("POSTs the payload as JSON with auth headers and returns the review", async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, review));

    const result = await createReview("res-1", { rating: 4, comment: "Nice" });

    expect(result).toEqual(review);
    expect(mockFetch).toHaveBeenCalledWith("/api/reservations/res-1/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ rating: 4, comment: "Nice" }),
    });
  });

  it("throws the first message from a Pydantic array detail (422)", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(false, { detail: [{ msg: "rating is required" }] }),
    );
    await expect(createReview("res-1", { rating: 0 })).rejects.toThrow(
      "rating is required",
    );
  });

  it("falls back when the array detail has no msg", async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, { detail: [{}] }));
    await expect(createReview("res-1", { rating: 3 })).rejects.toThrow(
      "Failed to submit review.",
    );
  });

  it("throws the fallback message when the response has no detail", async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, {}));
    await expect(createReview("res-1", { rating: 3 })).rejects.toThrow(
      "Failed to submit review.",
    );
  });
});

describe("fetchUserReviews", () => {
  it("fetches user reviews successfully", async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, [review]));

    const reviews = await fetchUserReviews(mockUserId);

    expect(reviews).toEqual([review]);
    expect(mockFetch).toHaveBeenCalledWith(`/api/users/${mockUserId}/reviews`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
    });
  });

  it("returns an empty array when the user has no reviews", async () => {
    mockFetch.mockResolvedValue(jsonResponse(true, []));

    const reviews = await fetchUserReviews(mockUserId);

    expect(reviews).toEqual([]);
  });

  it("throws backend detail on non-200 responses", async () => {
    mockFetch.mockResolvedValue(jsonResponse(false, { detail: "User not found." }));

    await expect(fetchUserReviews(mockUserId)).rejects.toThrow("User not found.");
  });

  it("throws an error on failure", async () => {
    mockFetch.mockRejectedValue(new Error("Could not load reviews."));

    await expect(fetchUserReviews(mockUserId)).rejects.toThrow("Could not load reviews.");
  });
});