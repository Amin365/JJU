import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, KeyRound, Mail, User2, Shield, CalendarClock, AtSign } from "lucide-react";
import { toast } from "sonner";

import api from "@/app/api/apislice";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const emptyForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  username: "",
  email: "",
  status: "Active",
  role_id: "",
  Bio: "",
};

export default function UserDetailsAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
    mustChangePassword: true,
  });

  const { data: userData, isLoading } = useQuery({
    queryKey: ["user-details", id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}`);
      return res.data?.data || res.data;
    },
    enabled: !!id,
  });

  const { data: rolesData } = useQuery({
    queryKey: ["roles-for-user-edit"],
    queryFn: async () => {
      const res = await api.get("/roles");
      return res.data?.data || [];
    },
  });

  const roles = useMemo(() => (Array.isArray(rolesData) ? rolesData : []), [rolesData]);

  const fullName = useMemo(
    () => [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" ").trim(),
    [form.first_name, form.middle_name, form.last_name]
  );

  const statusClass = useMemo(() => {
    if (form.status === "Active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (form.status === "Inactive") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  }, [form.status]);

  useEffect(() => {
    if (!userData) return;
    setForm({
      first_name: userData.first_name || "",
      middle_name: userData.middle_name || "",
      last_name: userData.last_name || "",
      username: userData.username || "",
      email: userData.email || "",
      status: userData.status || "Active",
      role_id: userData.role?.id ? String(userData.role.id) : "",
      Bio: userData.Bio || "",
    });
  }, [userData]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.patch(`/users/${id}`, payload);
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      toast.success("User details updated");
      queryClient.invalidateQueries({ queryKey: ["user-details", id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update user");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/users/${id}/password`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("User password updated");
      setPasswordData({ newPassword: "", confirmPassword: "", mustChangePassword: true });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update password");
    },
  });

  if (isLoading) return <Loader />;

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">User Profile Details</h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">Manage account metadata and security settings.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/users")}>
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-4 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-orange-500 to-indigo-500" />
          <CardContent className="-mt-10 p-6">
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg bg-slate-800 text-white flex items-center justify-center text-2xl font-bold">
              {(form.first_name?.[0] || "U").toUpperCase()}
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{fullName || "Unnamed User"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">@{form.username || "username"}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", statusClass)}>{form.status}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                {roles.find((r) => String(r.id) === String(form.role_id))?.role || "No Role"}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {form.email || "No email"}</div>
              <div className="flex items-center gap-2"><AtSign size={14} className="text-slate-400" /> {form.username || "No username"}</div>
              <div className="flex items-center gap-2"><CalendarClock size={14} className="text-slate-400" /> Created: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "N/A"}</div>
            </div>
          </CardContent>
        </Card>

        <div className="xl:col-span-8 flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><User2 size={18} /> Profile Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500">First Name</label>
                <Input value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Middle Name</label>
                <Input value={form.middle_name} onChange={(e) => setForm((s) => ({ ...s, middle_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Last Name</label>
                <Input value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Username</label>
                <Input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Status</label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500">Role</label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={form.role_id}
                  onChange={(e) => setForm((s) => ({ ...s, role_id: e.target.value }))}
                >
                  <option value="">No Role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-slate-500">Bio</label>
                <Textarea value={form.Bio} onChange={(e) => setForm((s) => ({ ...s, Bio: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  className="dark:bg-orange-600"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    const payload = {
                      ...form,
                      role_id: form.role_id ? Number(form.role_id) : null,
                    };
                    updateMutation.mutate(payload);
                  }}
                >
                  <Save size={16} className="mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Details"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Shield size={18} /> Security</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500">New Password</label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((s) => ({ ...s, newPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500">Confirm Password</label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((s) => ({ ...s, confirmPassword: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="mustChangePassword"
                  type="checkbox"
                  checked={passwordData.mustChangePassword}
                  onChange={(e) => setPasswordData((s) => ({ ...s, mustChangePassword: e.target.checked }))}
                />
                <label htmlFor="mustChangePassword" className="text-sm">Force change password on next login</label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button
                  variant="outline"
                  disabled={passwordMutation.isPending}
                  onClick={() => passwordMutation.mutate(passwordData)}
                >
                  <KeyRound size={16} className="mr-2" />
                  {passwordMutation.isPending ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
