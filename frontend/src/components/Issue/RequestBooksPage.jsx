import React, { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import api from "@/app/api/apislice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Loader2,
  Search,
  BookMarked,
} from "lucide-react";

/* ───────────────────────────── helpers ───────────────────────────── */
const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const toISODate = (date) => date.toISOString().slice(0, 10);
const todayISO = () => toISODate(new Date());
const addDaysISO = (dateStr, days) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};
const daysBetween = (start, end) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
};

const statusClass = (s) => {
  switch ((s || "").toLowerCase()) {
    case "requested": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "approved":  return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "issued":    return "bg-green-100 text-green-700 hover:bg-green-100";
    case "rejected":  return "bg-red-100 text-red-700 hover:bg-red-100";
    case "cancelled": return "bg-slate-100 text-slate-700 hover:bg-slate-100";
    default:          return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
};

/* ─────────────────────── Create Request Modal ─────────────────────── */
const memberDisplayName = (member) =>
  member?.full_name ||
  [member?.first_name, member?.middle_name, member?.last_name].filter(Boolean).join(" ");

const CreateRequestModal = ({ onClose, onSuccess, currentUser, isMemberUser, isProfileLoading }) => {
  const [memberCode, setMemberCode] = useState("");
  const [memberId, setMemberId] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [selectedBook, setSelectedBook] = useState("");
  const [requestedDays, setRequestedDays] = useState("7");
  const [durationMode, setDurationMode] = useState("preset");
  const [requestedReturnDate, setRequestedReturnDate] = useState(addDaysISO(todayISO(), 1));
  const [note, setNote] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const currentMemberPathId =
    currentUser?.member?.uuid ||
    currentUser?.member?.id ||
    currentUser?.member_id_fk ||
    null;

  const { data: booksData } = useQuery({
    queryKey: ["books", "all"],
    queryFn: async () => {
      const r = await api.get("/books", { params: { limit: 500 } });
      return r.data?.data ?? r.data ?? [];
    },
    staleTime: 30_000,
  });

  const books = Array.isArray(booksData) ? booksData : [];
  const requestStartDate = todayISO();
  const requestedDaysValue =
    durationMode === "custom"
      ? daysBetween(requestStartDate, requestedReturnDate)
      : parseInt(requestedDays, 10) || 7;
  const invalidCustomDuration =
    durationMode === "custom" &&
    (!requestedReturnDate || Number.isNaN(requestedDaysValue) || requestedDaysValue < 1 || requestedDaysValue > 14);

  const { data: currentMember, isLoading: currentMemberLoading, isError: currentMemberError } = useQuery({
    queryKey: ["member", "current-requester", currentMemberPathId],
    queryFn: async () => {
      const r = await api.get(`/members/${currentMemberPathId}`);
      return r.data?.data ?? r.data;
    },
    enabled: Boolean(isMemberUser && currentMemberPathId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isMemberUser) return;
    if (currentMember) {
      setMemberId(currentMember.id);
      setMemberInfo(currentMember);
      setMemberCode(currentMember.code || "");
    }
  }, [currentMember, isMemberUser]);

  const lookupMember = async () => {
    if (!memberCode.trim()) return;
    setLookingUp(true);
    try {
      const r = await api.get(`/members/by-code/${encodeURIComponent(memberCode.trim())}`);
      const m = r.data?.data ?? r.data;
      setMemberId(m.id);
      setMemberInfo(m);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Member not found");
    } finally {
      setLookingUp(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post("/issue-requests", {
        book: selectedBook,
        member: memberId,
        requestedDays: requestedDaysValue,
        note: note || undefined,
      });
      return r.data;
    },
    onSuccess: () => {
      toast.success("Request submitted successfully!");
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-slate-200 dark:border-gray-800">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BookMarked size={18} /> New Book Request
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">&times;</button>
          </div>

          {/* Member Lookup */}
          {isMemberUser && !currentMemberPathId && isProfileLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 bg-slate-50 dark:bg-gray-800 text-sm text-slate-500 dark:text-slate-300 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading your account information...
            </div>
          ) : isMemberUser && !currentMemberPathId ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 p-3 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-200">
              Your account is not linked to a member profile yet.
            </div>
          ) : isMemberUser && currentMemberLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 bg-slate-50 dark:bg-gray-800 text-sm text-slate-500 dark:text-slate-300 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading your member information...
            </div>
          ) : isMemberUser && currentMemberError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 p-3 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-200">
              Could not load your member information.
            </div>
          ) : !memberInfo ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                Enter Member ID
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. MBR123456AB"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupMember()}
                />
                <Button
                className="dark:bg-orange-600"
                 onClick={lookupMember} disabled={lookingUp || !memberCode.trim()}>
                  {lookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 bg-slate-50 dark:bg-gray-800 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {memberDisplayName(memberInfo)}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{memberInfo.code}</p>
                </div>
                {!isMemberUser && (
                  <button
                    onClick={() => { setMemberId(null); setMemberInfo(null); setMemberCode(""); }}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Book Select */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              Select Book <span className="text-red-500">*</span>
            </label>
            <Select value={selectedBook} onValueChange={setSelectedBook}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a book" />
              </SelectTrigger>
              <SelectContent>
                {books.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title} — {b.author || "Unknown"} ({b.availableCopies ?? 0} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Requested Duration */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              Borrow Duration
            </label>
            <Select
              value={durationMode === "custom" ? "custom" : requestedDays}
              onValueChange={(value) => {
                if (value === "custom") {
                  setDurationMode("custom");
                  return;
                }
                setDurationMode("preset");
                setRequestedDays(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10, 14].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                ))}
                <SelectItem value="custom">Pick return date</SelectItem>
              </SelectContent>
            </Select>
            {durationMode === "custom" && (
              <div className="space-y-1">
                <Input
                  type="date"
                  value={requestedReturnDate}
                  min={addDaysISO(requestStartDate, 1)}
                  max={addDaysISO(requestStartDate, 14)}
                  onChange={(e) => setRequestedReturnDate(e.target.value)}
                />
                <p className={cn("text-xs", invalidCustomDuration ? "text-red-500" : "text-slate-500")}>
                  {invalidCustomDuration
                    ? "Pick a return date between 1 and 14 days from today."
                    : `${requestedDaysValue} day${requestedDaysValue === 1 ? "" : "s"} requested.`}
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              Note (optional)
            </label>
            <Input
              placeholder="Any additional note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 dark:bg-orange-600"
              disabled={!memberId || !selectedBook || invalidCustomDuration || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Submitting...</>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Review Modal (approve/reject) ─────────────────────── */
const ReviewModal = ({ request, action, onClose, onSuccess }) => {
  const [reviewNote, setReviewNote] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [returnDate, setReturnDate] = useState(() => addDaysISO(todayISO(), request?.requestedDays || 7));
  const issueDays = daysBetween(issueDate, returnDate);
  const invalidIssueDates = !issueDate || !returnDate || Number.isNaN(issueDays) || issueDays < 0 || issueDays > 14;

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === "approve") {
        await api.patch(`/issue-requests/${request.id}/approve`, { reviewNote });
        return api.patch(`/issue-requests/${request.id}/issue`, { issueDate, returnDate });
      }
      if (action === "reject") {
        return api.patch(`/issue-requests/${request.id}/reject`, { reviewNote });
      }
      if (action === "issue") {
        return api.patch(`/issue-requests/${request.id}/issue`, { issueDate, returnDate });
      }
    },
    onSuccess: () => {
      toast.success(
        action === "approve" ? "Request approved and issued!" :
        action === "reject"  ? "Request rejected." :
        "Book issued successfully!"
      );
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Action failed");
    },
  });

  const title = action === "approve" ? "Approve & Issue Request" :
                action === "reject"  ? "Reject Request" :
                "Issue Book";

  const bookTitle = request?.book?.title || "—";
  const memberName = request?.member?.full_name ||
    [request?.member?.first_name, request?.member?.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-slate-200 dark:border-gray-800">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">&times;</button>
          </div>

          <div className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3 text-sm">
            <p><span className="text-slate-500">Book:</span> <span className="font-medium text-slate-800 dark:text-white">{bookTitle}</span></p>
            <p className="mt-1"><span className="text-slate-500">Member:</span> <span className="font-medium text-slate-800 dark:text-white">{memberName}</span></p>
          </div>

          {action === "approve" || action === "issue" ? (
            <div className="space-y-3">
              {action === "approve" && (
                <div>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                    Approval Note (optional)
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="Add a note..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => {
                    const nextIssueDate = e.target.value;
                    setIssueDate(nextIssueDate);
                    if (returnDate && daysBetween(nextIssueDate, returnDate) < 0) {
                      setReturnDate(nextIssueDate);
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Return Date</label>
                <Input
                  type="date"
                  value={returnDate}
                  min={issueDate}
                  max={issueDate ? addDaysISO(issueDate, 14) : undefined}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              </div>
              {invalidIssueDates && (
                <p className="text-xs text-red-500">
                  Return date must be on or after issue date and within 14 days.
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
                {action === "approve" ? "Approval Note (optional)" : "Rejection Reason (optional)"}
              </label>
              <Input
                className="mt-1"
                placeholder="Add a note..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className={cn("flex-1", action === "reject" ? "bg-red-600 hover:bg-red-700 text-white" : "dark:bg-orange-600")}
              disabled={mutation.isPending || ((action === "approve" || action === "issue") && invalidIssueDates)}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {action === "approve" ? "Approve & Issue" : action === "reject" ? "Reject" : "Issue Book"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Main Page ─────────────────────── */
const RequestBooksPage = () => {
  const qc = useQueryClient();
  const { user, token } = useSelector((s) => s.auth);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, action }

  // Fetch current user's role
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile-role", token],
    queryFn: async () => { const r = await api.get("/auth/me"); return r.data; },
    enabled: !!token,
    staleTime: 60_000,
  });

  const roleName = useMemo(() => {
    const profileUser = profileData?.user;
    const candidates = [
      profileUser?.roleInfo?.role,
      profileUser?.roleInfo?.plural,
      profileUser?.role?.role,
      profileUser?.role?.name,
      profileUser?.role,
      user?.role?.role,
      user?.role?.name,
      user?.role,
    ];

    const resolved = candidates.find((v) => typeof v === "string" && v.trim());
    return (resolved || "").toLowerCase();
  }, [profileData, user]);

  const isAdmin = roleName.includes("super") || roleName.includes("admin");
  const isModerator = roleName.includes("moderator");
  const canReview = isAdmin || isModerator;
  const isMemberUser = !canReview && /\bmembers?\b/i.test(roleName);
  const currentUser = profileData?.user || user;

  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ["issue-requests", { page, limit, status: statusFilter !== "all" ? statusFilter : undefined }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const r = await api.get("/issue-requests", { params });
      return r.data ?? { data: [], total: 0, page: 1, totalPages: 0 };
    },
    staleTime: 20_000,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const cancelMutation = useMutation({
    mutationFn: (id) => api.patch(`/issue-requests/${id}/cancel`),
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["issue-requests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed"),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["issue-requests"] });
    qc.invalidateQueries({ queryKey: ["issues"] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen size={28} /> Book Requests
          </h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">
            {canReview ? "Manage book borrow requests — approve, reject or issue directly." : "Track your book borrow requests."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button className="dark:bg-orange-600" onClick={() => setShowCreateModal(true)}>
            <PlusCircle size={16} className="mr-2" /> New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Requested">Requested</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Issued">Issued</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {total} request{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Book</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Member</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Days</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Requested</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Status</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
              {items.map((req) => {
                const memberName =
                  req.member?.full_name ||
                  [req.member?.first_name, req.member?.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={req.id} className="group hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-slate-800 dark:text-white">{req.book?.title || "—"}</div>
                      <div className="text-xs text-slate-500">{req.book?.isbn || ""}</div>
                    </td>
                    <td className="p-4 text-slate-700 dark:text-white">
                      <div className="font-medium">{memberName || "—"}</div>
                      <div className="text-xs text-slate-500">{req.member?.code || ""}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{req.requestedDays}d</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(req.createdAt)}</td>
                    <td className="p-4">
                      <Badge className={cn(statusClass(req.status))}>{req.status}</Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {canReview && req.status === "Requested" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 hover:text-emerald-700"
                              onClick={() => setReviewTarget({ request: req, action: "approve" })}
                            >
                              <CheckCircle2 size={14} className="mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setReviewTarget({ request: req, action: "reject" })}
                            >
                              <XCircle size={14} className="mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {canReview && req.status === "Approved" && (
                          <Button
                            size="sm"
                            className="dark:bg-orange-600"
                            onClick={() => setReviewTarget({ request: req, action: "issue" })}
                          >
                            <BookOpen size={14} className="mr-1" /> Issue
                          </Button>
                        )}
                        {["Requested", "Approved"].includes(req.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-500"
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={cancelMutation.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto" size={24} />
                  </td>
                </tr>
              )}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 dark:text-gray-400">
                    No requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t bg-card">
          <div className="text-sm text-muted-foreground">
            Showing {items.length} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="dark:bg-orange-600"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || isLoading}
            >
              Prev
            </Button>
            <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              className="dark:bg-orange-600"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateRequestModal
          currentUser={currentUser}
          isMemberUser={isMemberUser}
          isProfileLoading={isProfileLoading}
          onClose={() => setShowCreateModal(false)}
          onSuccess={refreshAll}
        />
      )}
      {reviewTarget && (
        <ReviewModal
          request={reviewTarget.request}
          action={reviewTarget.action}
          onClose={() => setReviewTarget(null)}
          onSuccess={refreshAll}
        />
      )}
    </div>
  );
};

export default RequestBooksPage;
