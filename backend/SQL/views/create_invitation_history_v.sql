CREATE OR REPLACE VIEW invitation_history_v AS
SELECT
    id AS invitation_id,
    sender_id,
    recipient_email,
    recipient_id,
    created_at,
    expires_at,
    CASE
        WHEN status = 'PENDING' AND CURRENT_TIMESTAMP > expires_at THEN 'EXPIRED'
        ELSE status
    END AS status
FROM invitations;
COMMENT ON VIEW invitation_history_v IS 'View for invitation history';
COMMENT ON COLUMN invitation_history_v.invitation_id IS 'Unique identifier for each invitation';
COMMENT ON COLUMN invitation_history_v.sender_id IS 'Identifier for the user who sent the invitation';
COMMENT ON COLUMN invitation_history_v.recipient_email IS 'Target email address the invite was sent to';
COMMENT ON COLUMN invitation_history_v.recipient_id IS 'Identifier for the user who accepted the invitation';
COMMENT ON COLUMN invitation_history_v.created_at IS 'Date and time the invite link was created';
COMMENT ON COLUMN invitation_history_v.expires_at IS 'Date and time the invite link is expired';
COMMENT ON COLUMN invitation_history_v.status IS 'The current status of the invite token';
