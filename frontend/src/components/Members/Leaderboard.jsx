import { useQuery } from '@tanstack/react-query';
import api from '@/app/api/apislice';
import { Flame, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import HeroHeader from '../Homepage/HeroSections';

const getUserName = (user) => {
  if (!user) return "User";
  if (typeof user === "string") return user;
  return (
    [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.username ||
    user.email ||
    "User"
  );
};

function calcLongestStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...dates]
    .map(d => new Date(new Date(d).toDateString()).getTime())
    .sort((a, b) => a - b);

  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 86400000) cur++;
    else if (sorted[i] !== sorted[i - 1]) cur = 1;
    max = Math.max(max, cur);
  }
  return max;
}

export default function Leaderboard() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['dailyReports', 'public'],
    queryFn: async () => {
      const res = await api.get('/daily-reports/public', { params: { limit: 10000 } });
      return res.data?.data || [];
    }
  });

  const leaderboard = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      const id = r.createdBy?._id || r.createdBy;
      if (!id) return;
      if (!map[id]) map[id] = { user: r.createdBy, dates: [] };
      map[id].dates.push(r.readingDate);
    });

    return Object.values(map)
      .map(u => ({
        user: u.user,
        streak: calcLongestStreak(u.dates)
      }))
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 1000); // Show up to 1000
  }, [reports]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-black">Loading…</div>;
  }

  return (
    <main className="min-h-screen   py-10 px-2 md:px-6">
    <div className="mb-32">
        <HeroHeader />

    </div>

      {/* Header */}
      <div className="text-center mt-20 mb-10 md:mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          🏆 Leaderboard 🏆
        </h1>
        <p className="text-gray-400 mt-3">
          Celebrating our most dedicated Readers! 🎉
        </p>
      </div>

      {/* Podium - responsive stacking and shrink/grow */}
      <div className="flex flex-col sm:flex-row justify-center items-end gap-6 mb-12 md:mb-20">
        {/* 2nd */}
        {top3[1] && (
          <PodiumCard
            rank="2nd Place"
            color="from-slate-700 to-slate-900"
            accent="border-slate-400"
            user={top3[1]}
            className="order-1 sm:order-none"
          />
        )}

        {/* 1st */}
        {top3[0] && (
          <PodiumCard
            rank="1st Place"
            color="from-yellow-700 to-amber-900"
            accent="border-yellow-400"
            crown
            user={top3[0]}
            scale
            className="order-0 sm:mb-2"
          />
        )}

        {/* 3rd */}
        {top3[2] && (
          <PodiumCard
            rank="3rd Place"
            color="from-orange-700 to-rose-900"
            accent="border-orange-400"
            user={top3[2]}
            className="order-2 sm:order-none"
          />
        )}
      </div>

    
<section className="w-full max-w-7xl mx-auto dark:bg-white dark:bg-zinc-900 rounded-2xl p-4 md:p-6 shadow-xl">
  <h2 className="text-xl md:text-2xl font-bold">Top 100 Readers</h2>
  <p className="text-sm text-gray-400 mb-6">
    Keep Readers to climb the ranks!
  </p>

  <div className="space-y-4">
    {leaderboard.map((u, i) => (
      <div
        key={i}
        className="flex items-center justify-between  rounded-xl px-4 py-4 hover:bg-gray-500/20 transition"
      >
        {/* LEFT */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Rank */}
          <div className="w-8 h-8 rounded-md text-black dark:text-white dark:bg-black border border-zinc-700 flex items-center justify-center text-sm font-bold">
            #
          </div>

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-bold">
            {getUserName(u.profile_picture)}
          </div>

          {/* Name + Meta */}
          <div className="min-w-0">
            <p className="font-semibold dark:text-white text-black truncate">
              {getUserName(u.user)}
            </p>
            <p className="text-xs text-gray-400">
              Longest: {u.streak} days • Total: {u.streak} days
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-8">
          {/* Current Streak */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-yellow-400 justify-end">
              <Flame className="w-4 h-4" />
              <span className="font-bold">{u.streak}</span>
            </div>
            <p className="text-xs text-gray-400 text-right">
              Current
            </p>
          </div>

          {/* Badges (static example = 3) */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-blue-400 justify-end">
              <Trophy className="w-4 h-4" />
              <span className="font-bold">3</span>
            </div>
            <p className="text-xs text-gray-400 text-right">
              Badges
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>

  {leaderboard.length === 0 && (
    <div className="text-center text-gray-500 py-8">
      No learners found.
    </div>
  )}
</section>

    </main>
  );
}

function PodiumCard({ rank, color, accent, user, crown, scale, className = "" }) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`
        relative w-full text-white max-w-xs rounded-3xl p-5 md:p-6 bg-gradient-to-b ${color}
        border-2 ${accent} text-center
        ${scale ? "scale-110 z-20" : "z-10"}
        ${className}
      `}
    >
      {crown && (
        <Trophy className="absolute -top-6 left-1/2 -translate-x-1/2 w-10 h-10 text-yellow-400" />
      )}

      <span className="inline-block mb-4 px-4 py-1 rounded-full bg-black/40 text-sm">
        {rank}
      </span>

      <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full bg-black/30 flex items-center justify-center text-3xl font-bold mb-4">
        {getUserName(user.user).slice(0, 2)}
      </div>

      <h3 className="font-bold text-md md:text-lg mb-2 truncate">
        {getUserName(user.user)}
      </h3>

      <div className="flex justify-center items-center gap-2 text-yellow-400">
        <Flame className="w-5 h-5 md:w-6 md:h-6" />
        <span className="text-xl font-bold">{user.streak}</span>
        <span className="text-sm text-gray-300 hidden md:inline">days</span>
      </div>
    </motion.div>
  );
}