-- ============================================================================
-- HOTFIX: CRITICAL ISSUES IN REPORTS WORKFLOW
-- ============================================================================
-- Fixes FK constraint violations when creating task_reports

CREATE OR REPLACE FUNCTION public.create_report_on_in_progress()
RETURNS TRIGGER AS $$
DECLARE
  provider_user_id UUID;
BEGIN
  IF NEW.status = 'in_progress' 
    AND OLD.status != 'in_progress'
    AND NEW.assigned_to IS NOT NULL 
  THEN
    -- Get the auth.users.id for this provider
    SELECT user_id INTO provider_user_id
    FROM user_profiles
    WHERE id = NEW.assigned_to
    LIMIT 1;

    -- Insert a new task_report with in_progress status
    INSERT INTO public.task_reports (
      task_id,
      provider_id,
      status,
      description,
      percentage_complete,
      last_updated_by
    )
    VALUES (
      NEW.id,
      NEW.assigned_to,
      'in_progress',
      '',
      0,
      COALESCE(provider_user_id, NEW.created_by)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_in_progress_create_report ON public.tasks;

CREATE TRIGGER on_task_in_progress_create_report
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'in_progress' AND OLD.status != 'in_progress')
  EXECUTE FUNCTION public.create_report_on_in_progress();

-- ============================================================================
-- FIX RLS POLICIES WITH NULL CHECKS
-- ============================================================================

DROP POLICY IF EXISTS task_reports_view ON public.task_reports;
DROP POLICY IF EXISTS task_reports_insert ON public.task_reports;
DROP POLICY IF EXISTS task_reports_update ON public.task_reports;

CREATE POLICY task_reports_view ON public.task_reports
  FOR SELECT USING (
    provider_id = COALESCE(
      (SELECT id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reports.task_id 
      AND t.created_by = auth.uid()
    )
  );

CREATE POLICY task_reports_insert ON public.task_reports
  FOR INSERT WITH CHECK (
    provider_id = COALESCE(
      (SELECT id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

CREATE POLICY task_reports_update ON public.task_reports
  FOR UPDATE USING (
    provider_id = COALESCE(
      (SELECT id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reports.task_id 
      AND t.created_by = auth.uid()
    )
  );
