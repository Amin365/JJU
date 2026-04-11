import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  KeyRound,
  Mail,
  User2,
  Shield,
  CalendarClock,
  AtSign,
  Loader2,
  BadgeCheck,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";

import api from "@/app/api/apislice";
import Loader from "@/components/Loader";
import { cn } from "@/lib/utils";
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

const Card = ({ children, className = "" }) => (
  <div
    className={cn(
      "rounded-2xl shadow-sm border border-slate-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm",
      className
    )}
  >
    {children}
  </div>
);

const statusStyles = {
  Active:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  Inactive:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800",
  Pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
};

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : "N/A");

export default function UserDetailsAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("profile"); // profile | security
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
    staleTime: 30_000,
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

  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === String(form.role_id)),
    [roles, form.role_id]
  );

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
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-14 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/dashboard/users")}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 border border-transparent hover:border-slate-200 dark:hover:border-gray-700 transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-gray-300" />
        </button>

        <div className="flex-1">
          <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            User Details
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage account metadata, role, and security settings.
          </p>
        </div>
      </div>

      {/* Profile Hero Card */}
      <Card className="mb-6 overflow-hidden border-0 ring-1 ring-slate-200 dark:ring-gray-700">
        <div className="h-28 bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-600" />
        <div className="px-6 md:px-8 pb-7">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-10 gap-5 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white dark:border-gray-900 shadow-xl bg-slate-800 text-white flex items-center justify-center text-2xl md:text-3xl font-bold">
              {(form.first_name?.[0] || "U").toUpperCase()}
            </div>

            <div className="flex-1 mt-1">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                {fullName || "Unnamed User"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <AtSign size={14} /> {form.username || "username"}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={14} /> {form.email || "No email"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold border tracking-wide uppercase",
                    statusStyles[form.status] || "bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  {form.status}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 uppercase tracking-wide">
                  {selectedRole?.role || "No Role"}
                </span>
              </div>
            </div>

            <div className="mb-2">
              <button
                onClick={() => {
                  const payload = { ...form, role_id: form.role_id ? Number(form.role_id) : null };
                  updateMutation.mutate(payload);
                }}
                disabled={updateMutation.isPending}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white text-sm font-semibold shadow-md shadow-orange-300/40 dark:shadow-none flex items-center gap-2 disabled:opacity-60"
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {updateMutation.isPending ? "Saving..." : "Save Details"}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-gray-700">
        {[
          { key: "profile", label: "Profile", icon: User2 },
          { key: "security", label: "Security", icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === key
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
                <UserCircle2 className="text-orange-500" size={20} /> Profile Metadata
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="First Name">
                  <Input value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} />
                </Field>
                <Field label="Middle Name">
                  <Input value={form.middle_name} onChange={(e) => setForm((s) => ({ ...s, middle_name: e.target.value }))} />
                </Field>
                <Field label="Last Name">
                  <Input value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} />
                </Field>
                <Field label="Username">
                  <Input value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
                </Field>
                <Field label="Status">
                  <select
                    className="w-full border rounded-md h-10 px-3 bg-background"
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </Field>
                <Field label="Role">
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
                </Field>
                <div className="md:col-span-2">
                  <Field label="Bio">
                    <Textarea value={form.Bio} onChange={(e) => setForm((s) => ({ ...s, Bio: e.target.value }))} />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          {/* Side Info */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                Account Snapshot
              </h3>
              <div className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="Email" value={form.email || "N/A"} />
                <InfoRow icon={AtSign} label="Username" value={form.username || "N/A"} />
                <InfoRow icon={BadgeCheck} label="Role" value={selectedRole?.role || "No Role"} />
                <InfoRow icon={CalendarClock} label="Created" value={formatDate(userData?.createdAt)} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <Card className="p-6 max-w-3xl">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
            <Shield className="text-indigo-500" size={18} /> Password & Access
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="New Password">
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData((s) => ({ ...s, newPassword: e.target.value }))}
              />
            </Field>
            <Field label="Confirm Password">
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData((s) => ({ ...s, confirmPassword: e.target.value }))}
              />
            </Field>

            <div className="md:col-span-2 flex items-center gap-2 mt-1">
              <input
                id="mustChangePassword"
                type="checkbox"
                checked={passwordData.mustChangePassword}
                onChange={(e) => setPasswordData((s) => ({ ...s, mustChangePassword: e.target.checked }))}
              />
              <label htmlFor="mustChangePassword" className="text-sm text-slate-600 dark:text-slate-300">
                Force change password on next login
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                disabled={passwordMutation.isPending}
                onClick={() => {
                  if (passwordData.newPassword !== passwordData.confirmPassword) {
                    toast.error("Passwords do not match");
                    return;
                  }
                  if (!passwordData.newPassword) {
                    toast.error("Please enter a new password");
                    return;
                  }
                  passwordMutation.mutate(passwordData);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
              >
                {passwordMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {passwordMutation.isPending ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-slate-400 mt-0.5" />
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-slate-700 dark:text-slate-200 font-medium">{value}</p>
      </div>
    </div>
  );
}