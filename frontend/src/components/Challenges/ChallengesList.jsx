import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Calendar, Trophy, Users, ChevronRight, Loader2, Plus, ShieldCheck, UserRound, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/app/api/apislice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { extractArrayPayload } from '@/lib/utils';

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

const EMPTY_FORM = {
  title: '',
  description: '',
  type: 'pages',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
  status: 'Active',
  targetTotal: '',
  minPagesPerDay: '',
  minMinutesPerDay: '',
  requiredConsecutiveDays: '',
  bookIsbn: '',
  bookId: '',
  bookPreview: null,
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

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function ChallengeCardSkeleton() {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/50">
      <CardHeader className="pb-3">
        <Skeleton className="mb-2 h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

function ChallengeCreateDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  onLookupBook,
  isSaving,
  isLookingUpBook,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Challenge</DialogTitle>
          <DialogDescription>
            The challenge will only be visible to you and members assigned to your moderator account.
          </DialogDescription>
        </DialogHeader>

        <form id="challenge-create-form" onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Challenge title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="30 Pages a Day Sprint"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the goal, timeline, and what members should do to complete it."
                rows={4}
              />
            </div>

            <div className="space-y-3 md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div>
                <h3 className="text-sm font-semibold">Reading report source</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Challenge scores come from approved reading reports. Leave ISBN empty to allow any book,
                  or find one book to make all reports count only for that title.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="bookIsbn">Book ISBN</Label>
                  <Input
                    id="bookIsbn"
                    value={formData.bookIsbn}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      bookIsbn: e.target.value,
                      bookId: '',
                      bookPreview: null,
                    }))}
                    placeholder="Enter exact ISBN"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onLookupBook}
                  disabled={isLookingUpBook || !formData.bookIsbn.trim()}
                >
                  {isLookingUpBook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                  Find Book
                </Button>
              </div>

              {formData.bookPreview ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                  <p className="font-medium text-foreground">{formData.bookPreview.title}</p>
                  <p className="text-muted-foreground">
                    {formData.bookPreview.author || 'Unknown author'} • ISBN {formData.bookPreview.isbn}
                  </p>
                  <p className="mt-1 text-xs text-emerald-300">
                    Only approved reports for this book will count in the challenge. Reports are reviewed by moderators or super admins.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No book selected. Members can submit approved reports for any book and still earn progress.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Challenge type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Select challenge type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pages">Pages</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                  <SelectItem value="streak">Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Rules and targets</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetTotal">Target total</Label>
                <Input
                  id="targetTotal"
                  type="number"
                  min={0}
                  value={formData.targetTotal}
                  onChange={(e) => setFormData((prev) => ({ ...prev, targetTotal: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requiredConsecutiveDays">Required consecutive days</Label>
                <Input
                  id="requiredConsecutiveDays"
                  type="number"
                  min={0}
                  value={formData.requiredConsecutiveDays}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    requiredConsecutiveDays: e.target.value,
                  }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minPagesPerDay">Minimum pages per day</Label>
                <Input
                  id="minPagesPerDay"
                  type="number"
                  min={0}
                  value={formData.minPagesPerDay}
                  onChange={(e) => setFormData((prev) => ({ ...prev, minPagesPerDay: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minMinutesPerDay">Minimum minutes per day</Label>
                <Input
                  id="minMinutesPerDay"
                  type="number"
                  min={0}
                  value={formData.minMinutesPerDay}
                  onChange={(e) => setFormData((prev) => ({ ...prev, minMinutesPerDay: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" 
          className="dark:bg-orange-500"
          form="challenge-create-form" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ChallengesList() {
  const [activeTab, setActiveTab] = useState('All');
  const [joiningId, setJoiningId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const queryClient = useQueryClient();

  const canCreateChallenges = isModeratorUser(user);

  const { data: challenges = [], isLoading, isError } = useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      const res = await api.get('/challenges');
      return extractArrayPayload(res.data);
    },
    enabled: !!user,
  });

 

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/challenges', body),
    onSuccess: () => {
      toast.success('Challenge created successfully.');
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      setIsCreateOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to create challenge.'));
    },
  });

  const lookupBookMutation = useMutation({
    mutationFn: async (isbn) => {
      const trimmed = String(isbn || '').trim();
      const res = await api.get('/books', { params: { isbn: trimmed, limit: 1 } });
      const books = extractArrayPayload(res.data);
      const match = books.find((book) => String(book.isbn || '').toLowerCase() === trimmed.toLowerCase()) || books[0];

      if (!match) {
        throw new Error('Book not found');
      }

      return match;
    },
    onSuccess: (book) => {
      setFormData((prev) => ({
        ...prev,
        bookId: book.id,
        bookIsbn: book.isbn || prev.bookIsbn,
        bookPreview: book,
      }));
      toast.success('Book linked to challenge.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No book was found for that ISBN.'));
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id) => api.post(`/challenges/${id}/join`),
    onSuccess: () => {
      toast.success('You joined the challenge.');
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      setJoiningId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to join challenge.'));
      setJoiningId(null);
    },
  });

  const filtered = useMemo(() => (
    activeTab === 'All'
      ? challenges
      : challenges.filter((challenge) => challenge.status === activeTab)
  ), [activeTab, challenges]);

  function handleCreateOpenChange(nextOpen) {
    setIsCreateOpen(nextOpen);
    if (!nextOpen) {
      setFormData(EMPTY_FORM);
    }
  }

  function handleCreateSubmit(e) {
    e.preventDefault();

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('Start date must be before end date.');
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: formData.status,
      bookId: formData.bookId || undefined,
      rules: {
        targetTotal: Number(formData.targetTotal || 0),
        minPagesPerDay: Number(formData.minPagesPerDay || 0),
        minMinutesPerDay: Number(formData.minMinutesPerDay || 0),
        requiredConsecutiveDays: Number(formData.requiredConsecutiveDays || 0),
      },
    });
  }

  function handleLookupBook() {
    if (!formData.bookIsbn.trim()) {
      toast.error('Enter an ISBN first.');
      return;
    }

    lookupBookMutation.mutate(formData.bookIsbn);
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Reading Challenges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View the challenges available under your moderator and join active ones.
          </p>
        </div>

        {canCreateChallenges && (
          <Button size="sm" className="dark:bg-orange-500/80"
           onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Challenge
          </Button>
        )}
      </div>

      {canCreateChallenges && (
        <Card className="border border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
              <div>
                <p className="font-medium text-foreground">Moderator challenge scope</p>
                <p>
                  Challenges you create are only visible to you and members assigned to your moderator account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          ? Array.from({ length: 6 }).map((_, index) => <ChallengeCardSkeleton key={index} />)
          : filtered.map((challenge) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card
                  className="flex h-full cursor-pointer flex-col border border-zinc-800  transition-colors hover:border-zinc-600"
                  onClick={() => navigate(`/dashboard/challenges/${challenge.uuid || challenge.id}`)}
                >
                  <CardHeader className="space-y-3 pb-3">
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
                    <div>
                      <CardTitle className="line-clamp-2 text-base">{challenge.title}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-3 text-sm">
                        {challenge.description || 'No description provided.'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{challenge.participantCount ?? 0} participants</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserRound className="h-3.5 w-3.5" />
                      <span>Created by {getUserName(challenge.createdBy)}</span>
                    </div>

                    {challenge.book && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{challenge.book.title} • ISBN {challenge.book.isbn}</span>
                      </div>
                    )}

                    {challenge.winner && (
                      <div className="flex items-center gap-2 text-xs text-emerald-300">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>Winner: {getUserName(challenge.winner)}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {!canCreateChallenges && challenge.status === 'Active' && user && !challenge.isJoined && (
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={joiningId === challenge.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setJoiningId(challenge.id);
                            joinMutation.mutate(challenge.id);
                          }}
                        >
                          {joiningId === challenge.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Join
                        </Button>
                      )}
                      {!canCreateChallenges && challenge.isJoined && (
                        <Badge className="flex-1 justify-center border border-emerald-500/30 bg-emerald-500/10 py-2 text-emerald-300">
                          Joined
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/challenges/${challenge.uuid || challenge.id}`);
                        }}
                      >
                        View <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Trophy className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} challenges found.</p>
        </div>
      )}

      <ChallengeCreateDialog
        open={isCreateOpen}
        onOpenChange={handleCreateOpenChange}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreateSubmit}
        onLookupBook={handleLookupBook}
        isSaving={createMutation.isPending}
        isLookingUpBook={lookupBookMutation.isPending}
      />
    </div>
  );
}
