import React, { useMemo, useState } from "react";
import { TrendingDown, TrendingUp, AlertTriangle, Trophy, Flame, BookCheck, ClipboardList, UserPlus, Clock, BookOpen, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import api from "../app/api/apislice";
import ChartsDashboard from "../pages/ChartsDashboard";
import RecentActions from "../pages/RecentActions";
import { Skeleton } from "@/components/ui/skeleton";

const DAY = 24 * 60 * 60 * 1000;

const toMs = (d) => (d ? new Date(d).getTime() : 0);

const pctChange = (current, previous) => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100; // from 0 to something
  return ((current - previous) / previous) * 100;
};

const formatPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

const countInRange = (items, fromMs, toMsExclusive) =>
  items.filter((x) => {
    const t = toMs(x.createdAt);
    return t >= fromMs && t < toMsExclusive;
  }).length;

const MAX_WIDGET_ITEMS = 7;

export function SectionCards() {
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.get("/members"),
    select: (response) => response.data?.data ?? [],
  });

  const { data: booksData = { items: [], total: 0 } } = useQuery({
    queryKey: ["books"],
    queryFn: () => api.get("/books?limit=10000"),
    select: (response) => ({
      items: response.data?.data ?? [],
      total: response.data?.total ?? 0,
    }),
  });

  const books = booksData.items;
  const booksTotal = booksData.total;

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: () => api.get("/issue"),
    select: (response) => response.data?.data ?? [],
  });

  const { data: dashStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.get("/dashboard/stats"),
    select: (r) => r.data,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const now = Date.now();
    const currentFrom = now - 30 * DAY;
    const prevFrom = now - 60 * DAY;

    const membersCurrent = countInRange(members, currentFrom, now);
    const membersPrev = countInRange(members, prevFrom, currentFrom);
    const membersPct = pctChange(membersCurrent, membersPrev);

    const booksCurrent = countInRange(books, currentFrom, now);
    const booksPrev = countInRange(books, prevFrom, currentFrom);
    const booksPct = pctChange(booksCurrent, booksPrev);

    const issuesCurrent = countInRange(issues, currentFrom, now);
    const issuesPrev = countInRange(issues, prevFrom, currentFrom);
    const issuesPct = pctChange(issuesCurrent, issuesPrev);

    // Example "Growth Rate": average of the 3 pcts
    const growthRate = (membersPct + booksPct + issuesPct) / 3;

    return {
      members: { total: members.length, pct: membersPct, current: membersCurrent, prev: membersPrev },
      books: { total: booksTotal || books.length, pct: booksPct, current: booksCurrent, prev: booksPrev },
      issues: { total: issues.length, pct: issuesPct, current: issuesCurrent, prev: issuesPrev },
      growthRate,
    };
  }, [members, books, issues]);

  const TrendBadge = ({ pct }) => {
    const up = pct >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <Badge variant="outline">
        <Icon className="mr-1" />
        {formatPct(pct)}
      </Badge>
    );
  };

  const TrendFooter = ({ pct, label }) => {
    const up = pct >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <div className="line-clamp-1 flex gap-2 font-medium">
        {label} <Icon className="size-4" />
      </div>
    );
  };

  return (

   <div className="mt-12">
     <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4 lg:px-6 mb-8">
      {/* Members */}
      <Card className="@container/card" >
        <CardHeader>
          <CardDescription>Total Members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.members.total || 0}
          </CardTitle>
          <CardAction>
            <TrendBadge pct={stats.members.pct} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <TrendFooter
            pct={stats.members.pct}
            label={stats.members.pct >= 0 ? "Trending up this month" : "Trending down this month"}
          />
          <div className="text-muted-foreground">
            Last 30d: {stats.members.current} • Prev 30d: {stats.members.prev}
          </div>
        </CardFooter>
      </Card>

      {/* Books */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Books</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.books.total || 0}
          </CardTitle>
          <CardAction>
            <TrendBadge pct={stats.books.pct} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <TrendFooter
            pct={stats.books.pct}
            label={stats.books.pct >= 0 ? "Up this period" : "Down this period"}
          />
          <div className="text-muted-foreground">
            Last 30d: {stats.books.current} • Prev 30d: {stats.books.prev}
          </div>
        </CardFooter>
      </Card>

      {/* Issues */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Issued Books</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.issues.total || 0}
          </CardTitle>
          <CardAction>
            <TrendBadge pct={stats.issues.pct} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <TrendFooter
            pct={stats.issues.pct}
            label={stats.issues.pct >= 0 ? "More activity this month" : "Less activity this month"}
          />
          <div className="text-muted-foreground">
            Last 30d: {stats.issues.current} • Prev 30d: {stats.issues.prev}
          </div>
        </CardFooter>
      </Card>

      {/* Growth Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatPct(stats.growthRate)}
          </CardTitle>
          <CardAction>
            <TrendBadge pct={stats.growthRate} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <TrendFooter
            pct={stats.growthRate}
            label={stats.growthRate >= 0 ? "Steady performance increase" : "Decline vs last period"}
          />
          <div className="text-muted-foreground">Avg of Members/Books/Issues change (30d vs prev 30d)</div>
        </CardFooter>
      </Card>
    </div>

    {/* Secondary KPI row: Available Books, Active Members, Overdue Issues, Pending Actions */}
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6 mb-8">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <BookCheck className="h-4 w-4 text-green-500" />
            Available Books
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (dashStats?.availableBooks ?? "—")}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {statsLoading ? <Skeleton className="h-4 w-32" /> : (
            <span>{dashStats?.borrowedBooks ?? 0} borrowed of {dashStats?.totalBooks ?? 0} total</span>
          )}
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-blue-500" />
            Active Members
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (dashStats?.activeMembers ?? "—")}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {statsLoading ? <Skeleton className="h-4 w-32" /> : (
            <span>{dashStats?.totalMembers ?? 0} total members</span>
          )}
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <AlertTriangle className={`h-4 w-4 ${dashStats?.overdueIssues > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            Overdue Issues
          </CardDescription>
          <CardTitle className={`text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${dashStats?.overdueIssues > 0 ? "text-destructive" : ""}`}>
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (dashStats?.overdueIssues ?? "—")}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {statsLoading ? <Skeleton className="h-4 w-32" /> : (
            dashStats?.overdueIssues > 0
              ? <span className="text-destructive">Attention needed</span>
              : <span>No overdue issues</span>
          )}
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            Pending Actions
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {statsLoading ? <Skeleton className="h-8 w-16" /> : (
              (dashStats?.pendingJoinRequests ?? 0) + (dashStats?.pendingDailyReports ?? 0)
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
          {statsLoading ? <Skeleton className="h-8 w-40" /> : (
            <>
              <span className="flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                {dashStats?.pendingJoinRequests ?? 0} join requests
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                {dashStats?.pendingDailyReports ?? 0} pending reports
              </span>
            </>
          )}
        </CardFooter>
      </Card>
    </div>

    <div className="px-4 flex flex-col lg:px-6 mt-4 space-y-4">
      <ChartsDashboard />
      <RecentActions />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopReadersWidget />
        <PopularBooksWidget />
      </div>
    </div>
   </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top Readers Widget                                                          */
/* -------------------------------------------------------------------------- */
function TopReadersWidget() {
  const [days, setDays] = useState(7);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "top-readers", days],
    queryFn: () => api.get(`/dashboard/top-readers?days=${days}`),
    select: (r) => r.data?.data ?? [],
    staleTime: 60_000,
  });

  const readers = data ?? [];

  return (
    <Card className="@container/card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Readers
        </CardTitle>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                days === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        {!isLoading && readers.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No reading reports in the last {days} days.
          </p>
        )}
        {!isLoading &&
          readers.slice(0, MAX_WIDGET_ITEMS).map((reader, idx) => (
            <div
              key={String(reader._id)}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                {idx + 1}
              </span>
              {reader.avatar ? (
                <img
                  src={reader.avatar}
                  alt={reader.name}
                  className="h-8 w-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{reader.name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">
                  {reader.reportCount} report{reader.reportCount !== 1 ? "s" : ""}
                  {reader.totalMinutes > 0 && ` • ${Math.floor(reader.totalMinutes / 60)}h`}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {reader.totalPages} pg
              </Badge>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Popular Books Widget                                                        */
/* -------------------------------------------------------------------------- */
function PopularBooksWidget() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "popular-books", days],
    queryFn: () => api.get(`/dashboard/popular-books?days=${days}&limit=7`),
    select: (r) => r.data?.data ?? [],
    staleTime: 60_000,
  });

  const books = data ?? [];

  return (
    <Card className="@container/card">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Popular Books
        </CardTitle>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                days === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-10 w-8 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        {!isLoading && books.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No issued books in the last {days} days.
          </p>
        )}
        {!isLoading &&
          books.slice(0, MAX_WIDGET_ITEMS).map((book, idx) => (
            <div
              key={String(book._id)}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                {idx + 1}
              </span>
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  className="h-10 w-8 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-8 rounded bg-accent flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{book.title}</p>
                <p className="text-xs text-muted-foreground truncate">{book.author ?? "Unknown author"}</p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="secondary" className="tabular-nums">
                  {book.issueCount}×
                </Badge>
                {book.status === "borrowed" && (
                  <p className="text-xs text-amber-500 mt-0.5">borrowed</p>
                )}
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}