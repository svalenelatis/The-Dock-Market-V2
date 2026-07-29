-- ============================================================
-- FIX: admin_users RLS infinite recursion
--
-- The "Super admins can manage admin users" policy does a subquery
-- on admin_users itself (SELECT 1 FROM admin_users WHERE ...),
-- which triggers RLS evaluation again, causing infinite recursion.
--
-- Fix: Replace the self-referencing policy with one that checks
-- the JWT claims directly, avoiding the recursive table access.
-- For the basic "read own row" policy, use a simple auth.uid() = id
-- check (no subquery needed — this one is fine).
-- ============================================================

-- Drop the problematic self-referencing policy
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;

-- Drop and recreate the read policy (this one is fine, but let's be explicit)
DROP POLICY IF EXISTS "Admin users can read own data" ON admin_users;

-- Simple SELECT: any authenticated user can check if they have an admin row
-- This avoids the recursion because it doesn't subquery admin_users
CREATE POLICY "Users can read own admin row" ON admin_users
    FOR SELECT USING (auth.uid() = id);

-- For full CRUD (super admin management), use service_role only.
-- The existing "Service role full access to admin users" policy handles this.
-- No self-referencing policy needed.
