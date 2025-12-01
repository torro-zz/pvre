-- Admin Alerts Table
-- Stores alerts for admin review (refund patterns, security events, etc.)

CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON admin_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_user ON admin_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created ON admin_alerts(created_at DESC);

-- RLS Policies (admin only)
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists, then recreate
DROP POLICY IF EXISTS "Service role can manage alerts" ON admin_alerts;

-- Only service role can manage
CREATE POLICY "Service role can manage alerts"
    ON admin_alerts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comment
COMMENT ON TABLE admin_alerts IS 'Admin alerts for monitoring refund patterns, security events, and system issues';
