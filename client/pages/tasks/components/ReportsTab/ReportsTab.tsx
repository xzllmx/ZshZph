import React, { useState, useEffect, useMemo } from "react";
import { supabase, Task as TaskType, UserProfile, TaskReport, TaskChecklist, TaskChecklistItem, TaskReportChecklistItem, TaskEvidenceSubmission, TaskIssue, TaskEvidenceRequirement } from "../../../../lib/supabase";
import { toast } from "../../../../hooks/use-toast";
import ProviderReportForm from "./ProviderReportForm";
import ManagerReportView from "./ManagerReportView";

interface ReportsTabProps {
  tasks: TaskType[];
  currentUser: any;
  currentUserProfile: UserProfile | null;
  userRole: "guest" | "manager" | "service_provider" | null;
}

const ReportsTab: React.FC<ReportsTabProps> = ({
  tasks,
  currentUser,
  currentUserProfile,
  userRole,
}) => {
  const [activeTab, setActiveTab] = useState<"provider" | "manager">(
    userRole === "service_provider" ? "provider" : "manager"
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null);
  const [taskReport, setTaskReport] = useState<TaskReport | null>(null);
  const [checklist, setChecklist] = useState<TaskChecklist | null>(null);
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([]);
  const [reportChecklistItems, setReportChecklistItems] = useState<TaskReportChecklistItem[]>([]);
  const [evidenceSubmissions, setEvidenceSubmissions] = useState<TaskEvidenceSubmission[]>([]);
  const [issues, setIssues] = useState<TaskIssue[]>([]);
  const [evidenceRequirements, setEvidenceRequirements] = useState<TaskEvidenceRequirement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Determine which tasks to show based on role (memoized to prevent infinite useEffect loops)
  const relevantTasks = useMemo(() =>
    userRole === "service_provider"
      ? tasks.filter((t) => t.assigned_to === currentUserProfile?.id && t.status === "in_progress")
      : tasks.filter((t) => t.status === "in_progress"),
    [tasks, userRole, currentUserProfile?.id]
  );

  // Load data when task selection changes and set up polling for real-time updates
  useEffect(() => {
    if (!selectedTaskId) {
      if (relevantTasks.length > 0) {
        setSelectedTaskId(relevantTasks[0].id);
      }
      return;
    }

    const task = relevantTasks.find((t) => t.id === selectedTaskId);
    if (task) {
      setSelectedTask(task);
      loadTaskReportData(selectedTaskId);

      // Poll for real-time updates every 2 seconds
      const pollInterval = setInterval(() => {
        loadTaskReportData(selectedTaskId);
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [selectedTaskId, relevantTasks]);

  const loadTaskReportData = async (taskId: string) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }
    try {
      // Load task report (may not exist yet)
      const { data: reportData, error: reportError } = await supabase
        .from("task_reports")
        .select("*")
        .eq("task_id", taskId)
        .single();
      setTaskReport(reportData || null);

      // Load checklist (may not exist yet)
      const { data: checklistData, error: checklistError } = await supabase
        .from("task_checklists")
        .select("*")
        .eq("task_id", taskId)
        .single();
      setChecklist(checklistData || null);

      if (checklistData) {
        // Load checklist items
        const { data: itemsData } = await supabase
          .from("task_checklist_items")
          .select("*")
          .eq("checklist_id", checklistData.id)
          .order("display_order");
        setChecklistItems(itemsData || []);

        // Load report checklist items if report exists
        if (reportData) {
          const { data: reportItemsData } = await supabase
            .from("task_report_checklist_items")
            .select("*")
            .eq("report_id", reportData.id);
          setReportChecklistItems(reportItemsData || []);
        }
      } else {
        setChecklistItems([]);
        setReportChecklistItems([]);
      }

      // Load evidence submissions
      const { data: evidenceData } = await supabase
        .from("task_evidence_submissions")
        .select("*")
        .eq("task_id", taskId)
        .order("submitted_at", { ascending: false });
      setEvidenceSubmissions(evidenceData || []);

      // Load issues
      const { data: issuesData } = await supabase
        .from("task_issues")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      setIssues(issuesData || []);

      // Load evidence requirements (may not exist yet)
      const { data: requirementsData, error: requirementsError } = await supabase
        .from("task_evidence_requirements")
        .select("*")
        .eq("task_id", taskId)
        .single();
      setEvidenceRequirements(requirementsData || null);
    } catch (error) {
      console.error("Error loading report data:", error);
      // Don't show error toast for missing data - it's expected that reports may not exist yet
    } finally {
      setIsLoading(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  if (relevantTasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No in-progress tasks to report on</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Task Selection */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Task</h3>
        <select
          value={selectedTaskId || ""}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sheraton-gold focus:border-transparent"
        >
          {relevantTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} ({task.priority})
            </option>
          ))}
        </select>
      </div>

      {selectedTask && !isLoading && (
        <>
          {/* Role-based content */}
          {userRole === "service_provider" ? (
            <ProviderReportForm
              task={selectedTask}
              taskReport={taskReport}
              checklist={checklist}
              checklistItems={checklistItems}
              reportChecklistItems={reportChecklistItems}
              evidenceSubmissions={evidenceSubmissions}
              evidenceRequirements={evidenceRequirements}
              issues={issues}
              currentUser={currentUser}
              currentUserProfile={currentUserProfile}
              onReportUpdated={() => loadTaskReportData(selectedTask.id)}
            />
          ) : (
            <ManagerReportView
              task={selectedTask}
              taskReport={taskReport}
              checklist={checklist}
              checklistItems={checklistItems}
              reportChecklistItems={reportChecklistItems}
              evidenceSubmissions={evidenceSubmissions}
              evidenceRequirements={evidenceRequirements}
              issues={issues}
              currentUser={currentUser}
              onEvidenceApproved={() => loadTaskReportData(selectedTask.id)}
              onIssueResolved={() => loadTaskReportData(selectedTask.id)}
            />
          )}
        </>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin">⏳</div>
          <p className="text-gray-500 mt-2">Loading report...</p>
        </div>
      )}
    </div>
  );
};

export default ReportsTab;
