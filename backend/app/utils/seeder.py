"""
This module provides functions to seed data into the database.
It can be used in seeding scripts for development, testing, or production databases.
Seed include: lookup tables: user_roles, user_statuses; users table (users, admins)
"""

import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.utils.auth_helpers import get_password_hash


def run_lookup_seeds(db: Session):
    """
    Seed the lookup tables in the database with initial data.
    """
    # Seed user_roles
    db.execute(
        text("""
            INSERT INTO user_roles (code, display_name, description) VALUES
            ('USER', 'Member', 'Default application access'),
            ('ADMIN', 'Administrator', 'Full system control')
            ON CONFLICT (code) DO NOTHING;
        """)
    )

    # Seed user_statuses
    db.execute(
        text("""
            INSERT INTO user_statuses (code, display_name, description) VALUES
            ('ACTIVE', 'Active', 'Active user account'),
            ('SUSPENDED', 'Suspended', 'Suspended user account')
            ON CONFLICT (code) DO NOTHING;
        """)
    )

    # Seed tool_types
    db.execute(
        text("""
            INSERT INTO tool_types (code, display_name, description) VALUES
            ('POWER_TOOLS', 'Power Tools', 'Drills, saws, sanders, and other electrical equipment.'),
            ('GARDENING', 'Gardening & Outdoor', 'Lawnmowers, shovels, shears, and yard care tools.'),
            ('HAND_TOOLS', 'Hand Tools', 'Wrenches, hammers, screwdrivers, and manual implements.'),
            ('AUTOMOTIVE', 'Automotive', 'Car jacks, diagnostic scanners, and specialized vehicle tools.')
        ON CONFLICT (code) DO NOTHING;
        """)
    )

    db.commit()


