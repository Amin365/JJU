import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Trophy, Calendar, BookOpen, Clock, FileText, Flame, ArrowLeft, Loader2, Users, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/app/api/apislice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { extractArrayPayload } from '@/lib/utils';

const STATUS_COLORS = {
  Active: 'bg-green-500/20 text-green-400 border-green-500/30',
  Draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getUserName(user) {
  if (!user) return 'Unknown';
  if (typeof user === 'string') return user;
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')
    || user.username || user.email || 'Unknown';
}

function getRoleName(user) {
  return String(user?.role?.role || user?.role?.plural || '').toLowerCase();
}

function isModeratorUser(user) {
  return /moderator|super\s*admin/i.test(getRoleName(user));
}

function getRuleItems(rules = {}, challengeType) {
  const items = [];

  if ((rules.targetTotal || 0) > 0) {
    items.push(`Target total: ${rules.targetTotal} ${challengeType}`);
  }
  if ((rules.minPagesPerDay || 0) > 0) {
    items.push(`Minimum ${rules.minPagesPerDay} pages per day`);
  }
  if ((rules.minMinutesPerDay || 0) > 0) {
    items.push(`Minimum ${rules.minMinutesPerDay} minutes per day`);
  }
  if ((rules.requiredConsecutiveDays || 0) > 0) {
    items.push(`${rules.requiredConsecutiveDays} consecutive days required`);
  }

  return items;
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

export default function ChallengeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const queryClient = useQueryClient();
  const canManageChallenges = isModeratorUser(user);

  const { data: challenge, isLoading, isError } = useQuery({
    queryKey: ['challenge', id],
    queryFn: async () => {
      const res = await api.get(`/challenges/${id}`);
      return res.data?.data || res.data;
    },
    enabled: !!id && !!user,
  });

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery({
    queryKey: ['challenge-leaderboard', id],
    queryFn: async () => {
      const res = await api.get(`/challenges/${id}/leaderboard`);
      return extractArrayPayload(res.data);
    },
    enabled: !!id && !!user,
  });

  const { data: myProgress } = useQuery({
    queryKey: ['challenge-progress', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/challenges/${id}/my-progress`);
        return res.data?.data || res.data;
      } catch (error) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!id && !!user,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post(`/challenges/${id}/join`),
    onSuccess: () => {
      toast.success('You joined the challenge.');
      queryClient.invalidateQueries({ queryKey: ['challenge', id] });
      queryClient.invalidateQueries({ queryKey: ['challenge-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard', id] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to join challenge.'));
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6 py-6 space-y-6">
        <Skeleton className="h-8 w-24" />
        <SkeletonBlock />
      </div>
    );
  }

  if (isError || !challenge) {
    return (
      <div className="px-4 lg:px-6 py-6 text-destructive">
        Failed to load challenge.
      </div>
    );
  }

  const isJoined = Boolean(challenge.isJoined || myProgress != null);
  const targetValue = challenge.rules?.targetTotal || 0;
  const ruleItems = getRuleItems(challenge.rules, challenge.type);

  // Compute progress percent from available data based on challenge type
  const currentValue = myProgress
    ? challenge.type === 'pages' ? (myProgress.pagesRead ?? 0)
    : challenge.type === 'minutes' ? (myProgress.minutesRead ?? 0)
    : challenge.type === 'streak' ? (myProgress.streak ?? 0)
    : (myProgress.reportsCount ?? 0)
    : 0;
  const progressPercent = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

  return (
    <div className="px-4 lg:px-6 py-6 space-y-6 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => navigate('/dashboard/challenges')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Challenges
      </Button>

      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{challenge.title}</CardTitle>
                <CardDescription className="text-sm max-w-2xl">
                  {challenge.description}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={STATUS_COLORS[challenge.status]}>
                  {challenge.status}
                </Badge>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                  {challenge.type}
                </Badge>
                {isJoined && (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                    Joined
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{challenge.participantCount ?? 0} participants</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                <span>Created by {getUserName(challenge.createdBy)}</span>
              </div>
              {challenge.book && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-blue-400" />
                  <span>{challenge.book.title} • ISBN {challenge.book.isbn}</span>
                </div>
              )}
              {targetValue > 0 && (
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <span>Goal: {targetValue} {challenge.type}</span>
                </div>
              )}
            </div>

            {ruleItems.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-semibold mb-1">Rules</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {ruleItems.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-muted-foreground">
              Progress is calculated from approved reading reports only. Reports are reviewed by moderators or super admins.
              {challenge.book
                ? ` Only reports for ${challenge.book.title} count in this challenge.`
                : ' Reports from any book can count in this challenge.'}
            </div>

            {challenge.winner && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                <p className="font-medium text-emerald-300">Winner: {getUserName(challenge.winner)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {challenge.completionReason === 'target_reached'
                    ? 'This challenge finished because the target was reached first.'
                    : challenge.completionReason === 'date_ended'
                      ? 'This challenge finished because the end date was reached.'
                      : 'This challenge has been completed.'}
                </p>
              </div>
            )}

            {challenge.status === 'Active' && user && !canManageChallenges && !isJoined && (
              <Button
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="mt-2"
              >
                {joinMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Join Challenge
              </Button>
            )}

            {canManageChallenges && (
              <p className="text-xs text-muted-foreground">
                This challenge is visible to the moderator who created it and their assigned members only.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* My Progress */}
      {isJoined && myProgress && (
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" /> My Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatPill icon={BookOpen} label="Pages" value={myProgress.pagesRead ?? 0} color="text-blue-400" />
              <StatPill icon={Clock} label="Minutes" value={myProgress.minutesRead ?? 0} color="text-purple-400" />
              <StatPill icon={FileText} label="Reports" value={myProgress.reportsCount ?? 0} color="text-orange-400" />
              <StatPill icon={Flame} label="Streak" value={myProgress.streak ?? 0} color="text-yellow-400" />
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                Active reading days: <span className="font-semibold text-foreground">{myProgress.activeDays ?? 0}</span>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                Avg pages / day: <span className="font-semibold text-foreground">{myProgress.averagePagesPerDay ?? 0}</span>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                Books counted: <span className="font-semibold text-foreground">{myProgress.booksCount ?? 0}</span>
              </div>
            </div>
            {targetValue > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Overall Progress</span>
                  <span>{Math.min(progressPercent, 100).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(progressPercent, 100)} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" /> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lbLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No participants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Minutes</TableHead>
                    <TableHead className="text-right">Reports</TableHead>
                    <TableHead className="text-right">Streak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, idx) => (
                    <TableRow key={entry.user?._id ?? idx}>
                      <TableCell className="font-bold text-muted-foreground">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getUserName(entry.user ?? entry)}
                      </TableCell>
                      <TableCell className="text-right">{entry.pagesRead ?? 0}</TableCell>
                      <TableCell className="text-right">{entry.minutesRead ?? 0}</TableCell>
                      <TableCell className="text-right">{entry.reportsCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1 text-yellow-400">
                          <Flame className="h-3.5 w-3.5" />
                          {entry.streak ?? 0}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 py-3 px-2">
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
