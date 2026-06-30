CREATE OR REPLACE VIEW user_profiles_v AS
SELECT
    users.id AS user_id,
    users.name AS user_name,
    users.email AS user_email,
    users.bio AS user_bio,
    users.location AS user_location,
    users.created_at AS user_created_at,
    photos.url AS user_photo_url,
    user_roles.code AS role_code,
    user_roles.display_name AS role_name,
    user_roles.description AS role_description,
    user_statuses.code AS status_code,
    user_statuses.display_name AS status_name,
    user_statuses.description AS status_description
FROM users
LEFT JOIN photos ON users.photo_id = photos.id
JOIN user_roles ON users.role_id = user_roles.id
JOIN user_statuses ON users.status_id = user_statuses.id;
COMMENT ON VIEW user_profiles_v IS 'View for user profiles';
COMMENT ON COLUMN user_profiles_v.user_id IS 'Unique identifier for each user';
COMMENT ON COLUMN user_profiles_v.user_name IS 'Full name of the user';
COMMENT ON COLUMN user_profiles_v.user_email IS 'User''s unique email address used for system login';
COMMENT ON COLUMN user_profiles_v.user_bio IS 'Brief personal bio or introduction written by the user';
COMMENT ON COLUMN user_profiles_v.user_location IS 'Location of the user';
COMMENT ON COLUMN user_profiles_v.user_created_at IS 'Date and time when the user account was created';
COMMENT ON COLUMN user_profiles_v.user_photo_url IS 'The address hosting the actual image file';
COMMENT ON COLUMN user_profiles_v.role_code IS 'Uppercase code name of the role (e.g., "USER", "ADMIN")';
COMMENT ON COLUMN user_profiles_v.role_name IS 'Human-readable role name for UI display';
COMMENT ON COLUMN user_profiles_v.role_description IS 'Explanation of permissions assigned to the role';
COMMENT ON COLUMN user_profiles_v.status_code IS 'Uppercase code name of the status (e.g., "ACTIVE", "SUSPENDED")';
COMMENT ON COLUMN user_profiles_v.status_name IS 'Human-readable status name for UI display';
COMMENT ON COLUMN user_profiles_v.status_description IS 'Explanation of what limitations the user status has';
