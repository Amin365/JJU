import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";

import api from "@/app/api/apislice";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">User Details</h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">Edit this user information and credentials.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/users")}>
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">First Name</label>
            <Input value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Middle Name</label>
            <Input value={form.middle_name} onChange={(e) => setForm((s) => ({ ...s, middle_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Last Name</label>
            <Input value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Username</label>
            <Input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Status</label>
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
            <label className="text-sm">Role</label>
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
            <label className="text-sm">Bio</label>
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
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">New Password</label>
            <Input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData((s) => ({ ...s, newPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm">Confirm Password</label>
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
  );
}
