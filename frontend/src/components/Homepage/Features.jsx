import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  BookOpen,
  Users,
  CalendarDays,
  NotebookPen,
  LibraryBig,
  BadgeCheck,
} from "lucide-react";

export default function Features() {
  return (
    <section className="py-10 mt-12 md:py-16 dark:bg-transparent">
      <div className="@container mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
            Everything your Reading Club needs
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Borrow books, join sessions, share reviews, and grow together—built for readers.
          </p>
        </div>

        <div className="@min-4xl:max-w-full @min-4xl:grid-cols-3 mx-auto mt-8 grid max-w-sm gap-6 *:text-center md:mt-12">
          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="blue">
                <LibraryBig className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Borrow Books</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Explore the club library, request a title, and track borrowed books with due dates.
              </p>
            </CardContent>
          </Card>

          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="emerald">
                <CalendarDays className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Weekly Reading Sessions</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Join scheduled meetups, discussions, and live Q&amp;A sessions with members.
              </p>
            </CardContent>
          </Card>

          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="violet">
                <NotebookPen className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Reviews &amp; Notes</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Write reviews, save quotes, and keep personal notes for every book you finish.
              </p>
            </CardContent>
          </Card>

          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="amber">
                <BookOpen className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Curated Reading Lists</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Discover themed reading lists and recommendations picked by the club community.
              </p>
            </CardContent>
          </Card>

          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="rose">
                <Users className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Community &amp; Events</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Participate in challenges, author spotlights, and community reading goals.
              </p>
            </CardContent>
          </Card>

          <Card className="group shadow-zinc-950/5">
            <CardHeader className="pb-3">
              <CardDecorator tone="slate">
                <BadgeCheck className="size-6" aria-hidden />
              </CardDecorator>
              <h3 className="mt-6 font-medium">Progress &amp; Badges</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track your activity and earn badges for reading streaks and contributions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// New decorator style (no gridlines): soft gradient blob + ring + hover glow
const CardDecorator = ({ children, tone = "blue" }) => {
  const tones = {
    blue: "from-blue-500/15 to-cyan-500/10 ring-blue-500/20 group-hover:ring-blue-500/30",
    emerald:
      "from-emerald-500/15 to-teal-500/10 ring-emerald-500/20 group-hover:ring-emerald-500/30",
    violet:
      "from-violet-500/15 to-fuchsia-500/10 ring-violet-500/20 group-hover:ring-violet-500/30",
    amber:
      "from-amber-500/15 to-orange-500/10 ring-amber-500/20 group-hover:ring-amber-500/30",
    rose: "from-rose-500/15 to-pink-500/10 ring-rose-500/20 group-hover:ring-rose-500/30",
    slate: "from-slate-500/15 to-zinc-500/10 ring-slate-500/20 group-hover:ring-slate-500/30",
  };

  return (
    <div className="relative mx-auto flex size-20 items-center justify-center">
      <div
        aria-hidden
        className={`absolute inset-0 rounded-2xl  blur-[2px]`}
      />
      <div
        className={`relative flex size-12 items-center justify-center rounded-xl bg-background ring-1 ${tones[tone]} transition`}
      >
        {children}
      </div>
    </div>
  );
};