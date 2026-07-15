CREATE OR REPLACE VIEW reservations_v AS
SELECT
    reservations.id AS reservation_id,
    reservations.status AS reservation_status,
    reservations.start_date AS reservation_start_date,
    reservations.end_date AS reservation_end_date,
    reservations.loan_duration_limit AS reservation_loan_duration_limit,
    reservations.pickup_notes AS reservation_pickup_notes,
    reservations.return_notes AS reservation_return_notes,
    reservations.created_at AS reservation_created_at,
    reservations.tool_id,
    tools.title AS tool_title,
    tools.description AS tool_description,
    tools.condition AS tool_condition,
    tools.tool_type_id,
    tool_types.code AS tool_type_code,
    tool_types.display_name AS tool_type_name,
    reservations.borrower_id,
    borrower_user.first_name AS borrower_first_name,
    borrower_user.last_name AS borrower_last_name,
    borrower_user.middle_name AS borrower_middle_name,
    tools.owner_id,
    owner_user.first_name AS owner_first_name,
    owner_user.last_name AS owner_last_name,
    owner_user.middle_name AS owner_middle_name,
    COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', photos.id,
                'url', photos.url
            )
        ) FILTER (WHERE photos.id IS NOT NULL),
        '[]'::jsonb
    ) AS tool_photos
FROM reservations
JOIN tools ON reservations.tool_id = tools.id
JOIN tool_types ON tools.tool_type_id = tool_types.id
JOIN users AS borrower_user ON reservations.borrower_id = borrower_user.id
JOIN users AS owner_user ON tools.owner_id = owner_user.id
LEFT JOIN tool_photos ON tools.id = tool_photos.tool_id
LEFT JOIN photos ON tool_photos.photo_id = photos.id
GROUP BY
    reservations.id,
    tools.id,
    tool_types.id,
    borrower_user.id,
    owner_user.id;
COMMENT ON VIEW reservations_v IS 'View for reservations';
COMMENT ON COLUMN reservations_v.reservation_id IS 'Unique identifier for a reservation';
COMMENT ON COLUMN reservations_v.tool_id IS 'Unique identifier for a tool';
COMMENT ON COLUMN reservations_v.borrower_id IS 'Unique identifier for a user requesting a tool';
COMMENT ON COLUMN reservations_v.owner_id IS 'Unique identifier for a tool owner';
COMMENT ON COLUMN reservations_v.reservation_loan_duration_limit IS 'Maximum number of days the tool can be 
loaned for (can be differ from tools.loan_duration_limit since the user can modify this attribute independently)';
COMMENT ON COLUMN reservations_v.reservation_pickup_notes IS 'Instructions for picking up the tool; can be differ
 from tools.pickup_notes since the user can modify this attribute independently';
COMMENT ON COLUMN reservations_v.reservation_return_notes IS 'Instructions for returning the tool; can be differ 
from tools.return_notes since the user can modify this attribute independently';
COMMENT ON COLUMN reservations_v.reservation_status IS 'The current status of the reservation';
COMMENT ON COLUMN reservations_v.reservation_start_date IS 'Planned calendar reservation start date';
COMMENT ON COLUMN reservations_v.reservation_end_date IS 'Planned calendar reservation return date';
COMMENT ON COLUMN reservations_v.reservation_created_at IS 'Date and time the reservation was created';
COMMENT ON COLUMN reservations_v.tool_title IS 'Name of the tool provided by the owner';
COMMENT ON COLUMN reservations_v.tool_description IS 'Details description of the tool provided by the owner';
COMMENT ON COLUMN reservations_v.tool_condition IS 'The condition of the tool provided by the owner';
COMMENT ON COLUMN reservations_v.borrower_first_name IS 'First name of the user requesting the tool';
COMMENT ON COLUMN reservations_v.borrower_last_name IS 'Last name of the user requesting the tool';
COMMENT ON COLUMN reservations_v.borrower_middle_name IS 'Optional middle name of the user requesting the tool';
COMMENT ON COLUMN reservations_v.owner_first_name IS 'First name of the tool owner';
COMMENT ON COLUMN reservations_v.owner_last_name IS 'Last name of the tool owner';
COMMENT ON COLUMN reservations_v.owner_middle_name IS 'Optional middle name of the tool owner';
COMMENT ON COLUMN reservations_v.tool_photos IS 'JSON Array object of tool photos {id, url}';
COMMENT ON COLUMN reservations_v.tool_type_id IS 'Identifier for the tool type';
COMMENT ON COLUMN reservations_v.tool_type_code IS 'Uppercase code name of the tool category (e.g., "POWER_TOOLS")';
COMMENT ON COLUMN reservations_v.tool_type_name IS 'Human-readable tool category for UI display';
