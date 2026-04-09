import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  MessageSquare,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
  X,
  Pin,
  Sparkles,
  RefreshCw,
  Flag,
  Trash2,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Loader from "@/components/Loader";

const fetchModerationQueue = async ({ status, hasReports, page, limit }) => {
  const params = { page, limit };
  if (status) params.status = status;
  if (hasReports) params.hasReports = "true";
  const res = await api.get("/comments/moderation/queue", { params });
  return res.data;
};

const fetchModerationStats = async () => {
  const res = await api.get("/comments/moderation/stats");
  return res.data;
};

const StatusBadge = ({ status }) => {
  const styles = {
    approved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100",
    hidden: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100",
    deleted: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400",
  };
  return (
    <Badge className={`${styles[status] || styles.pending} border`}>
      {status || "pending"}
    </Badge>
  );
};

const CommentCard = ({ comment, onModerate, onClearReports, onTogglePin, onToggleBestInsight }) => {
  const [showReports, setShowReports] = useState(false);

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <span className="text-orange-600 dark:text-orange-300 font-semibold">
                {(comment.author?.name || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{comment.author?.name || "Unknown"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(comment.createdAt).toLocaleDateString()} • {comment.author?.role || "Member"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={comment.status} />
            {comment.isPinned && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100 border border-blue-200">
                <Pin className="w-3 h-3 mr-1" /> Pinned
              </Badge>
            )}
            {comment.isBestInsight && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-100 border border-purple-200">
                <Sparkles className="w-3 h-3 mr-1" /> Best Insight
              </Badge>
            )}
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{comment.content}</p>

        {comment.postId && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            On post: <span className="font-medium">{comment.postId.title || comment.postId}</span>
          </p>
        )}

        {/* Reports section */}
        {comment.reports?.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowReports(!showReports)}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              <Flag className="w-4 h-4" />
              {comment.reports.length} report(s)
            </button>
            {showReports && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {comment.reports.map((report, idx) => (
                  <div key={idx} className="mb-2 last:mb-0">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{report.reason}</p>
                    {report.details && (
                      <p className="text-xs text-red-600 dark:text-red-400">{report.details}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => onClearReports(comment.id)}
                >
                  Clear all reports
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-3 border-t dark:border-gray-700">
          {comment.status !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={() => onModerate(comment.id, "approve")}
            >
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
          )}
          {comment.status !== "hidden" && (
            <Button
              size="sm"
              variant="outline"
              className="text-yellow-600 border-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              onClick={() => onModerate(comment.id, "hide")}
            >
              <EyeOff className="w-4 h-4 mr-1" /> Hide
            </Button>
          )}
          {comment.status === "hidden" && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => onModerate(comment.id, "restore")}
            >
              <Eye className="w-4 h-4 mr-1" /> Restore
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => onModerate(comment.id, "delete")}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTogglePin(comment.id)}
          >
            <Pin className="w-4 h-4 mr-1" /> {comment.isPinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onToggleBestInsight(comment.id)}
          >
            <Sparkles className="w-4 h-4 mr-1" /> {comment.isBestInsight ? "Remove Best" : "Best Insight"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CommentModeration = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Determine filter based on active tab
  const getFilterParams = () => {
    switch (activeTab) {
      case "pending":
        return { status: "pending" };
      case "hidden":
        return { status: "hidden" };
      case "reported":
        return { hasReports: true };
      case "all":
      default:
        return {};
    }
  };

  const { data: statsData } = useQuery({
    queryKey: ["moderation-stats"],
    queryFn: fetchModerationStats,
    staleTime: 30_000,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["moderation-queue", activeTab, page],
    queryFn: () => fetchModerationQueue({ ...getFilterParams(), page, limit }),
    keepPreviousData: true,
    staleTime: 15_000,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ commentId, action, note }) => {
      const res = await api.put(`/comments/${commentId}/moderate`, { action, note });
      return res.data;
    },
    onSuccess: (response, { action }) => {
      toast.success(`Comment ${action}d successfully`);
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to moderate comment");
    },
  });

  const clearReportsMutation = useMutation({
    mutationFn: async (commentId) => {
      const res = await api.delete(`/comments/${commentId}/reports`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Reports cleared");
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
      queryClient.invalidateQueries({ queryKey: ["moderation-stats"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to clear reports");
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async (commentId) => {
      const res = await api.put(`/comments/${commentId}/pin`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to toggle pin");
    },
  });

  const toggleBestInsightMutation = useMutation({
    mutationFn: async (commentId) => {
      const res = await api.put(`/comments/${commentId}/best-insight`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to toggle best insight");
    },
  });

  const stats = statsData?.data || {};
  const comments = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-600" />
            Comment Moderation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and moderate user comments across all blog posts
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.hidden || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hidden</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.reported || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reported</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({stats.pending || 0})</TabsTrigger>
          <TabsTrigger value="hidden">Hidden ({stats.hidden || 0})</TabsTrigger>
          <TabsTrigger value="reported">Reported ({stats.reported || 0})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <Loader />
          ) : comments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No comments in this queue</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onModerate={(id, action) => moderateMutation.mutate({ commentId: id, action })}
                  onClearReports={(id) => clearReportsMutation.mutate(id)}
                  onTogglePin={(id) => togglePinMutation.mutate(id)}
                  onToggleBestInsight={(id) => toggleBestInsightMutation.mutate(id)}
                />
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommentModeration;
