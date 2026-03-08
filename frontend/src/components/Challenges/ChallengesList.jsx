import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Calendar, Trophy, Users, ChevronRight, Loader2 } from 'lucide-react';
import api from '@/app/api/apislice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS = {
  Active: 'bg-green-500/20 text-green-400 border-green-500/30',
  Draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const TYPE_COLORS = {
  pages: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  minutes: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reports: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  streak: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ChallengeCardSkeleton() {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

export default function ChallengesList() {
  const [activeTab, setActiveTab] = useState('All');
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const queryClient = useQueryClient();

  const { data: challenges = [], isLoading, isError } = useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      const res = await api.get('/challenges');
      return res.data?.data || res.data || [];
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id) => api.post(`/challenges/${id}/join`),
    onSuccess: () => queryClient.invalidateQueries(['challenges']),
  });

  const filtered = activeTab === 'All'
    ? challenges
    : challenges.filter((c) => c.status === activeTab);

  return (
    <div className="space-y-6 px-4 lg:px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Reading Challenges
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join a challenge and compete with fellow readers
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800/60">
          {['All', 'Active', 'Draft', 'Completed'].map((tab) => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isError && (
        <p className="text-sm text-destructive">Failed to load challenges.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <ChallengeCardSkeleton key={i} />)
          : filtered.map((challenge) => (
              <motion.div
                key={challenge._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card
                  className="border border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 transition-colors cursor-pointer h-full flex flex-col"
                  onClick={() => navigate(`/dashboard/challenges/${challenge._id}`)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base line-clamp-2">{challenge.title}</CardTitle>
                    <CardDescription className="line-clamp-3 text-sm">
                      {challenge.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={TYPE_COLORS[challenge.type] || 'border-zinc-600 text-zinc-400'}
                      >
                        {challenge.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[challenge.status] || 'border-zinc-600 text-zinc-400'}
                      >
                        {challenge.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}
                      </span>
                    </div>

                    {challenge.participants != null && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{challenge.participants?.length ?? challenge.participants} participants</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {challenge.status === 'Active' && user && (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={joinMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            joinMutation.mutate(challenge._id);
                          }}
                        >
                          {joinMutation.isPending && joinMutation.variables === challenge._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : null}
                          Join
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/challenges/${challenge._id}`);
                        }}
                      >
                        View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} challenges found.</p>
        </div>
      )}
    </div>
  );
}
