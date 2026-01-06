import React, { useMemo } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Book, Calendar, CheckCircle2, Plus } from "lucide-react";

const fetchIssues = async () => {
  const res = await api.get("/issue");
  return res.data?.data ?? res.data ?? [];
};

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : "—");

const statusClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "issued") return "bg-blue-100 text-blue-700 hover:bg-blue-100";
  if (s === "returned") return "bg-green-100 text-green-700 hover:bg-green-100";
  if (s === "overdue") return "bg-red-100 text-red-700 hover:bg-red-100";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
};

const IssuesTable = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["issues"],
    queryFn: fetchIssues,
    staleTime: 20_000,
  });

  const issues = Array.isArray(data) ? data : [];

  const markReturned = useMutation({
    mutationFn: async (id) => {
      const res = await api.patch(`/issue/${id}/return`);
      return res.data?.data ?? res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success("Marked as returned");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to mark returned");
    },
  });

  const rows = useMemo(() => issues, [issues]);

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 dark:bg-gray-900 bg-slate-50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Issued Books</h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">Track issued/returned books.</p>
        </div>

        {/* <div className="flex gap-3">
          <Button onClick={() => navigate("/dashboard/issues/request")}>
            <Plus size={16} /> <span className="ml-2">Issue Book</span>
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> <span className="ml-2">Back</span>
          </Button>
        </div> */}
      </div>

      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Book</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Member</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Issue Date</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Return Date</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Status</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
              {rows.map((it) => {
                const memberName =
                  it.member?.full_name ||
                  [it.member?.first_name, it.member?.middle_name, it.member?.last_name]
                    .filter(Boolean)
                    .join(" ");

                return (
                  <tr key={it._id} className="group hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Book className="w-4 h-4 text-slate-500" />
                        <div>
                          <div className="font-medium text-slate-800 dark:text-white">{it.book?.title || "—"}</div>
                          <div className="text-xs text-slate-500 dark:text-gray-300">{it.book?.isbn || ""}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-slate-700 dark:text-white">
                      <div className="font-medium">{memberName || "—"}</div>
                      <div className="text-xs text-slate-500">{it.member?.code || ""}</div>
                    </td>

                    <td className="p-4 text-slate-700 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {formatDate(it.issueDate)}
                      </div>
                    </td>

                    <td className="p-4 text-slate-700 dark:text-white">{formatDate(it.returnDate)}</td>

                    <td className="p-4">
                      <Badge className={cn(statusClass(it.status))}>{it.status || "Issued"}</Badge>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {it.status !== "Returned" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markReturned.mutate(it._id)}
                            disabled={markReturned.isPending}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark Returned
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 dark:text-gray-400">
                    Loading issues...
                  </td>
                </tr>
              )}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 dark:text-gray-400">
                    No issued books yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default IssuesTable;