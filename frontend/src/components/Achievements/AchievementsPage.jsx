import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Lock, Award } from 'lucide-react';
import api from '@/app/api/apislice';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { extractArrayPayload } from '@/lib/utils';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function AchievementSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardContent className="pt-6 flex flex-col items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export default function AchievementsPage() {
  const user = useSelector((state) => state.auth.user);

  const { data: allAchievements = [], isLoading: loadingAll } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const res = await api.get('/achievements');
      return extractArrayPayload(res.data);
    },
  });

  const { data: myAchievements = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-achievements'],
    queryFn: async () => {
      const res = await api.get('/users/me/achievements');
      return extractArrayPayload(res.data);
    },
    enabled: !!user,
  });

  const isLoading = loadingAll || (!!user && loadingMine);

  // Build a lookup: achievementId -> unlock date
  const unlockedMap = {};
  myAchievements.forEach((a) => {
    const id = a.achievement?._id || a.achievement || a._id;
    unlockedMap[id] = a.unlockedAt || a.createdAt || true;
  });

  const sorted = [...allAchievements].sort((a, b) => {
    const aUnlocked = !!unlockedMap[a._id];
    const bUnlocked = !!unlockedMap[b._id];
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return 0;
  });

  return (
    <TooltipProvider>
      <div className="space-y-6 px-4 lg:px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-yellow-400" />
            Achievements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unlock badges by reaching reading milestones
          </p>
        </div>

        {user && !loadingMine && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {myAchievements.length} / {allAchievements.length} unlocked
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => <AchievementSkeleton key={i} />)
            : sorted.map((achievement) => {
                const isUnlocked = !!unlockedMap[achievement._id];
                const unlockDate = typeof unlockedMap[achievement._id] === 'string'
                  ? unlockedMap[achievement._id]
                  : null;

                return (
                  <Tooltip key={achievement._id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          className={`border transition-all cursor-default h-full ${
                            isUnlocked
                              ? 'border-yellow-500/40 bg-yellow-500/5 shadow-[0_0_16px_rgba(234,179,8,0.15)]'
                              : 'border-zinc-800 bg-zinc-900/40 opacity-60'
                          }`}
                        >
                          <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2 text-center relative">
                            {!isUnlocked && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl z-10">
                                <Lock className="h-6 w-6 text-zinc-400" />
                              </div>
                            )}

                            <div className={`text-4xl leading-none ${!isUnlocked ? 'grayscale' : ''}`}>
                              {achievement.icon || '🏅'}
                            </div>

                            <p className="text-sm font-semibold leading-tight mt-1">
                              {achievement.title || achievement.name}
                            </p>

                            <p className="text-xs text-muted-foreground leading-snug line-clamp-3">
                              {achievement.description}
                            </p>

                            {achievement.hint && !isUnlocked && (
                              <p className="text-xs text-muted-foreground/70 italic mt-1">
                                💡 {achievement.hint}
                              </p>
                            )}

                            {isUnlocked && unlockDate && (
                              <p className="text-xs text-yellow-500/80 mt-1">
                                Unlocked {formatDate(unlockDate)}
                              </p>
                            )}

                            {isUnlocked && (
                              <Badge variant="outline" className="text-xs border-yellow-500/40 text-yellow-400 mt-1">
                                ✓ Earned
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{achievement.title || achievement.name}</p>
                      {achievement.description && (
                        <p className="text-xs text-muted-foreground max-w-xs">{achievement.description}</p>
                      )}
                      {!isUnlocked && achievement.hint && (
                        <p className="text-xs italic mt-1">Hint: {achievement.hint}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
        </div>

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No achievements available yet.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
