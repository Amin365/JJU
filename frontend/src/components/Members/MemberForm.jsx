import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Save,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
// import { useTheme } from "@mui/material/styles";
import api from "@/app/api/apislice";
import { toast } from "sonner";

// Local Card (glassmorphism)
const Card = ({ children, className = "" }) => (
  <div
    className={`backdrop-blur-md bg-white/80 dark:bg-gray-900/80 p-8 rounded-2xl shadow-2xl border border-slate-200/70 dark:border-gray-700/80 ${className}`}
  >
    {children}
  </div>
);

const MembersForm = () => {
  // const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();

  const activeId = id ?? null;
  const isEditMode = Boolean(activeId);

  const [step, setStep] = useState(1);
  const qc = useQueryClient();

  // Fetch member when editing
  const {
    data: fetchedMemberData,
    isLoading: isFetchingMember,
  } = useQuery({
    queryKey: ["member", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const resp = await api.get(`/members/${activeId}`);
      return resp.data?.data ?? resp.data;
    },
    staleTime: 30_000,
  });

  // create & update mutations
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const resp = await api.post("/members", payload);
      return resp.data?.data ?? resp.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success(
        `Member "${data.first_name || data.firstName || ""} ${
          data.last_name || data.lastName || ""
        }" created successfully.`
      );
      resetFormAfterSuccess();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to create member";
      toast.error(msg);
      console.error(err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id: memberId, payload }) => {
      const resp = await api.put(`/members/${memberId}`, payload);
      return resp.data?.data ?? resp.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", data._id ?? data.id] });
      toast.success(`Member "${data.first_name || data.last_name || ""}" updated successfully.`);
      resetFormAfterSuccess();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to update member";
      toast.error(msg);
      console.error(err);
    },
  });

  const isProcessing = createMutation.isLoading || updateMutation.isLoading;

  // react-hook-form setup with education fields included
  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    reset,
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      code: "",
      phone: "",
      email: "",
      date_of_birth: "",
      gender: "Male",
      region: "",
      join_date: "",
      notes: "",
      emergency_contact: "",
      alt_phone: "",
      alt_email: "",
      status: "Active",

      // education fields
      department: "",
      student_id: "",
      study_year: "", // e.g. "1","2","3","4","5"
    },
  });

  // populate form when editing (include education fields)
  useEffect(() => {
    if (isEditMode && fetchedMemberData) {
      const m = fetchedMemberData;
      reset({
        first_name: m.first_name || "",
        middle_name: m.middle_name || "",
        last_name: m.last_name || "",
        code: m.code || "",
        phone: m.phone || "",
        email: m.email || "",
        date_of_birth: m.date_of_birth ? m.date_of_birth.split?.("T")[0] : "",
        gender: m.gender || "Male",
        region: m.region || "",
        join_date: m.join_date ? m.join_date.split?.("T")[0] : "",
        notes: m.notes || "",
        emergency_contact: m.emergency_contact || "",
        alt_phone: m.alt_phone || "",
        alt_email: m.alt_email || "",
        status: m.status || "Active",

      
        department: m.department || "",
        student_id: m.student_id || "",
        study_year: m.study_year ?? "",
      });
    }
  }, [fetchedMemberData, isEditMode, reset]);

  // reset + navigate after success
  const resetFormAfterSuccess = () => {
    reset();
    setStep(1);
    setTimeout(() => {
      navigate("/dashboard/members");
    }, 1000);
  };

  // Step navigation
  const nextStep = async (e, fieldsToValidate) => {
    e.preventDefault();
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep((prev) => prev + 1);
  };

  const prevStep = (e) => {
    e.preventDefault();
    setStep((prev) => Math.max(1, prev - 1));
  };

  // submission (include education fields in payload)
  const onSubmitHandler = async (data) => {
    // normalize dates to ISO or undefined
    const payload = {
      first_name: data.first_name || undefined,
      middle_name: data.middle_name || undefined,
      last_name: data.last_name || undefined,
      code: data.code || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      date_of_birth: data.date_of_birth ? new Date(data.date_of_birth).toISOString() : undefined,
      gender: data.gender || undefined,
      region: data.region || undefined,
      join_date: data.join_date ? new Date(data.join_date).toISOString() : undefined,
      notes: data.notes || undefined,
      emergency_contact: data.emergency_contact || undefined,
      alt_phone: data.alt_phone || undefined,
      alt_email: data.alt_email || undefined,
      status: data.status || undefined,

      // education
      department: data.department || undefined,
      student_id: data.student_id || undefined,
      study_year: data.study_year || undefined,
    };

    try {
      if (isEditMode && activeId) {
        await updateMutation.mutateAsync({ id: activeId, payload });
        return;
      }

      await createMutation.mutateAsync(payload);
    } catch (err) {
      // mutations already handle toasts on error
      console.error("Member submit error:", err);
    }
  };

  // Field components
  const Field = ({ label, name, type = "text", placeholder, validation, helperText, ...rest }) => (
    <div className="relative w-full mb-6 group">
      <label
        htmlFor={name}
        className={`block text-sm font-semibold tracking-wide mb-1 ${
          errors[name] ? "text-red-500" : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {label} {validation && validation.required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        type={type}
        {...register(name, validation)}
        placeholder={placeholder || ""}
        className={`
          w-full px-3 py-2.5 rounded-xl text-sm md:text-base
          border ${errors[name] ? "border-red-500 ring-1 ring-red-300" : "border-slate-200 dark:border-gray-700"}
          bg-white/80 dark:bg-gray-900/70
          text-slate-800 dark:text-gray-100
          shadow-sm
          focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-orange-500
          transition-all duration-200
        `}
        {...rest}
      />
      {helperText && !errors[name] && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{helperText}</p>}
      {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name].message}</p>}
    </div>
  );

  const SelectField = ({ label, name, options, validation, helperText }) => (
    <div className="relative w-full mb-6 group">
      <label htmlFor={name} className={`block text-sm font-semibold tracking-wide mb-1 ${errors[name] ? "text-red-500" : "text-slate-600 dark:text-slate-300"}`}>
        {label} {validation && validation.required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          id={name}
          {...register(name, validation)}
          className={`
            w-full px-3 py-2.5 rounded-xl text-sm md:text-base
            border ${errors[name] ? "border-red-500 ring-1 ring-red-300" : "border-slate-200 dark:border-gray-700"}
            bg-white/80 dark:bg-gray-900/70
            text-slate-800 dark:text-gray-100
            shadow-sm
            focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-orange-500
            transition-all duration-200
            appearance-none cursor-pointer
          `}
        >
          <option value="" disabled hidden className="text-slate-400">
            Select {label}...
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-800">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
      </div>
      {helperText && !errors[name] && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{helperText}</p>}
      {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name].message}</p>}
    </div>
  );

  // fields to validate per step
  const stepFields = {
    1: ["first_name", "last_name", "email", "gender"],
    2: ["join_date", "region"],
    3: [],
  };

  // step components — education fields added into step 2
  const stepComponents = {
    1: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <Field label="First Name" name="first_name" validation={{ required: "First Name is required." }} />
        <Field label="Middle Name" name="middle_name" />
        <Field label="Last Name" name="last_name" validation={{ required: "Last Name is required." }} />
        <SelectField label="Gender" name="gender" options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }]} validation={{ required: "Gender is required." }} />
        <Field label="Email Address" name="email" type="email" validation={{ required: "Email is required.", pattern: { value: /^\S+@\S+$/i, message: "Invalid email address." } }} />
        <Field label="Phone Number" name="phone" type="tel" />
        <Field label="Date of Birth" name="date_of_birth" type="date" />
        <Field label="Region" name="region" />
      </div>
    ),
    2: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <Field label="Member Code (optional)" name="code" helperText="Leave blank to auto-generate." />
        <Field label="Join Date" name="join_date" type="date" validation={{ required: "Join Date is required." }} />

        {/* Education fields */}
        <Field label="Department" name="department" helperText="e.g. Computer Science, Literature" />
        <Field label="Student / Member ID" name="student_id" helperText="Institutional ID if applicable" />

        <div className="sm:col-span-2">
          <SelectField
            label="Study Year"
            name="study_year"
            options={[
              { value: "", label: "Not applicable" },
              { value: "1", label: "1st Year" },
              { value: "2", label: "2nd Year" },
              { value: "3", label: "3rd Year" },
              { value: "4", label: "4th Year" },
              { value: "5", label: "5th Year" },
            ]}
            helperText="Select academic year (if member is a student)."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Notes (optional)</label>
          <textarea {...register("notes")} className="w-full mt-2 p-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 text-sm dark:text-gray-100" />
        </div>
      </div>
    ),
    3: (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          <Field label="Emergency Contact" name="emergency_contact" />
          <Field label="Phone (alt)" name="alt_phone" />
          <Field label="Email (alt)" name="alt_email" type="email" />
        </div>

        <div className="pt-4 border-t border-slate-200/70 dark:border-gray-700/60">
          <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">Member Status</label>
          <div className="flex flex-wrap gap-4">
            {["Active", "Inactive"].map((status) => (
              <label key={status} className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-100/80 dark:hover:bg-gray-800/80 transition-colors">
                <input type="radio" value={status} {...register("status")} className="h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{status}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className={`min-h-screen py-8 px-4 }`}>
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className={`text-3xl md:text-4xl font-extrabold ${"text-slate-900"} tracking-tight`}>{isEditMode ? "Update Member" : "New Member Registration"}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl">Capture personal, membership and education details in a guided flow.</p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/members")}
            className="flex items-center gap-2 md:p-2.5 px-4 py-2 bg-white/80 dark:bg-gray-900/80 text-slate-600 dark:text-slate-200 shadow-lg hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl border border-slate-200/70 dark:border-gray-700/80 transition-all text-xs md:text-sm font-semibold"
          >
            <ChevronLeft size={18} /> <span>Back to List</span>
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex justify-between items-center mb-10">
          {[
            { step: 1, name: "Personal Info", Icon: Users },
            { step: 2, name: "Membership & Education", Icon: Save },
            { step: 3, name: "Extras", Icon: Save },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center flex-1">
              <div className={`flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-full border transition-all duration-300 ${step === s.step ? "bg-orange-600 text-white border-orange-500 shadow-xl scale-105" : step > s.step ? "bg-emerald-50 text-emerald-600 border-emerald-300" : "bg-slate-200 text-slate-500 border-slate-300"}`}>
                {step > s.step ? <CheckCircle size={18} /> : <s.Icon size={18} />}
              </div>
              <p className={`mt-2 text-xs md:text-sm text-center font-medium ${step === s.step ? "text-orange-600" : "text-slate-500 dark:text-slate-400"}`}>{s.name}</p>
            </div>
          ))}
        </div>

        <Card className="min-h-[420px]">
          {isEditMode && isFetchingMember ? (
            <div className="flex flex-col gap-3 justify-center items-center h-40">
              <Loader className="animate-spin text-orange-600" size={36} />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading member details...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmitHandler)}>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Step {step}{" "}
                  <span className="text-sm md:text-base font-normal text-slate-500 dark:text-slate-400">
                    {step === 1 ? "Personal Information" : step === 2 ? "Membership & Education" : "Extras & Status"}
                  </span>
                </h2>
                <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500">{step} / 3</span>
              </div>

              {stepComponents[step]}

              <div className="flex justify-between mt-10 pt-6 border-t border-slate-200/70 dark:border-gray-700/80">
                {step > 1 ? (
                  <button type="button" onClick={prevStep} disabled={isProcessing} className="px-5 py-2.5 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 text-sm md:text-base font-semibold rounded-xl hover:bg-slate-100/80 dark:hover:bg-gray-800/80 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60">
                    <ChevronLeft size={18} /> Previous
                  </button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <button key="next-btn" type="button" onClick={(e) => nextStep(e, stepFields[step])} disabled={isProcessing} className="px-6 py-2.5 bg-orange-600 text-white text-sm md:text-base font-semibold rounded-xl hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-lg disabled:opacity-60">
                    Next Step <ChevronRight size={18} />
                  </button>
                ) : (
                  <button key="submit-btn" type="submit" disabled={isProcessing} className="px-7 py-2.5 bg-emerald-600 text-white text-sm md:text-base font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-300/60 disabled:opacity-60">
                    {isProcessing ? (
                      <>
                        <Loader size={18} className="animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        {isEditMode ? "Update Member" : "Finalize & Save"}
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MembersForm;