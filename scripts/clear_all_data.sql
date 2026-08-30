-- ============================================================
-- FindMyDonor™ — Truncate All Data (Schema-Preserving)
-- Run in: Supabase Dashboard → SQL Editor
--
-- WHAT THIS DOES:
--   Deletes every row from every user-data table.
--   Preserves: table structure, indexes, RLS policies,
--   triggers, functions, and extensions.
--
-- WHAT IT DOES NOT DELETE:
--   - Supabase Auth user accounts (auth.users)
--   - Table definitions, indexes, or constraints
--   - RLS policies
--   - Functions (link_verified_auth_profile, etc.)
--
-- DELETION ORDER: Child tables first to respect FK constraints.
-- ============================================================

BEGIN;

-- ── 1. Child tables (FK references other tables) ──────────

DELETE FROM forum_comments;        -- FK → forum_posts
DELETE FROM request_reports;       -- FK → blood_requests, profiles
DELETE FROM request_events;        -- FK → blood_requests (logical)
DELETE FROM notifications;         -- FK → users, blood_requests (logical)
DELETE FROM donation_log;          -- FK → users, matches, blood_requests
DELETE FROM matches;               -- FK → blood_requests, users
DELETE FROM blood_requests;        -- FK → requesters, profiles

-- ── 2. Profile tables ─────────────────────────────────────

DELETE FROM donor_profiles;        -- FK → profiles
DELETE FROM auth_profile_links;    -- FK → auth.users, profiles

-- ── 3. Top-level tables (no FK children) ──────────────────

DELETE FROM profiles;
DELETE FROM users;                 -- legacy donor table
DELETE FROM requesters;
DELETE FROM forum_posts;

-- ── 4. Admin/hospital tables (if they exist) ──────────────

DELETE FROM hospital_users;
DELETE FROM admin_users;

COMMIT;

-- ── Verify all tables are empty ───────────────────────────
SELECT 'profiles' AS tbl, count(*) AS remaining FROM profiles
UNION ALL SELECT 'auth_profile_links', count(*) FROM auth_profile_links
UNION ALL SELECT 'donor_profiles', count(*) FROM donor_profiles
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'requesters', count(*) FROM requesters
UNION ALL SELECT 'blood_requests', count(*) FROM blood_requests
UNION ALL SELECT 'matches', count(*) FROM matches
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'donation_log', count(*) FROM donation_log
UNION ALL SELECT 'forum_posts', count(*) FROM forum_posts
UNION ALL SELECT 'forum_comments', count(*) FROM forum_comments
UNION ALL SELECT 'request_reports', count(*) FROM request_reports
UNION ALL SELECT 'request_events', count(*) FROM request_events
UNION ALL SELECT 'hospital_users', count(*) FROM hospital_users
UNION ALL SELECT 'admin_users', count(*) FROM admin_users
ORDER BY tbl;
