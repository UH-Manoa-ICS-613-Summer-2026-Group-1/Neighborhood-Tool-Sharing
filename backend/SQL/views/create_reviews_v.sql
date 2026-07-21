CREATE OR REPLACE VIEW reviews_v AS
SELECT
    reviews.id AS review_id,
    reviews.reservation_id,
    reviews.reviewee_id,
    reviewee.first_name AS reviewee_first_name,
    reviewee.last_name AS reviewee_last_name,
    reviewee.middle_name AS reviewee_middle_name,
    reviewee_photo.url AS reviewee_photo_url,
    reviews.reviewer_id,
    reviewer.first_name AS reviewer_first_name,
    reviewer.last_name AS reviewer_last_name,
    reviewer.middle_name AS reviewer_middle_name,
    reviewer_photo.url AS reviewer_photo_url,
    reviews.rating,
    reviews.comment,
    reviews.created_at
FROM reviews
JOIN users AS reviewer ON reviews.reviewer_id = reviewer.id
LEFT JOIN photos AS reviewer_photo ON reviewer.photo_id = reviewer_photo.id
JOIN users AS reviewee ON reviews.reviewee_id = reviewee.id
LEFT JOIN photos AS reviewee_photo ON reviewee.photo_id = reviewee_photo.id;
COMMENT ON VIEW reviews_v IS 'View for reviews';
COMMENT ON COLUMN reviews_v.review_id IS 'Unique identifier for each review';
COMMENT ON COLUMN reviews_v.reservation_id IS 'Unique identifier for the reservation associated with the review';
COMMENT ON COLUMN reviews_v.reviewee_id IS 'Unique identifier for the user being reviewed';
COMMENT ON COLUMN reviews_v.reviewee_first_name IS 'First name of the user being reviewed';
COMMENT ON COLUMN reviews_v.reviewee_last_name IS 'Last name of the user being reviewed';
COMMENT ON COLUMN reviews_v.reviewee_middle_name IS 'Middle name of the user being reviewed';
COMMENT ON COLUMN reviews_v.reviewee_photo_url IS 'The image url of the user being reviewed';
COMMENT ON COLUMN reviews_v.reviewer_id IS 'Unique identifier for the user who wrote the review';
COMMENT ON COLUMN reviews_v.reviewer_first_name IS 'First name of the user who wrote the review';
COMMENT ON COLUMN reviews_v.reviewer_last_name IS 'Last name of the user who wrote the review';
COMMENT ON COLUMN reviews_v.reviewer_middle_name IS 'Middle name of the user who wrote the review';
COMMENT ON COLUMN reviews_v.reviewer_photo_url IS 'The image url of the user who wrote the review';
COMMENT ON COLUMN reviews_v.rating IS 'The rating given by the reviewer';
COMMENT ON COLUMN reviews_v.comment IS 'The content of the review';
COMMENT ON COLUMN reviews_v.created_at IS 'Date and time when the review was created';
