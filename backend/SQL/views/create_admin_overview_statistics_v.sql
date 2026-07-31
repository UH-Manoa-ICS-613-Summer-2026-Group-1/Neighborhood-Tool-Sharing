CREATE OR REPLACE VIEW admin_overview_statistics_v AS
SELECT
    -- Users
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM users JOIN user_statuses ON users.status_id = user_statuses.id
    WHERE user_statuses.code = 'ACTIVE') AS active_users,
    (SELECT COUNT(*) FROM users JOIN user_statuses ON users.status_id = user_statuses.id
    WHERE user_statuses.code = 'SUSPENDED') AS suspended_users,
    (SELECT COUNT(*) FROM users
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS new_users_this_month,
    -- Tools
    (SELECT COUNT(*) FROM tools) AS total_tools,
    (SELECT COUNT(*) FROM tools
    WHERE status = 'AVAILABLE') AS available_tools,
    (SELECT COUNT(*) FROM tools
    WHERE status = 'HIDDEN') AS hidden_tools,
    (SELECT COUNT(*) FROM tools
    WHERE status = 'SUSPENDED') AS suspended_tools,
    (SELECT COUNT(*) FROM tools
    WHERE status = 'DELETED') AS deleted_tools,
    (SELECT COUNT(*) FROM tools
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS new_tools_this_month,
    -- Reservations
    (SELECT COUNT(*) FROM reservations) AS total_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'REQUESTED') AS requested_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'APPROVED') AS approved_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'PICKED_UP') AS picked_up_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'RETURNED') AS completed_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'DENIED') AS denied_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE status = 'CANCELED') AS cancelled_reservations,
    (SELECT COUNT(*) FROM reservations
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS new_reservations_this_month;
COMMENT ON VIEW admin_overview_statistics_v IS 'Admin overview statistics view';
COMMENT ON COLUMN admin_overview_statistics_v.total_users IS 'Total number of users';
COMMENT ON COLUMN admin_overview_statistics_v.active_users IS 'Number of active users';
COMMENT ON COLUMN admin_overview_statistics_v.suspended_users IS 'Number of suspended users';
COMMENT ON COLUMN admin_overview_statistics_v.new_users_this_month IS 'Number of new users this month';
COMMENT ON COLUMN admin_overview_statistics_v.total_tools IS 'Total number of tools';
COMMENT ON COLUMN admin_overview_statistics_v.available_tools IS 'Number of available tools';
COMMENT ON COLUMN admin_overview_statistics_v.hidden_tools IS 'Number of hidden tools';
COMMENT ON COLUMN admin_overview_statistics_v.suspended_tools IS 'Number of suspended tools';
COMMENT ON COLUMN admin_overview_statistics_v.new_tools_this_month IS 'Number of new tools this month';
COMMENT ON COLUMN admin_overview_statistics_v.total_reservations IS 'Total number of reservations';
COMMENT ON COLUMN admin_overview_statistics_v.requested_reservations IS 'Number of requested reservations';
COMMENT ON COLUMN admin_overview_statistics_v.approved_reservations IS 'Number of approved reservations';
COMMENT ON COLUMN admin_overview_statistics_v.picked_up_reservations IS 'Number of picked up reservations';
COMMENT ON COLUMN admin_overview_statistics_v.completed_reservations IS 'Number of completed reservations';
COMMENT ON COLUMN admin_overview_statistics_v.denied_reservations IS 'Number of denied reservations';
COMMENT ON COLUMN admin_overview_statistics_v.cancelled_reservations IS 'Number of cancelled reservations';
COMMENT ON COLUMN admin_overview_statistics_v.new_reservations_this_month IS 'Number of new reservations this month';
