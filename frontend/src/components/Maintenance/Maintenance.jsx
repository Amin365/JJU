


import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  Mail,
  ChevronRight,
  Clock3,
  ShieldCheck,
  ServerCog,
  Sparkles,
  RefreshCw,
  CircleCheckBig,
} from "lucide-react";

export default function Maintenance() {
  // 3 days ETA
  const targetDate = useMemo(
    () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    []
  );

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [progress, setProgress] = useState(0);

  // Countdown logic
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = targetDate.getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  // Fake progress animation
  useEffect(() => {
    let value = 0;
    const t = setInterval(() => {
      value += 1;
      setProgress((p) => (p < 90 ? value : p));
      if (value >= 90) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, []);

  const timeUnits = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  const checklist = [
    "Infrastructure upgrade in progress",
    "Database optimization and indexing",
    "Security patch verification",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 bg-cyan-500/20 blur-3xl rounded-full" />
      </div>

      {/* Floating Icon */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute top-10 right-10 opacity-20"
      >
        <Rocket size={120} />
      </motion.div>

      <main className="relative z-10 flex items-center justify-center min-h-screen px-4">
        {/* Gradient Border */}
        <div className="p-[1px] rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl rounded-3xl bg-slate-950 p-6 sm:p-10 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 text-xs text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                  Scheduled Maintenance
                </span>

                {/* Live Indicator */}
                <div className="flex items-center gap-2 mt-2 text-emerald-400 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Live Maintenance Ongoing
                </div>

                <h1 className="mt-4 text-3xl sm:text-5xl font-bold">
                  We’re upgrading the platform
                </h1>

                <p className="mt-3 text-slate-400">
                  Performance, security, and reliability improvements are being deployed.
                </p>
              </div>

              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                className="p-4 bg-indigo-500/10 rounded-2xl"
              >
                <ServerCog className="w-10 h-10 text-indigo-300" />
              </motion.div>
            </div>

            {/* Countdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {timeUnits.map((unit) => (
                <div
                  key={unit.label}
                  className="text-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition"
                >
                  <div className="text-3xl font-bold text-indigo-300">
                    {String(unit.value).padStart(2, "0")}
                  </div>
                  <div className="text-xs text-slate-400 uppercase">
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="mt-8">
              <div className="flex justify-between text-sm mb-2">
                <span>Deployment Progress</span>
                <span>{progress}%</span>
              </div>

              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                  animate={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2 text-xs mt-2 text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Finalizing...
              </div>
            </div>

            {/* Checklist */}
            {/* <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Current Operations</h3>
              <ul className="space-y-2">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slate-300">
                    <CircleCheckBig className="w-4 h-4 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div> */}

            {/* What's Coming */}
            {/* <div className="mt-6 p-5 bg-white/5 rounded-2xl">
              <h3 className="text-indigo-300 font-semibold mb-2">
                🚀 What’s Coming
              </h3>
              <ul className="text-sm text-slate-300 space-y-2">
                <li>⚡ Faster performance</li>
                <li>🔒 Stronger security</li>
                <li>📊 Better analytics</li>
              </ul>
            </div> */}

            {/* Notify */}
            <div className="mt-6 flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 rounded-full bg-slate-800 outline-none"
              />
              <button className="px-4 py-2 bg-indigo-500 rounded-full hover:bg-indigo-600">
                Notify
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4 border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock3 className="w-4 h-4" />
                Back within 72 hours
              </div>

              <button className="flex items-center gap-2 text-sm hover:text-indigo-300">
                <Mail className="w-4 h-4" />
                Contact Support
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}