-- Add indexes for unindexed foreign keys to improve JOIN performance

-- Index for dividends.etf_id foreign key
CREATE INDEX IF NOT EXISTS idx_dividends_etf_id ON public.dividends(etf_id);

-- Index for notifications.comment_id foreign key
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON public.notifications(comment_id);

-- Index for notifications.post_id foreign key  
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON public.notifications(post_id);

-- Index for subscribers.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON public.subscribers(user_id);