def run_users_seeds(db: Session):
    """
    Seed the users table and users photos.
    """
    db.execute(
        text("""
            INSERT INTO photos (id, url) VALUES
            ('f0000001-0000-0000-0000-000100000001', 'https://images.unsplash.com/photo-1740252117070-7aa2955b25f8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000002', 'https://images.unsplash.com/photo-1740252117027-4275d3f84385?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000003', 'https://images.unsplash.com/photo-1740252117013-4fb21771e7ca?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000004', 'https://images.unsplash.com/photo-1740252117012-bb53ad05e370?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000005', 'https://images.unsplash.com/photo-1772371272141-0fbd644b65c4?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000006', 'https://images.unsplash.com/photo-1772371272228-f4a8247cfe6d?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000007', 'https://images.unsplash.com/photo-1751093383900-dbf2a79169f8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000100000008', 'https://images.unsplash.com/photo-1772371272208-412168748f2a?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')
            ON CONFLICT (id) DO NOTHING;
        """)
    )
    sql_query = text("""
        INSERT INTO users (first_name, last_name, middle_name, email, password, bio, location, status_id, role_id, photo_id) VALUES
        (
            'SeedFirst1', 'SeedLast1', NULL, 'seed1@example.com', :pass, 'Bio 1', 'Location 1',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER'),
            'f0000001-0000-0000-0000-000100000001'
        ),
        (
            'SeedFirst2', 'SeedLast2', 'MiddleA', 'seed2@example.com', :pass, 'Bio 2', NULL,
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER'),
            'f0000001-0000-0000-0000-000100000002'
        ),
        (
            'SeedFirst3', 'SeedLast3', NULL, 'seed3@example.com', :pass, NULL, 'Location 3',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER'),
            'f0000001-0000-0000-0000-000100000003'
        ),
        (
            'SeedFirst4', 'SeedLast4', NULL, 'seed4@example.com', :pass, 'Bio 4', 'Location 4',
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'USER'),
            'f0000001-0000-0000-0000-000100000004'
        ),
        (
            'SeedFirst5', 'SeedLast5', 'MiddleB', 'seed5@example.com', :pass, 'Bio 5', 'Location 5',
            (SELECT id FROM user_statuses WHERE code = 'SUSPENDED'),
            (SELECT id FROM user_roles WHERE code = 'USER'),
            'f0000001-0000-0000-0000-000100000005'
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    db.execute(sql_query, {"pass": get_password_hash("ValidPassword1!")})
    db.commit()


def run_admin_seeds(db: Session):
    """
    Seed the users table with admins.
    """
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

    if not ADMIN_PASSWORD:
        raise ValueError("ADMIN_PASSWORD environment variable is not set")

    sql_query = text("""
        INSERT INTO users (first_name,last_name, email, password, status_id, role_id) VALUES
        (
            'Admin First Name', 'Admin Last Name', 'admin_email@example.com', :pass,
            (SELECT id FROM user_statuses WHERE code = 'ACTIVE'),
            (SELECT id FROM user_roles WHERE code = 'ADMIN')
        )
        ON CONFLICT (email) DO NOTHING;
    """)

    db.execute(sql_query, {"pass": get_password_hash(ADMIN_PASSWORD)})
    db.commit()


def run_invitaions_seeds(db: Session):
    """
    Seed the invitaions table with initial data.
    """
    sql_query = text("""
        INSERT INTO invitations (sender_id, recipient_email, invitation_token, status) VALUES
        (
            (SELECT id FROM users WHERE email = 'seed1@example.com'),
            'newuser@example.com',
            'valid-invite-token',
            'PENDING'
        ),
        (
            (SELECT id FROM users WHERE email = 'seed2@example.com'),
            'newuser2@example.com',
            'valid-invite-token2',
            'PENDING'
        ),
        (
            (SELECT id FROM users WHERE email = 'seed2@example.com'),
            'newuser3@example.com',
            'valid-invite-token3',
            'REVOKED'
        ),
        (
            (SELECT id FROM users WHERE email = 'seed3@example.com'),
            'newuser4@example.com',
            'valid-invite-token4',
            'EXPIRED'
        ),
        (
            (SELECT id FROM users WHERE email = 'seed3@example.com'),
            'newuser5@example.com',
            'valid-invite-token5',
            'USED'
        )
        ON CONFLICT (invitation_token) DO NOTHING;
    """)
    db.execute(sql_query)
    db.commit()


def run_tools_seeds(db: Session):
    """
    Seed the tools, photos (only photos related to tools), tool_photos tables.
    """
    db.execute(
        text("""
            INSERT INTO photos (id, url) VALUES
            ('f0000001-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1504148455328-c376907d081c'),
            ('f0000001-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407'),
            ('f0000001-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407'),
            ('f0000001-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407'),
            ('f0000001-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1642006953663-06f0387f5652?q=80&w=688&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1640090813342-21cc245b85b4?q=80&w=1176&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1675974242316-ab4fd7b7708c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1458245201577-fc8a130b8829?q=80&w=1176&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1690068023694-053da714f95f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000010', 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8'),
            ('f0000001-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1585569695919-db237e7cc455?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000012', 'https://images.unsplash.com/photo-1580402427914-a6cc60d7d44f?q=80&w=1177&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000013', 'https://images.unsplash.com/photo-1708716334127-251478e5ff37?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000014', 'https://images.unsplash.com/photo-1513467655676-561b7d489a88?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000015', 'https://images.unsplash.com/photo-1578583444045-69c6e71c520b?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000016', 'https://images.unsplash.com/photo-1578583444045-69c6e71c520b?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000017', 'https://images.unsplash.com/photo-1681083465785-2c31e4bc27dd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000018', 'https://images.unsplash.com/photo-1681083465785-2c31e4bc27dd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000019', 'https://images.unsplash.com/photo-1681083465785-2c31e4bc27dd?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000020', 'https://images.unsplash.com/photo-1702200047649-ddefe9d4faa9?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'),
            ('f0000001-0000-0000-0000-000000000021', 'https://images.unsplash.com/photo-1653607240501-92c08ed94c7f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')
            ON CONFLICT (id) DO NOTHING;
        """)
    )
    db.execute(
        text("""
            INSERT INTO tools (id, owner_id, tool_type_id, title, description, condition, pickup_notes, return_notes, loan_duration_limit, status) VALUES
            -- User 1 Listings ('seed1@example.com')
            (
                'e0000000-0000-0000-0000-000000000001', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM tool_types WHERE code = 'POWER_TOOLS'), 'DeWalt 20V Cordless Drill Set',
                'High performance brushless motor drill. Perfect for drilling holes or driving screws into wood and metal.',
                'GOOD', 'Available for pick up on weeknights. Message before arriving.', 'Please brush off any dust.', 7, 'AVAILABLE'
            ),
            (
                'e0000000-0000-0000-0000-000000000002', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM tool_types WHERE code = 'GARDENING'), 'Professional Lawn Aerator',
                'Manual spike aerator to open up your lawn soil. Heavy duty steel build.',
                'GOOD', 'Leave it on the porch when returning.', 'Clean any mud blocks off the spikes.', 3, 'AVAILABLE'
            ),
            (
                'e0000000-0000-0000-0000-000000000003', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM tool_types WHERE code = 'HAND_TOOLS'), 'Hammer',
                'Cool hammer',
                'FAIR', 'Located in garage bin #2.', 'Standard return.', 5, 'HIDDEN' -- Hidden testing
            ),

            -- User 2 Listings ('seed2@example.com')
            (
                'e0000000-0000-0000-0000-000000000004', (SELECT id FROM users WHERE email = 'seed2@example.com'),
                (SELECT id FROM tool_types WHERE code = 'HAND_TOOLS'), 'Metric & Imperial Socket Set',
                '150-piece chrome vanadium steel tool set with structural carrying case.',
                'GOOD', 'Knock on front door.', 'Put every adapter piece back into its specific mold.', 14, 'AVAILABLE'
            ),
            (
                'e0000000-0000-0000-0000-000000000005', (SELECT id FROM users WHERE email = 'seed2@example.com'),
                (SELECT id FROM tool_types WHERE code = 'AUTOMOTIVE'), '3-Ton Hydraulic Floor Jack',
                'Low profile car lift jack, perfect for quick tire swaps or detailing changes.',
                'GOOD', 'Very heavy asset, bring a trunk or spacious car floor.', 'Wipe off excess fluid leakage.', 4, 'AVAILABLE'
            ),

            -- User 3 Listings ('seed3@example.com')
            (
                'e0000000-0000-0000-0000-000000000006', (SELECT id FROM users WHERE email = 'seed3@example.com'),
                (SELECT id FROM tool_types WHERE code = 'POWER_TOOLS'), 'Circular Woodworking Saw',
                'Corded high-torque laser guided circular saw. High speed cutting accuracy.',
                'GOOD', 'Will hand over personally with manuals.', 'Unplug blade before transport.', 7, 'AVAILABLE'
            ),
            (
                'e0000000-0000-0000-0000-000000000007', (SELECT id FROM users WHERE email = 'seed3@example.com'),
                (SELECT id FROM tool_types WHERE code = 'GARDENING'), 'Gas-Powered String Trimmer',
                'Straight shaft lawn edger weed-whacker. Runs on standard mixed fuel.',
                'FAIR', 'Fuel reservoir is empty. Bring 2-cycle oil mix.', 'Empty any debris guard lines.', 2, 'SUSPENDED'
            ),

            -- User 4 Listings ('seed4@example.com')
            (
                'e0000000-0000-0000-0000-000000000008', (SELECT id FROM users WHERE email = 'seed4@example.com'),
                (SELECT id FROM tool_types WHERE code = 'AUTOMOTIVE'), 'OBD2 Bluetooth Engine Scanner',
                'Diagnostic code reader. Connects straight to your smartphone to clear check engine lights.',
                'GOOD', 'Small device, can pass it through mail slot.', 'Do not lose the protective cap pin.', 1, 'AVAILABLE'
            ),
            (
                'e0000000-0000-0000-0000-000000000009', (SELECT id FROM users WHERE email = 'seed4@example.com'),
                (SELECT id FROM tool_types WHERE code = 'AUTOMOTIVE'), 'Scanner',
                'Do nothing, just a scanner.',
                'POOR', 'Small device, can pass it through mail slot.', 'Do not lose the protective cap pin.', 1, 'DELETED'
            )
            ON CONFLICT (id) DO NOTHING;
        """)
    )
    db.execute(
        text("""
            INSERT INTO tool_photos (tool_id, photo_id)
            SELECT data.tool_id::uuid, data.photo_id::uuid
            FROM (
                VALUES
                -- Tool 1 (4 Photos - Power Drill)
                ('e0000000-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001'),
                ('e0000000-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000002'),
                ('e0000000-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000003'),
                ('e0000000-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000004'),

                -- Tool 2 (2 Photos - Aerator)
                ('e0000000-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000006'),
                ('e0000000-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000007'),

                -- Tool 3 (1 Photo - Hammer)
                ('e0000000-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000010'),

                -- Tool 4 (3 Photos - Socket Set)
                ('e0000000-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000011'),
                ('e0000000-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000012'),
                ('e0000000-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000013'),

                -- Tool 5 (2 Photos - Hydraulic Jack)
                ('e0000000-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000015'),
                ('e0000000-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000016'),

                -- Tool 6 (3 Photos - Circular Saw)
                ('e0000000-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000005'),
                ('e0000000-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000014'),
                ('e0000000-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000020'),

                -- Tool 7 (2 Photos - Trimmer)
                ('e0000000-0000-0000-0000-000000000007', 'f0000001-0000-0000-0000-000000000008'),
                ('e0000000-0000-0000-0000-000000000007', 'f0000001-0000-0000-0000-000000000009'),

                -- Tool 8 (3 Photos - Scanner)
                ('e0000000-0000-0000-0000-000000000008', 'f0000001-0000-0000-0000-000000000017'),
                ('e0000000-0000-0000-0000-000000000008', 'f0000001-0000-0000-0000-000000000018'),
                ('e0000000-0000-0000-0000-000000000008', 'f0000001-0000-0000-0000-000000000019'),
                -- Tool 9 (1 Photo - Scanner)
                ('e0000000-0000-0000-0000-000000000009', 'f0000001-0000-0000-0000-000000000021')
            ) AS data(tool_id, photo_id)
            WHERE NOT EXISTS (
                SELECT 1 FROM tool_photos
                WHERE tool_photos.tool_id = data.tool_id::uuid AND tool_photos.photo_id = data.photo_id::uuid
            );
        """)
    )

    db.commit()


def run_reservations_seeds(db: Session):
    """
    Timezone Strategy (Hawaii HST = UTC-10):
    - Start Date: Local 00:00:00 -> UTC 10:00:00 (Same calendar day)
    - End Date: Local 23:59:59 -> UTC 09:59:59 (Next calendar day)
    """
    db.execute(
        text("""
            INSERT INTO reservations (id, tool_id, borrower_id, loan_duration_limit, start_date, end_date, status) VALUES
            -- TOOL 1 BOOKINGS (e0000000-0000-0000-0000-000000000001)

            -- 1. Future, approved
            -- Local: Tomorrow 00:00:00 to Today + 3 Days 23:59:59
            (
                'd0000001-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '1 day')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '4 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),

            -- 2. Future, requested
            -- Local: Tomorrow 00:00:00 to Tomorrow + 2 Days 23:59:59
            (
                'd0000001-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '1 day')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '4 days')::timestamp + TIME '09:59:59',
                'REQUESTED'
            ),

            -- 3. Current, picked up
            -- Local: Yesterday 00:00:00 to Today 23:59:59
            (
                'd0000001-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '1 day')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '1 day')::timestamp + TIME '09:59:59',
                'PICKED_UP'
            ),

            -- 4. Past, returned
            (
                'd0000001-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '11 days')::timestamp + TIME '09:59:59',
                'RETURNED'
            ),
            -- 5. Past: canceled
            (
                'd0000001-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '9 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '09:59:59',
                'CANCELED'
            ),
            -- TOOL 2 BOOKINGS (e0000000-0000-0000-0000-000000000002)
            -- 6. Past, denied
            (
                'd0000001-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '6 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '09:59:59',
                'DENIED'
            ),
            -- 7. Past, returned
            (
                'd0000001-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '2 days')::timestamp + TIME '09:59:59',
                'RETURNED'
            ),
            -- 8. Future, request
            (
                'd0000001-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '6 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '9 days')::timestamp + TIME '09:59:59',
                'REQUESTED'
            ),
            -- 9. Future, approved
            (
                'd0000001-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '10 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '14 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),
            -- TOOL 8 BOOKINGS (e0000000-0000-0000-0000-000000000008)
            -- 10. Past,  returned
            (
                'd0000001-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000008',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '20 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '17 days')::timestamp + TIME '09:59:59',
                'RETURNED'
            ),
            -- 11. Future, approved
            (
                'd0000001-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000008',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '4 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '7 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),
            -- 12. Future, requested
            (
                'd0000001-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000008',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '7 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '9 days')::timestamp + TIME '09:59:59',
                'REQUESTED'
            ),
            -- 13. Future, approved
            (
                'd0000001-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000008',
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '14 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '17 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),
            -- 14. Current, approved
            -- Local: Today 00:00:00 to Today + 1 Day 23:59:59
            (
                'd0000001-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE)::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '2 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),
            -- 15. Past, returned
            (
                'd0000001-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '12 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '11 days')::timestamp + TIME '09:59:59',
                'RETURNED'
            ),
            -- 16. Past, canceled
            (
                'd0000001-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '8 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '09:59:59',
                'CANCELED'
            ),
            -- 17. Future: approved
            (
                'd0000001-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '6 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '9 days')::timestamp + TIME '09:59:59',
                'APPROVED'
            ),
            -- 18. Future, requested
            (
                'd0000001-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000001',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '11 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '15 days')::timestamp + TIME '09:59:59',
                'REQUESTED'
            ),
            -- 19. Past, returned
            (
                'd0000001-0000-0000-0000-000000000019', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE - INTERVAL '4 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE - INTERVAL '3 days')::timestamp + TIME '09:59:59',
                'RETURNED'
            ),
            -- 20. Future, requested
            (
                'd0000001-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000002',
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                7,
                (CURRENT_DATE + INTERVAL '16 days')::timestamp + TIME '10:00:00',
                (CURRENT_DATE + INTERVAL '19 days')::timestamp + TIME '09:59:59',
                'REQUESTED'
            )
            ON CONFLICT (id) DO NOTHING;
        """)
    )
    db.commit()


def run_review_seeds(db: Session):
    """
    Seed reviews table
    """
    db.execute(
        text("""
            INSERT INTO reviews (reservation_id, reviewer_id, reviewee_id, rating, comment) VALUES
            (
                'd0000001-0000-0000-0000-000000000004', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                5, 'Returned on time'
            ),
            (
                'd0000001-0000-0000-0000-000000000004',(SELECT id FROM users WHERE email = 'seed2@example.com'),
                (SELECT id FROM users WHERE email = 'seed1@example.com'),
                4, 'Good tool'
            ),
            (
                'd0000001-0000-0000-0000-000000000007', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                1, 'Returned late'
            ),
            (
                'd0000001-0000-0000-0000-000000000010', (SELECT id FROM users WHERE email = 'seed4@example.com'),
                (SELECT id FROM users WHERE email = 'seed2@example.com'),
                5, 'Returned on time'
            ),
            (
                'd0000001-0000-0000-0000-000000000010', (SELECT id FROM users WHERE email = 'seed2@example.com'),
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                5, 'Great tool'
            ),
            (
                'd0000001-0000-0000-0000-000000000015', (SELECT id FROM users WHERE email = 'seed4@example.com'),
                (SELECT id FROM users WHERE email = 'seed1@example.com'),
                1, 'Bad tool'
            ),
            (
                'd0000001-0000-0000-0000-000000000019', (SELECT id FROM users WHERE email = 'seed1@example.com'),
                (SELECT id FROM users WHERE email = 'seed4@example.com'),
                1, 'Returned with damage'
            )
            ON CONFLICT (id) DO NOTHING;
        """)
    )
    db.commit()
