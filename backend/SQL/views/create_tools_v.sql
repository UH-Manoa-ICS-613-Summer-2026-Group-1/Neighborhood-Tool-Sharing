CREATE OR REPLACE VIEW tools_v AS
SELECT
    tools.id AS tool_id,
    tools.owner_id,
    users.first_name AS owner_first_name,
    users.last_name AS owner_last_name,
    users.middle_name AS owner_middle_name,
    tools.tool_type_id,
    tool_types.code AS tool_type_code,
    tool_types.display_name AS tool_type_name,
    tools.title AS tool_title,
    tools.description AS tool_description,
    tools.condition AS tool_condition,
    tools.pickup_notes AS tool_pickup_notes,
    tools.return_notes AS tool_return_notes,
    tools.loan_duration_limit AS tool_loan_duration_limit,
    tools.status AS tool_status,
    tools.created_at AS tool_created_at,
    COALESCE(
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', photos.id,
                'url', photos.url
            )
            ORDER BY tool_photos.id ASC
        ) FILTER (WHERE photos.id IS NOT NULL),
        '[]'::jsonb
    ) AS tool_photos
FROM tools
JOIN tool_types ON tools.tool_type_id = tool_types.id
JOIN users ON tools.owner_id = users.id
LEFT JOIN tool_photos ON tools.id = tool_photos.tool_id
LEFT JOIN photos ON tool_photos.photo_id = photos.id
WHERE tools.status != 'DELETED'
GROUP BY tools.id, tool_types.id, users.id;
COMMENT ON VIEW tools_v IS 'View for tool listings';
COMMENT ON COLUMN tools_v.tool_id IS 'Unique identifier for a tool';
COMMENT ON COLUMN tools_v.owner_id IS 'Identifier for the user who owns and shares the tool';
COMMENT ON COLUMN tools_v.owner_first_name IS 'First name of the tool owner';
COMMENT ON COLUMN tools_v.owner_last_name IS 'Last name of the tool owner';
COMMENT ON COLUMN tools_v.owner_middle_name IS 'Optional middle name of the tool owner';
COMMENT ON COLUMN tools_v.tool_type_id IS 'Identifier for the tool type';
COMMENT ON COLUMN tools_v.tool_type_code IS 'Uppercase code name of the tool category (e.g., "POWER_TOOLS")';
COMMENT ON COLUMN tools_v.tool_type_name IS 'Human-readable tool category for UI display';
COMMENT ON COLUMN tools_v.tool_title IS 'Name of the tool provided by the owner';
COMMENT ON COLUMN tools_v.tool_description IS 'Details description of the tool provided by the owner';
COMMENT ON COLUMN tools_v.tool_condition IS 'The condition of the tool provided by the owner';
COMMENT ON COLUMN tools_v.tool_pickup_notes IS 'Instructions for picking up the tool';
COMMENT ON COLUMN tools_v.tool_return_notes IS 'Instructions for returning the tool';
COMMENT ON COLUMN tools_v.tool_loan_duration_limit IS 'Maximum continuous days the user can request the tool';
COMMENT ON COLUMN tools_v.tool_status IS 'The current status of the tool';
COMMENT ON COLUMN tools_v.tool_created_at IS 'Date and time the tool was created';
COMMENT ON COLUMN tools_v.tool_photos IS 'JSON Array object of tool photos {id, url}';
