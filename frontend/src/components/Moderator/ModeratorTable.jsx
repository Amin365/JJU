import React, { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { toast } from "react-toastify";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Loader from "../Loader";


export default function ModeratorMembersPage() {
  const qc = useQueryClient();
  const { moderatorId } = useParams();

  const [showAdd, setShowAdd] = useState(false);
  const [searchAssigned, setSearchAssigned] = useState("");
  const [searchAvailable, setSearchAvailable] = useState("");

  // 1) Assigned members for this moderator
  const { data: assigned = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["moderators", moderatorId, "members"],
    queryFn: () => api.get(`/moderators/${moderatorId}/members`).then((r) => r.data.data ?? []),
    enabled: Boolean(moderatorId),
    staleTime: 10_000,
  });

  // NOTE: backend might return [{ _id, moderator, member: {...} }]
  const assignedMembers = useMemo(() => {
    return (assigned || [])
      .map((x) => x.member)
      .filter(Boolean);
  }, [assigned]);

  // 2) Available (unassigned) members, only fetch when "Add Members" opened
  const { data: available = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["members", "unassigned"],
    queryFn: () => api.get("/members/unassigned").then((r) => r.data.data ?? []),
    enabled: showAdd,
    staleTime: 10_000,
  });

  const assignMutation = useMutation({
    mutationFn: (memberId) => api.post(`/moderators/${moderatorId}/assign`, { memberId }),
    onSuccess: () => {
      toast.success("Member assigned successfully");
      qc.invalidateQueries({ queryKey: ["moderators", moderatorId, "members"] });
      qc.invalidateQueries({ queryKey: ["members", "unassigned"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to assign member");
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (memberId) => api.delete(`/moderators/${moderatorId}/unassign/${memberId}`),
    onSuccess: () => {
      toast.success("Member unassigned successfully");
      qc.invalidateQueries({ queryKey: ["moderators", moderatorId, "members"] });
      qc.invalidateQueries({ queryKey: ["members", "unassigned"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to unassign member");
    },
  });

  const filteredAssigned = useMemo(() => {
    const q = searchAssigned.trim().toLowerCase();
    if (!q) return assignedMembers;

    return assignedMembers.filter((m) => {
      const name =
        m.full_name ||
        [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ");
      return (
        String(name || "").toLowerCase().includes(q) ||
        String(m.email || "").toLowerCase().includes(q) ||
        String(m.code || "").toLowerCase().includes(q)
      );
    });
  }, [assignedMembers, searchAssigned]);

  const filteredAvailable = useMemo(() => {
    const q = searchAvailable.trim().toLowerCase();
    if (!q) return available;

    return (available || []).filter((m) => {
      const name =
        m.full_name ||
        [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ");
      return (
        String(name || "").toLowerCase().includes(q) ||
        String(m.email || "").toLowerCase().includes(q) ||
        String(m.code || "").toLowerCase().includes(q)
      );
    });
  }, [available, searchAvailable]);

  return (
    <div className="p-6 space-y-4">
    <div>
    <Button className="p-4 mb-4" variant="outline" onClick={() => window.history.back()}>
      Back 
    </Button>


    </div>
      <div className="mb-4 p-4  dark:text-white text-gray-800 rounded">
        <p className="dark:text-white">Manage assigned members for this moderator.</p>
      </div>

      {/* Header row */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Input
            placeholder="Search assigned members..."
            value={searchAssigned}
            onChange={(e) => setSearchAssigned(e.target.value)}
            className="w-64"
          />
        </div>

        <Button 
        className="dark:bg-orange-600"
        
        onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "Add Members"}
        </Button>
      </div>

      {/* Assigned Members Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Assigned Members</CardTitle>
        </CardHeader>

        <CardContent className="text-sm">
          {loadingAssigned ? (
            <div className="py-10 text-center text-muted-foreground">Loading assigned members...</div>
          ) : filteredAssigned.length > 0 ? (
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full ">
                <thead className=" border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Code</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssigned.map((m) => {
                    const name =
                      m.full_name ||
                      [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ");
                    return (
                      <tr key={m.id} className="border-b ">
                        <td className="px-4 py-3">{name || "N/A"}</td>
                        <td className="px-4 py-3">{m.email || "N/A"}</td>
                        <td className="px-4 py-3">{m.code || "N/A"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => unassignMutation.mutate(m.id)}
                            disabled={unassignMutation.isPending}
                          >
                            Unassign
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-gray-500">
              <h2 className="text-lg font-semibold text-gray-700">No Members Assigned</h2>
              <p className="text-gray-500 mt-2 max-w-sm">
                This moderator has no assigned members. Click <strong>Add Members</strong> to assign.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Members (Add Section) */}
      {showAdd && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Available Members (Not Assigned)</CardTitle>
            <Input
              placeholder="Search available members..."
              value={searchAvailable}
              onChange={(e) => setSearchAvailable(e.target.value)}
              className="w-64"
            />
          </CardHeader>

          <CardContent className="text-sm">
            {loadingAvailable ? (
              <div className="py-10 text-center text-muted-foreground">Loading available members...</div>
            ) : filteredAvailable.length > 0 ? (
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full ">
                  <thead className=" border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Code</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvailable.map((m) => {
                      const name =
                        m.full_name ||
                        [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ");
                      return (
                        <tr key={m.id} className="border-b ">
                          <td className="px-4 py-3">{name || "N/A"}</td>
                          <td className="px-4 py-3">{m.email || "N/A"}</td>
                          <td className="px-4 py-3">{m.code || "N/A"}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              className="dark:bg-orange-600"
                              onClick={() => assignMutation.mutate(m.id)}
                              disabled={assignMutation.isPending}
                            >
                              Assign
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center text-gray-500">
                <h2 className="text-lg font-semibold text-gray-700">No Available Members</h2>
                <p className="text-gray-500 mt-2 max-w-sm">
                  All members are already assigned. If you need more, please create a new member.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}