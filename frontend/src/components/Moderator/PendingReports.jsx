import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, FileText, Clock } from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS = {
  Approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Needs Improvement": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function getRoleName(user) {
  return String(user?.role?.role || user?.role?.plural || user?.role || "").toLowerCase();
}

function canReviewReports(user) {
  return /moderator|super\s*admin/i.test(getRoleName(user));
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export default function PendingReports() {
  const user = useSelector((state) => state.auth?.user);
  const queryClient = useQueryClient();
  const canReview = canReviewReports(user);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["moderator-pending-reports"],
    queryFn: async () => {
      const res = await api.get("/reporting/admin-reports", {
        params: { status: "Pending", limit: 100 },
      });
      return res.data || { data: [], total: 0 };
    },
    enabled: canReview,
    staleTime: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ reportId, status }) => {
      const res = await api.patch(`/daily-reports/${reportId}/status`, { status });
      return res.data?.data || res.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Report marked as ${variables.status}.`);
      queryClient.invalidateQueries({ queryKey: ["moderator-pending-reports"] });
      queryClient.invalidateQueries({ queryKey: ["reporting", "admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update report status."));
    },
  });

  if (!canReview) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You do not have access to review reports.
          </CardContent>
        </Card>
      </div>
    );
  }

  const reports = data?.data || [];
  const total = data?.total || reports.length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Clock className="text-orange-600" />
            Pending Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review pending reading reports from your assigned members.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {total} pending
          </Badge>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reports waiting for review
          </CardTitle>
          <CardDescription>
            Challenge progress starts only after a report is approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-destructive">Failed to load pending reports.</div>
          ) : reports.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No pending reports right now.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{new Date(report.readingDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {report.createdBy?.first_name} {report.createdBy?.last_name}
                        </span>
                        {report.memberDepartment && (
                          <span className="text-xs text-muted-foreground">{report.memberDepartment}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{report.book?.title || "Unknown"}</TableCell>
                    <TableCell className="text-right">{report.pagesRead || 0}</TableCell>
                    <TableCell className="text-right">{report.timeSpent || 0}m</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[report.status] || ""}>{report.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ reportId: report.id, status: "Approved" })}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ reportId: report.id, status: "Needs Improvement" })}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Needs work
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
