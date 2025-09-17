-- Create notification campaigns table
CREATE TABLE public.notification_campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'artists', 'clients', 'custom')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
    click_count INTEGER NOT NULL DEFAULT 0,
    delivery_count INTEGER NOT NULL DEFAULT 0,
    icon_url TEXT,
    action_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access
CREATE POLICY "Only admins can manage notification campaigns" 
ON public.notification_campaigns 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create notification subscriptions table for tracking user subscriptions
CREATE TABLE public.notification_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- Enable RLS for subscriptions
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "Users can manage their own subscriptions" 
ON public.notification_subscriptions 
FOR ALL 
USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions" 
ON public.notification_subscriptions 
FOR SELECT 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create notification analytics table
CREATE TABLE public.notification_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'clicked', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for analytics
ALTER TABLE public.notification_analytics ENABLE ROW LEVEL SECURITY;

-- Only admins can view analytics
CREATE POLICY "Only admins can view notification analytics" 
ON public.notification_analytics 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_notification_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_campaigns_updated_at
    BEFORE UPDATE ON public.notification_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_campaigns_updated_at();

CREATE TRIGGER update_notification_subscriptions_updated_at
    BEFORE UPDATE ON public.notification_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_campaigns_updated_at();