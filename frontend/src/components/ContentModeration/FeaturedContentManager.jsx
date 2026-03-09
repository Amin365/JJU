import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  Star,
  Pin,
  Award,
  RefreshCw,
  Search,
  Eye,
  Calendar,
  ArrowUpDown,
  Link as LinkIcon,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Loader from "@/components/Loader";

const fetchBlogPosts = async ({ page, limit, status = "Published" }) => {
  const res = await api.get("/blogposts", { params: { page, limit, status, scope: "all" } });
  return res.data;
};

const fetchFeaturedPosts = async () => {
  const res = await api.get("/blogposts/featured");
  return res.data;
};

const PostCard = ({ post, onToggleFeature, onTogglePin, onToggleEditorsPick, onUpdateOrder }) => {
  const [orderValue, setOrderValue] = useState(post.displayOrder || 0);

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {post.blog_picture ? (
              <img
                src={post.blog_picture}
                alt={post.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Eye className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{post.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                By {post.author_name || "Unknown"} • {post.views || 0} views
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {post.isFeatured && (
                  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Star className="w-3 h-3 mr-1" /> Featured
                  </Badge>
                )}
                {post.isPinned && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                    <Pin className="w-3 h-3 mr-1" /> Pinned
                  </Badge>
                )}
                {post.isEditorsPick && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                    <Award className="w-3 h-3 mr-1" /> Editor's Pick
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={orderValue}
                onChange={(e) => setOrderValue(Number(e.target.value))}
                className="w-16 h-8 text-sm"
                min={0}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdateOrder(post._id, orderValue)}
                disabled={orderValue === post.displayOrder}
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant={post.isFeatured ? "default" : "outline"}
              className={post.isFeatured ? "bg-yellow-500 hover:bg-yellow-600" : ""}
              onClick={() => onToggleFeature(post._id)}
            >
              <Star className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={post.isPinned ? "default" : "outline"}
              className={post.isPinned ? "bg-blue-500 hover:bg-blue-600" : ""}
              onClick={() => onTogglePin(post._id)}
            >
              <Pin className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={post.isEditorsPick ? "default" : "outline"}
              className={post.isEditorsPick ? "bg-purple-500 hover:bg-purple-600" : ""}
              onClick={() => onToggleEditorsPick(post._id)}
            >
              <Award className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const FeaturedContentManager = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: postsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-posts", page],
    queryFn: () => fetchBlogPosts({ page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const { data: featuredData } = useQuery({
    queryKey: ["featured-posts"],
    queryFn: fetchFeaturedPosts,
    staleTime: 30_000,
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await api.put(`/blogposts/${postId}/feature`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["featured-posts"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to toggle feature");
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await api.put(`/blogposts/${postId}/pin`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["featured-posts"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to toggle pin");
    },
  });

  const toggleEditorsPickMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await api.put(`/blogposts/${postId}/editors-pick`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["featured-posts"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to toggle editor's pick");
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ postId, displayOrder }) => {
      const res = await api.put(`/blogposts/${postId}/display-order`, { displayOrder });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Display order updated");
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["featured-posts"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update order");
    },
  });

  const allPosts = postsData?.data || [];
  const featuredPosts = featuredData?.data || [];
  const totalPages = postsData?.totalPages || 1;

  const filteredPosts = useMemo(() => {
    let posts = activeTab === "featured" ? featuredPosts : allPosts;

    if (search.trim()) {
      const q = search.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.author_name?.toLowerCase().includes(q)
      );
    }

    return posts;
  }, [allPosts, featuredPosts, activeTab, search]);

  const featuredCount = allPosts.filter((p) => p.isFeatured).length;
  const pinnedCount = allPosts.filter((p) => p.isPinned).length;
  const editorsPickCount = allPosts.filter((p) => p.isEditorsPick).length;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Featured Content Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage featured, pinned, and editor's pick posts
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{featuredCount}</p>
              <p className="text-xs text-gray-500">Featured</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Pin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pinnedCount}</p>
              <p className="text-xs text-gray-500">Pinned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{editorsPickCount}</p>
              <p className="text-xs text-gray-500">Editor's Pick</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Posts</TabsTrigger>
          <TabsTrigger value="featured">Featured ({featuredPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <Loader />
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Star className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No posts found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredPosts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onToggleFeature={(id) => toggleFeatureMutation.mutate(id)}
                  onTogglePin={(id) => togglePinMutation.mutate(id)}
                  onToggleEditorsPick={(id) => toggleEditorsPickMutation.mutate(id)}
                  onUpdateOrder={(id, order) =>
                    updateOrderMutation.mutate({ postId: id, displayOrder: order })
                  }
                />
              ))}

              {activeTab === "all" && totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeaturedContentManager;
