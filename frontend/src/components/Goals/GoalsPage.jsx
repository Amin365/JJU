import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Pencil, Trash2, Check, X, Loader2,
  BookOpen, Clock, FileText, Flame, ChevronRight,
  TrendingUp, Calendar, Sparkles,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { extractArrayPayload } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const GOAL_TYPES = {
  pages_per_day: {
    label: "Pages / Day",
    icon: BookOpen,
    color: "#f97316",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800/40",
    ring: "ring-orange-200 dark:ring-orange-800/40",
    bar: "from-orange-400 to-orange-500",
    unit: "pages",
  },
  minutes_per_day: {
    label: "Minutes / Day",
    icon: Clock,
    color: "#8b5cf6",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800/40",
    ring: "ring-violet-200 dark:ring-violet-800/40",
    bar: "from-violet-400 to-violet-500",
    unit: "min",
  },
  reports_per_week: {
    label: "Reports / Week",
    icon: FileText,
    color: "#10b981",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/40",
    ring: "ring-emerald-200 dark:ring-emerald-800/40",
    bar: "from-emerald-400 to-emerald-500",
    unit: "reports",
  },
};

const STATUS_STYLES = {
  active:    "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
  completed: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  paused:    "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

const EMPTY_FORM = {
  goalType: "pages_per_day",
  targetValue: "",
  startDate: new Date().toISOString().slice(0, 10),
};

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
};

