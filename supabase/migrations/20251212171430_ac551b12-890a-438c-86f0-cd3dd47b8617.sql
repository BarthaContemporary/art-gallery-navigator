-- Remove unnecessary admin access to push notification subscriptions
-- The send-push-notification edge function uses service_role key and doesn't need this policy
-- This reduces attack surface if an admin account is compromised

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.notification_subscriptions;