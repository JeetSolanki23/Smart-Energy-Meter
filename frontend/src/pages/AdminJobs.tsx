import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, PlayCircle, RefreshCw } from "lucide-react";

type JobKind = "aggregate-daily-usage" | "generate-monthly-bills" | "check-unpaid-bills";

interface JobTriggerResponse {
  queued: boolean;
  task_name: string;
  task_id: string;
}

interface JobStatusResponse {
  task_id: string;
  status: string;
  ready: boolean;
  successful: boolean | null;
  result?: number;
  error?: string;
}

interface JobRun {
  task_id: string;
  task_name: string;
  status: string;
  ready: boolean;
  successful: boolean | null;
  result?: number;
  error?: string;
  createdAt: string;
}

interface TestEmailResponse {
  ok: boolean;
  sent: boolean;
  recipients: string[];
  reason?: string;
}

const JOBS: Array<{ id: JobKind; title: string; description: string; triggerPath: string }> = [
  {
    id: "aggregate-daily-usage",
    title: "Aggregate Daily Usage",
    description: "Build daily usage snapshots from telemetry readings.",
    triggerPath: "/admin/jobs/aggregate-daily-usage",
  },
  {
    id: "generate-monthly-bills",
    title: "Generate Monthly Bills",
    description: "Create bills for the current month using aggregated usage.",
    triggerPath: "/admin/jobs/generate-monthly-bills",
  },
  {
    id: "check-unpaid-bills",
    title: "Check Unpaid Bills",
    description: "Mark unpaid bills as overdue when due date has passed.",
    triggerPath: "/admin/jobs/check-unpaid-bills",
  },
];

const statusTone = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const normalized = status.toUpperCase();
  if (normalized === "SUCCESS") return "default";
  if (normalized === "FAILURE") return "destructive";
  if (normalized === "PENDING" || normalized === "STARTED") return "secondary";
  return "outline";
};

const AdminJobs = () => {
  const [loadingJob, setLoadingJob] = useState<JobKind | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [refreshingTaskId, setRefreshingTaskId] = useState<string | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [runs]
  );

  const refreshStatus = async (taskId: string) => {
    setRefreshingTaskId(taskId);
    try {
      const status = await api<JobStatusResponse>(`/admin/jobs/${taskId}`);
      setRuns((prev) =>
        prev.map((run) =>
          run.task_id === taskId
            ? {
                ...run,
                status: status.status,
                ready: status.ready,
                successful: status.successful,
                result: status.result,
                error: status.error,
              }
            : run
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh status");
    } finally {
      setRefreshingTaskId(null);
    }
  };

  const triggerJob = async (job: (typeof JOBS)[number]) => {
    setLoadingJob(job.id);
    try {
      const res = await api<JobTriggerResponse>(job.triggerPath, { method: "POST" });
      setRuns((prev) => [
        {
          task_id: res.task_id,
          task_name: res.task_name,
          status: "PENDING",
          ready: false,
          successful: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success(`${job.title} queued`);
      await refreshStatus(res.task_id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to trigger ${job.title}`);
    } finally {
      setLoadingJob(null);
    }
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const res = await api<TestEmailResponse>("/admin/notifications/test-email", { method: "POST" });
      if (res.sent) {
        toast.success(`Test email sent to: ${res.recipients.join(", ")}`);
      } else {
        toast.error(res.reason || "Test email was not sent");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Jobs</CardTitle>
            <CardDescription>
              Trigger billing and usage jobs manually for testing or operational recovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {JOBS.map((job) => (
              <Card key={job.id} className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{job.title}</CardTitle>
                  <CardDescription>{job.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => {
                      void triggerJob(job);
                    }}
                    disabled={loadingJob === job.id}
                  >
                    {loadingJob === job.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Triggering...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        Run Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>Send a branded test email to verify SMTP configuration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void sendTestEmail()} disabled={sendingTestEmail}>
              {sendingTestEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Job Runs</CardTitle>
            <CardDescription>Check status and result for queued jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs triggered yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedRuns.map((run) => (
                  <div
                    key={run.task_id}
                    className="rounded-lg border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{run.task_name}</p>
                        <Badge variant={statusTone(run.status)}>{run.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Task ID: {run.task_id}</p>
                      {typeof run.result === "number" && (
                        <p className="text-xs text-muted-foreground">Processed count: {run.result}</p>
                      )}
                      {run.error && <p className="text-xs text-destructive">Error: {run.error}</p>}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refreshingTaskId === run.task_id}
                      onClick={() => {
                        void refreshStatus(run.task_id);
                      }}
                    >
                      {refreshingTaskId === run.task_id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Refreshing
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Refresh Status
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminJobs;