/* ══════════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════════ */
const GoalSkeleton = () => (
  <div className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-7 w-16 rounded-full" />
    </div>
    <Skeleton className="h-2 w-full rounded-full" />
    <div className="flex gap-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   RADIAL PROGRESS RING
══════════════════════════════════════════════════════════════ */
const RadialRing = ({ pct, color, size = 56 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-slate-100 dark:stroke-gray-800" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4}
        stroke={color} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-700"
      />
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   GOAL CARD
══════════════════════════════════════════════════════════════ */
const GoalCard = ({ goal, onEdit, onDelete }) => {
  const meta = GOAL_TYPES[goal.goalType] || GOAL_TYPES.pages_per_day;
  const Icon = meta.icon;
  const pct  = goal.currentValue != null && goal.targetValue > 0
    ? Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100)
    : 0;

  const statusStyle = STATUS_STYLES[goal.status] || STATUS_STYLES.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="group relative bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
    >
      {/* top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${meta.bar} opacity-80`} />

      <div className="p-6">
        {/* header row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            {/* icon */}
            <div className={`w-11 h-11 rounded-2xl ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0`}>
              <Icon size={19} className={meta.text} />
            </div>
            <div>
              <p className="text-[15px] font-extrabold text-slate-900 dark:text-white leading-tight">
                {meta.label}
              </p>
              {goal.startDate && (
                <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                  <Calendar size={10} /> Started {fmtDate(goal.startDate)}
                </p>
              )}
            </div>
          </div>

          {/* status + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {goal.status && (
              <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                {goal.status}
              </span>
            )}
            <button onClick={() => onEdit(goal)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all">
              <Pencil size={14} />
            </button>
            <button onClick={() => onDelete(goal)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* progress section */}
        <div className="flex items-center gap-5">
          {/* ring */}
          <div className="relative">
            <RadialRing pct={pct} color={meta.color} size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-extrabold text-slate-800 dark:text-white">{pct}%</span>
            </div>
          </div>

          {/* numbers + bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-[26px] font-extrabold leading-none text-slate-900 dark:text-white">
                {goal.currentValue ?? 0}
              </span>
              <span className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">
                / {goal.targetValue} {meta.unit}
              </span>
            </div>

            {/* bar */}
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
                initial={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              />
            </div>

            {/* remaining label */}
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-1.5">
              {pct >= 100
                ? "🎉 Goal reached!"
                : `${goal.targetValue - (goal.currentValue ?? 0)} ${meta.unit} remaining`
              }
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════════════════
   FORM
══════════════════════════════════════════════════════════════ */
const GoalForm = ({ editingGoal, formData, setFormData, isSaving, onSubmit, onCancel }) => {
  const selected = GOAL_TYPES[formData.goalType] || GOAL_TYPES.pages_per_day;
  const SelIcon  = selected.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800/40 rounded-2xl shadow-lg shadow-orange-100 dark:shadow-orange-900/10 overflow-hidden"
    >
      {/* form header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-orange-50/50 dark:bg-orange-900/10">
        <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm shadow-orange-200">
          <Target size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-[14px] font-extrabold text-slate-900 dark:text-white">
            {editingGoal ? "Edit goal" : "New reading goal"}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Set a target to build your habit</p>
        </div>
        <button onClick={onCancel}
          className="ml-auto w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">

          {/* Goal type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Goal type <span className="text-orange-500">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {Object.entries(GOAL_TYPES).map(([val, meta]) => {
                const GIcon = meta.icon;
                const active = formData.goalType === val;
                return (
                  <button key={val} type="button" onClick={() => setFormData(p => ({ ...p, goalType: val }))}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all
                      ${active
                        ? `${meta.bg} ${meta.border} ${meta.text} ring-2 ${meta.ring}`
                        : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-orange-200 dark:hover:border-orange-800/40"
                      }`}
                  >
                    <GIcon size={14} className={active ? meta.text : "text-slate-400"} />
                    <span className="text-[12.5px] font-semibold">{meta.label}</span>
                    {active && <Check size={12} className={`ml-auto ${meta.text}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target + date */}
          <div className="sm:col-span-2 flex flex-col gap-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                Daily / Weekly target <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <SelIcon size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${selected.text}`} />
                <Input
                  type="number" min={1} required
                  value={formData.targetValue}
                  onChange={e => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                  placeholder={`e.g. ${formData.goalType === "pages_per_day" ? "30" : formData.goalType === "minutes_per_day" ? "45" : "3"}`}
                  className="pl-9 h-11 rounded-xl border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-[13px] focus-visible:ring-orange-300 focus-visible:border-orange-400"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Target {selected.unit} per {formData.goalType === "reports_per_week" ? "week" : "day"}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                Start date <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date" required
                  value={formData.startDate}
                  onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                  className="pl-9 h-11 rounded-xl border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-[13px] focus-visible:ring-orange-300 focus-visible:border-orange-400"
                />
              </div>
            </div>

            {/* preview */}
            {formData.targetValue && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${selected.bg} ${selected.border}`}>
                <SelIcon size={15} className={selected.text} />
                <p className={`text-[12.5px] font-semibold ${selected.text}`}>
                  You'll aim for <span className="font-extrabold">{formData.targetValue} {selected.unit}</span> every {formData.goalType === "reports_per_week" ? "week" : "day"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-gray-800">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-extrabold flex items-center gap-2 shadow-md shadow-orange-200 dark:shadow-orange-900/30 transition-all active:scale-[0.98] disabled:opacity-60">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editingGoal ? "Update goal" : "Create goal"}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function GoalsPage() {
  const user = useSelector(s => s.auth.user);
  const qc   = useQueryClient();

  const [showForm,     setShowForm]     = useState(false);
  const [editingGoal,  setEditingGoal]  = useState(null);
  const [formData,     setFormData]     = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: goals = [], isLoading, isError } = useQuery({
    queryKey: ["my-goals"],
    queryFn: async () => {
      const res = await api.get("/users/me/goals");
      return extractArrayPayload(res.data);
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: body => api.post("/users/me/goals", body),
    onSuccess: () => { qc.invalidateQueries(["my-goals"]); setShowForm(false); setFormData(EMPTY_FORM); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/users/me/goals/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(["my-goals"]); setEditingGoal(null); setShowForm(false); setFormData(EMPTY_FORM); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/users/me/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries(["my-goals"]); setDeleteTarget(null); },
  });

  const openEdit = (goal) => {
    setEditingGoal(goal.id);
    setFormData({ goalType: goal.goalType, targetValue: String(goal.targetValue), startDate: goal.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = { goalType: formData.goalType, targetValue: Number(formData.targetValue), startDate: formData.startDate };
    editingGoal ? updateMutation.mutate({ id: editingGoal, body }) : createMutation.mutate(body);
  };

  const handleCancel = () => { setShowForm(false); setEditingGoal(null); setFormData(EMPTY_FORM); };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  /* summary stats */
  const activeCount    = goals.filter(g => g.status === "active" || !g.status).length;
  const completedCount = goals.filter(g => g.status === "completed").length;
  const avgPct         = goals.length > 0
    ? Math.round(goals.reduce((acc, g) => acc + (g.currentValue && g.targetValue ? Math.min((g.currentValue / g.targetValue) * 100, 100) : 0), 0) / goals.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 pb-20">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          {/* eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 text-orange-500 text-[11px] font-extrabold uppercase tracking-widest mb-5">
            <Sparkles size={11} className="fill-orange-400" />
            Your progress
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <h1 className="text-[32px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight flex items-center gap-3">
                <span>Reading Goals</span>
                <Target size={28} className="text-orange-500" />
              </h1>
              <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">
                Set daily and weekly targets to build a consistent reading habit.
              </p>
            </div>

            <button
              onClick={() => { setEditingGoal(null); setFormData(EMPTY_FORM); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-extrabold shadow-md shadow-orange-200 dark:shadow-orange-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Plus size={16} />
              New goal
            </button>
          </div>

          {/* Summary cards */}
          {goals.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-7">
              {[
                { icon: Target,      value: goals.length,    label: "Total goals",    color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-100 dark:border-orange-800/40" },
                { icon: Flame,       value: activeCount,     label: "Active",         color: "text-emerald-500",bg: "bg-emerald-50 dark:bg-emerald-900/20",border: "border-emerald-100 dark:border-emerald-800/40" },
                { icon: Check,       value: completedCount,  label: "Completed",      color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20",     border: "border-blue-100 dark:border-blue-800/40" },
                { icon: TrendingUp,  value: `${avgPct}%`,    label: "Avg progress",   color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-100 dark:border-violet-800/40" },
              ].map(({ icon: Icon, value, label, color, bg, border }) => (
                <div key={label} className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${bg} ${border}`}>
                  <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div>
                    <p className={`text-[20px] font-extrabold ${color} leading-none`}>{value}</p>
                    <p className="text-[11.5px] text-slate-400 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 space-y-5">

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <GoalForm
              editingGoal={editingGoal}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}
        </AnimatePresence>

        {isError && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 text-[13px] font-semibold text-red-600">
            Failed to load goals. Please try again.
          </div>
        )}

        {/* Goal cards — 3 col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <GoalSkeleton key={i} />)
              : goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                ))
            }
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {!isLoading && goals.length === 0 && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 flex items-center justify-center mb-5 shadow-sm">
              <Target size={32} className="text-orange-400" />
            </div>
            <h3 className="text-[18px] font-extrabold text-slate-800 dark:text-white mb-2">No goals yet</h3>
            <p className="text-[14px] text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed mb-6">
              Create your first reading goal to start tracking your progress and building a daily habit.
            </p>
            <button
              onClick={() => { setEditingGoal(null); setFormData(EMPTY_FORM); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-extrabold shadow-md shadow-orange-200 dark:shadow-orange-900/30 transition-all hover:scale-[1.02]"
            >
              <Plus size={15} /> Create first goal
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Delete confirm dialog ─────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-gray-700 shadow-2xl max-w-sm">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <DialogTitle className="text-[17px] font-extrabold text-slate-900 dark:text-white">
              Delete goal
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Are you sure you want to permanently delete{" "}
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {GOAL_TYPES[deleteTarget?.goalType]?.label || deleteTarget?.goalType}
            </span>? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <DialogClose asChild>
              <button className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-extrabold flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete goal
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}