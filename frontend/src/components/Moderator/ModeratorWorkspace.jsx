import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import api from "@/app/api/apislice";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  AlertTriangle,
  FileX,
  TrendingDown,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";

/* ── helpers ── */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <Card>
    <CardContent className="flex items-center gap-4 py-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold dark:text-white">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const IndicatorBadge = ({ label, colorClass }) => (
  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", colorClass)}>
    {label}
  </span>
);

/* ── main component ── */
export default function ModeratorWorkspace() {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth?.user);
  const [selectedModerator, setSelectedModerator] = useState(user?._id || "");

  // Fetch moderators list for selector (admins can pick a moderator)
  const { data: modsData } = useQuery({
    queryKey: ["moderators-list"],
    queryFn: async () => {
      const res = await api.get("/moderators");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const moderators = modsData ?? [];

  // Auto-select current user if they are in the list
  React.useEffect(() => {
    if (!selectedModerator && moderators.length > 0) {
      const me = moderators.find((m) => m._id === user?._id);
      if (me) setSelectedModerator(me._id);
      else if (moderators.length > 0) setSelectedModerator(moderators[0]._id);
    }
  }, [moderators, user, selectedModerator]);

  const {
    data: wsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["moderator-workspace", selectedModerator],
    queryFn: async () => {
      const res = await api.get(`/moderators/${selectedModerator}/workspace`);
      return res.data?.data;
    },
    enabled: Boolean(selectedModerator),
    staleTime: 30_000,
  });

  const summary = wsData?.summary ?? {};
  const members = wsData?.members ?? [];
  const moderator = wsData?.moderator ?? {};

  return (
    <div className="flex flex-col gap-6 p-4 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck size={28} className="text-orange-500" />
            Moderator Workspace
          </h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">
            Overview of your assigned members and their activity status.
          </p>
        </div>

        {/* Moderator selector (visible to admins) */}
        {moderators.length > 1 && (
          <select
            className="rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 text-sm"
            value={selectedModerator}
            onChange={(e) => setSelectedModerator(e.target.value)}
          >
            {moderators.map((m) => (
              <option key={m._id} value={m._id}>
                {m.first_name} {m.last_name} ({m.role?.role || "Moderator"})
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-orange-500" size={36} />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-red-500">
            Failed to load workspace data.
          </CardContent>
        </Card>
      )}

      {!isLoading && wsData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Assigned" value={summary.totalAssigned ?? 0} color="bg-blue-500" />
            <StatCard icon={AlertTriangle} label="With Overdue Items" value={summary.withOverdue ?? 0} color="bg-red-500" />
            <StatCard icon={FileX} label="Missing Reports (7d)" value={summary.missingReports ?? 0} color="bg-yellow-500" />
            <StatCard icon={TrendingDown} label="Low Activity" value={summary.lowActivity ?? 0} color="bg-slate-400" />
          </div>

          {/* Members table */}
          <Card className="flex-1">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 dark:text-white">
                Assigned Members
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/dashboard/moderators/${selectedModerator}/members`)}
              >
                Full View <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-gray-900 border-b">
                  <tr>
                    <th className="p-3 font-semibold">Name</th>
                    <th className="p-3 font-semibold">Code</th>
                    <th className="p-3 font-semibold">Department</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Indicators</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr
                      key={m._id}
                      className="hover:bg-slate-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="p-3 font-medium dark:text-white">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{m.code}</td>
                      <td className="p-3 text-slate-500">{m.department || "—"}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-semibold",
                            m.status === "Active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          )}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {m.overdueCount > 0 && (
                            <IndicatorBadge
                              label={`${m.overdueCount} overdue`}
                              colorClass="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            />
                          )}
                          {m.missingRecentReport && (
                            <IndicatorBadge
                              label="No recent report"
                              colorClass="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                            />
                          )}
                          {!m.overdueCount && !m.missingRecentReport && (
                            <IndicatorBadge
                              label="On track"
                              colorClass="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/dashboard/members/${m._id}`)}
                        >
                          View <ArrowRight size={13} className="ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400">
                        No members assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
