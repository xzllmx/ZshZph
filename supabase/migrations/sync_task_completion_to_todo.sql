-- ============================================================================
-- SYNC TASK COMPLETION TO TODO_LIST
-- ============================================================================
-- When a task is marked as completed (by manager approval),
-- update the corresponding todo_list item to "completed" status

CREATE OR REPLACE FUNCTION public.sync_task_completion_to_todo()
RETURNS TRIGGER AS $$
BEGIN
  -- When task status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.todo_list
    SET 
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    WHERE task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_task_completed_sync_todo ON public.tasks;

-- Create the trigger
CREATE TRIGGER on_task_completed_sync_todo
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.sync_task_completion_to_todo();
