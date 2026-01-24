import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Plus, Trash2, Edit2 } from "lucide-react";

import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fetchBlogPosts = async ({ queryKey }) => {
  const [, params] = queryKey;
  const { page = 1, limit = 20, scope = "all" } = params || {};
  const res = await api.get("/blogposts", { params: { page, limit, scope } });
  return res.data;
};

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : "");

const StatusBadge = ({ status }) => {
  const styles =
    status === "Published"
      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100 dark:border-green-800"
      : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-50 dark:border-amber-800";
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", styles)}>
      {status || "Draft"}
    </span>
  );
};

const BlogTable = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page] = useState(1);
  const [limit] = useState(50);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["blogposts", { page, limit, scope: "all" }],
    queryFn: fetchBlogPosts,
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const posts = data?.data || [];
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/blogposts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogposts"] });
      setIsDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
      setIsDialogOpen(false);
    },
  });

  const confirmDelete = (post) => {
    setDeleteTarget(post);
    setIsDialogOpen(true);
  };

  const handleEdit = (id) => {
    navigate(`/dashboard/blogs/edit/${id}`);
  };

  const handleView = (id) => {
    navigate(`/dashboard/blogs/${id}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const haystack = [p.title, p.author_name || p.author, p.status, ...(p.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, search]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Blogs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Manage and review posts from all authors.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button onClick={() => navigate("/dashboard/blogs/new")}> <Plus className="h-4 w-4 mr-2" /> New Post</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by title, author, or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">{filtered.length} results</div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Title</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Author</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Tags</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Created</th>
                <th className="text-right p-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Loading posts...</td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-red-500">Failed to load posts</td>
                </tr>
              )}

              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">No posts found.</td>
                </tr>
              )}

              {!isLoading && !error && filtered.map((post) => (
                <tr
                  key={post._id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => handleView(post._id)}
                >
                  <td className="p-3">
                    <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[320px]">{post.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-300 truncate" dangerouslySetInnerHTML={{ __html: post.content?.slice(0, 120) }} />
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{post.author_name || post.author || ""}</td>
                  <td className="p-3"><StatusBadge status={post.status} /></td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">
                    <div className="flex flex-wrap gap-1 max-w-[220px] truncate">
                      {(post.tags || []).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] text-slate-600 dark:text-slate-200">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{formatDate(post.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(post._id);
                        }}
                      >
                        <Edit2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      </button>
                      <button
                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(post);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Post</h3>
              <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close dialog">✕</button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => deleteMutation.mutate(deleteTarget?._id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogTable;