-- =============================================
-- PHASE 1: PROJECT MANAGEMENT SCHEMA EXPANSION
-- =============================================

-- 1. WORKSPACES TABLE
CREATE TABLE public.workspaces (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. WORKSPACE MEMBERS TABLE
CREATE TABLE public.workspace_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'guest')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- 3. PROJECT SECTIONS TABLE (Kanban columns)
CREATE TABLE public.project_sections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PROJECT TAGS TABLE
CREATE TABLE public.project_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, name)
);

-- 5. TASK TAGS (many-to-many)
CREATE TABLE public.task_tags (
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.project_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

-- 6. TASK ASSIGNEES (multiple assignees per task)
CREATE TABLE public.task_assignees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(task_id, user_id)
);

-- 7. SUBTASKS TABLE
CREATE TABLE public.subtasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    position INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TASK COMMENTS TABLE
CREATE TABLE public.task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions UUID[] DEFAULT '{}',
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TASK ATTACHMENTS TABLE
CREATE TABLE public.task_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. TASK ACTIVITY LOG TABLE
CREATE TABLE public.task_activity_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. IN-APP NOTIFICATIONS TABLE
CREATE TABLE public.in_app_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. ADD COLUMNS TO PROJECTS TABLE
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'workspace' CHECK (visibility IN ('private', 'workspace', 'public'));

-- 13. ADD COLUMNS TO PROJECT_TASKS TABLE
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.project_sections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
ADD COLUMN IF NOT EXISTS done_date TIMESTAMPTZ;

-- =============================================
-- ENABLE RLS ON ALL NEW TABLES
-- =============================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- WORKSPACES POLICIES
CREATE POLICY "Admins can manage all workspaces" ON public.workspaces
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Members can view their workspaces" ON public.workspaces
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid())
    );

-- WORKSPACE MEMBERS POLICIES
CREATE POLICY "Admins can manage all workspace members" ON public.workspace_members
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Members can view workspace members" ON public.workspace_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid())
    );

-- PROJECT SECTIONS POLICIES
CREATE POLICY "Admins can manage all project sections" ON public.project_sections
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can view sections" ON public.project_sections
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.project_users WHERE project_id = project_sections.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Project members can manage sections" ON public.project_sections
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.project_users WHERE project_id = project_sections.project_id AND user_id = auth.uid())
    );

-- PROJECT TAGS POLICIES
CREATE POLICY "Admins can manage all project tags" ON public.project_tags
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can manage tags" ON public.project_tags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.project_users WHERE project_id = project_tags.project_id AND user_id = auth.uid())
    );

-- TASK TAGS POLICIES
CREATE POLICY "Admins can manage all task tags" ON public.task_tags
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can manage task tags" ON public.task_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = task_tags.task_id AND pu.user_id = auth.uid()
        )
    );

-- TASK ASSIGNEES POLICIES
CREATE POLICY "Admins can manage all task assignees" ON public.task_assignees
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can manage assignees" ON public.task_assignees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = task_assignees.task_id AND pu.user_id = auth.uid()
        )
    );

-- SUBTASKS POLICIES
CREATE POLICY "Admins can manage all subtasks" ON public.subtasks
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can manage subtasks" ON public.subtasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = subtasks.task_id AND pu.user_id = auth.uid()
        )
    );

-- TASK COMMENTS POLICIES
CREATE POLICY "Admins can manage all task comments" ON public.task_comments
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can view comments" ON public.task_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = task_comments.task_id AND pu.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own comments" ON public.task_comments
    FOR ALL USING (user_id = auth.uid());

-- TASK ATTACHMENTS POLICIES
CREATE POLICY "Admins can manage all task attachments" ON public.task_attachments
    FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can manage attachments" ON public.task_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = task_attachments.task_id AND pu.user_id = auth.uid()
        )
    );

-- TASK ACTIVITY LOG POLICIES
CREATE POLICY "Admins can view all activity logs" ON public.task_activity_log
    FOR SELECT USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Project members can view activity logs" ON public.task_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_tasks pt
            JOIN public.project_users pu ON pt.project_id = pu.project_id
            WHERE pt.id = task_activity_log.task_id AND pu.user_id = auth.uid()
        )
    );

-- IN-APP NOTIFICATIONS POLICIES
CREATE POLICY "Users can view their own notifications" ON public.in_app_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.in_app_notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.in_app_notifications
    FOR INSERT WITH CHECK (true);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_sections_project ON public.project_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_project_sections_position ON public.project_sections(project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_tags_project ON public.project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON public.task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON public.task_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_position ON public.subtasks(task_id, position);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task ON public.task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_created ON public.task_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON public.in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON public.in_app_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_project_tasks_section ON public.project_tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_position ON public.project_tasks(section_id, position);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON public.project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);

-- =============================================
-- TRIGGER FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_sections_updated_at
    BEFORE UPDATE ON public.project_sections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subtasks_updated_at
    BEFORE UPDATE ON public.subtasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();