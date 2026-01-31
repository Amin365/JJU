import { useMemo, useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useParams, useNavigate } from "react-router";
import { useSelector, useDispatch } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Eye,
  Clock,
  BookOpen,
  ArrowLeft,
  Send,
  ThumbsUp,
  Flag,
  Sparkles,
  ChevronRight,
  Pin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { toast } from "sonner";
import Footers from "../Homepage/Footer";
import Loader from "../Loader";
import { toggleFavorite } from "../../app/favoritesSlice";


// ---- UTILS ----
function timeAgo(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}
// ---- END UTILS ----

export function BlogPostDetail({ postId, onBack, onRelatedPostClick }) {
  const user = useSelector((state) => state.auth?.user);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const favoriteIds = useSelector((state) => state.favorites?.items || []);
  const isFavorited = favoriteIds.includes(postId);

  // Bookmark state using localStorage
  // const [bookmarked, setBookmarked] = useState(() => {
  //   const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  //   return bookmarks.includes(postId);
  // });

  // View count
  const [viewCount, setViewCount] = useState(0);
  const viewAddedRef = useRef(false);

  // Local UI states
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showFullContent, setShowFullContent] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [activeReplyCommentId, setActiveReplyCommentId] = useState(null);
  const [replyTextByCommentId, setReplyTextByCommentId] = useState({});
  const [commentLikedByMe, setCommentLikedByMe] = useState({});
  const [commentLikes, setCommentLikes] = useState({});

  // FETCH: Blog post (with views)
  const { data: postResponse ,isLoading } = useQuery({
    queryKey: ["blogpost", postId],
    queryFn: async () => {
      const res = await api.get(`/blogposts/${postId}`);
      return res.data?.data;
    },
    enabled: !!postId,
    staleTime: 60_000,
  });

  // Increment views ONCE per visit
  useEffect(() => {
    if (!postId || viewAddedRef.current) return;
    viewAddedRef.current = true;
    api.post(`/blogposts/${postId}/views`).then(res => {
      if (res.data?.views !== undefined) setViewCount(res.data.views);
      queryClient.invalidateQueries({ queryKey: ["blogpost", postId] }); // refresh full post for views if must
    }).catch(()=>{});
  }, [postId, queryClient]);

  // Listen for postResponse to update local view count
  useEffect(() => {
    if (typeof postResponse?.views === "number") setViewCount(postResponse.views);
    if (typeof postResponse?.likes === "number") setLikeCount(postResponse.likes);
  }, [postResponse?.views, postResponse?.likes]);

  // Comments
  const {
    data: commentsResponse,
    isLoading: commentsLoading,
    isError: commentsError,
    error: commentsErr,
  } = useQuery({
    queryKey: ["blogpost-comments", postId],
    queryFn: async () => {
      const res = await api.get(`/blogposts/${postId}/comments`);
      return res.data?.data;
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
  const comments = Array.isArray(commentsResponse) ? commentsResponse : [];

  useEffect(() => {
    if (!comments.length) return;
    setCommentLikes((prev) => {
      const next = { ...prev };
      for (const c of comments) {
        if (next[c._id] === undefined) next[c._id] = c.likes || 0;
      }
      return next;
    });
    if (user?.id || user?._id) {
      const myId = String(user.id || user._id);
      setCommentLikedByMe((prev) => {
        const next = { ...prev };
        for (const c of comments) {
          if (next[c._id] === undefined) {
            const likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
            next[c._id] = likedBy.some((u) => String(u) === myId);
          }
        }
        return next;
      });
    }
  }, [comments, user]);

  // Parse post data
  const post = useMemo(() => {
    return {
      id: postResponse?._id || postId,
      title: postResponse?.title || "",
      content: postResponse?.content || "",
      coverImage:
        postResponse?.blog_picture ||
        "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&h=600&fit=crop",
      author: {
        name: postResponse?.author_name || postResponse?.author || "Unknown",
        avatar: postResponse?.author_picture || "",
      },
      publishDate: postResponse?.createdAt || new Date().toISOString(),
      readingTime: 5,
      views: typeof postResponse?.views === "number" ? postResponse?.views : 0,
      comments: comments.length,
      tags: Array.isArray(postResponse?.tags) ? postResponse.tags : [],
      bookRelated: postResponse?.relatedBook || "",
    };
  }, [postResponse, postId, comments.length]);

  // Share meta data
  const description = post.content
    ? post.content.replace(/<[^>]*>/g, "").substring(0, 150) + "..."
    : "";
  const imageUrl = post.blog_picture
    ? post.blog_picture
    : `${window.location.origin}${post.blog_picture}`;

  // Related posts
  const { data: listResponse } = useQuery({
    queryKey: ["blogposts-public"],
    queryFn: async () => {
      const res = await api.get("/blogposts", { params: { scope: "public", limit: 100 } });
      return res.data;
    },
    staleTime: 60_000,
  });

  const relatedPosts = useMemo(() => {
    const all = Array.isArray(listResponse?.data) ? listResponse.data : [];
    const tags = Array.isArray(post.tags) ? post.tags : [];
    if (!tags.length) return [];
    return all
      .filter((p) => p._id !== post.id)
      .map((p) => {
        const pTags = Array.isArray(p.tags) ? p.tags : [];
        const matching = pTags.filter((t) => tags.includes(t));
        return {
          id: p._id,
          title: p.title,
          author: p.author_name || p.author || "Unknown",
          publishDate: p.createdAt,
          readingTime: 5,
          coverImage: p.blog_picture || "",
          tags: pTags,
          matchingTags: matching,
        };
      })
      .filter((rp) => rp.matchingTags.length > 0)
      .slice(0, 6);
  }, [listResponse, post.tags, post.id]);

  const moreByAuthor = useMemo(() => {
    const all = Array.isArray(listResponse?.data) ? listResponse.data : [];
    const authorName = post.author.name;
    if (!authorName || authorName === "Unknown") return [];
    const normalizedAuthorName = authorName.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (p._id === post.id) return false; // Exclude current post
      const pAuthor = (p.author_name || p.author)?.trim().toLowerCase();
      return pAuthor === normalizedAuthorName;
    });
    return filtered
      .map((p) => ({
        id: p._id,
        title: p.title,
        author: p.author_name || p.author || "Unknown",
        publishDate: p.createdAt,
        readingTime: 5,
        coverImage: p.blog_picture || "",
        tags: Array.isArray(p.tags) ? p.tags : [],
      }))
      .slice(0, 6);
  }, [listResponse, post.author.name, post.id]);

  // ========== MUTATIONS ========== //
  const createCommentMutation = useMutation({
    mutationFn: async ({ content }) => {
      const res = await api.post(`/blogposts/${postId}/comments`, { content });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogpost-comments", postId] });
      toast.success("Comment posted");
      setCommentText("");
      setShowCommentForm(false);
    },
    onError: (err) => {
      toast.error("Failed to post comment", {
        description: err?.response?.data?.message || "Please try again.",
      });
    },
  });

  const createReplyMutation = useMutation({
    mutationFn: async ({ commentId, content }) => {
      const res = await api.post(`/blogposts/${postId}/comments/${commentId}/replies`, {
        content,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogpost-comments", postId] });
      toast.success("Reply posted");
      setReplyTextByCommentId((prev) => ({ ...prev, [activeReplyCommentId]: "" }));
      setActiveReplyCommentId(null);
    },
    onError: (err) => {
      toast.error("Failed to post reply", {
        description: err?.response?.data?.message || "Please try again.",
      });
    },
  });

  const toggleCommentLikeMutation = useMutation({
    mutationFn: async ({ commentId }) => {
      const res = await api.post(`/blogposts/${postId}/comments/${commentId}/like`);
      return res.data?.data;
    },
    onSuccess: (data) => {
      if (!data?.commentId) return;
      setCommentLikes((prev) => ({ ...prev, [data.commentId]: data.likes }));
      setCommentLikedByMe((prev) => ({ ...prev, [data.commentId]: !!data.liked }));
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ["blogpost-comments", postId] });
      toast.error("Failed to like comment", {
        description: err?.response?.data?.message || "Please try again.",
      });
    },
  });

  // ========== UI ACTIONS ========== //
  const handleLike = () => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      toast.success(next ? "Post liked!" : "Like removed");
      return next;
    });
  };

  const handleFavorite = () => {
    dispatch(toggleFavorite(postId));
    toast.success(isFavorited ? "Removed from Favorites!" : "Added to Favorites!");
  };

  // const handleBookmark = () => {
  //   setBookmarked((prev) => {
  //     let next;
  //     const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
  //     if (prev) {
  //       next = false;
  //       localStorage.setItem(
  //         "bookmarks",
  //         JSON.stringify(bookmarks.filter(id => id !== postId))
  //       );
  //       toast.success("Bookmark removed");
  //     } else {
  //       next = true;
  //       localStorage.setItem(
  //         "bookmarks",
  //         JSON.stringify([...bookmarks, postId])
  //       );
  //       toast.success("Post bookmarked!");
  //     }
  //     return next;
  //   });
  // };

  const handleShare = async () => {
    try {
      const shareUrl = `https://jjureadingclub.com/api/share/blog/${postId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied!");
    } catch (err) {
      toast.error("Copy failed", {
        description: "Unable to copy share link",
      });
    }
  };

  const handleComment = () => {
    if (!user) return;
    if (!commentText.trim()) return;
    createCommentMutation.mutate({ content: commentText.trim() });
  };

  const openReply = (commentId) => {
    if (!user) return;
    setActiveReplyCommentId((prev) => (prev === commentId ? null : commentId));
  };

  const submitReply = (commentId) => {
    if (!user) return;
    const text = (replyTextByCommentId[commentId] || "").trim();
    if (!text) return;
    createReplyMutation.mutate({ commentId, content: text });
  };

  const handleCommentLike = (comment) => {
    if (!user) {
      toast.error("Please login to like comments");
      return;
    }
    const commentId = comment._id;
    const currentlyLiked = !!commentLikedByMe[commentId];
    const currentCount = commentLikes[commentId] ?? (comment.likes || 0);
    setCommentLikedByMe((prev) => ({ ...prev, [commentId]: !currentlyLiked }));
    setCommentLikes((prev) => ({
      ...prev,
      [commentId]: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    }));
    toggleCommentLikeMutation.mutate({ commentId });
  };

  const loginCta = (
    <div className="rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">Want to join the discussion?</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create an account to post comments and replies.
          </p>
        </div>
        <Button className={"dark:bg-orange-600"} variant="default" onClick={() => (window.location.href = "/login")}>Login </Button>
      </div>
    </div>
  );

  const handleRelated = (id) => onRelatedPostClick?.(id);

  if (isLoading) return <Loader />;

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-0 sm:px-4 mt-12  py-6 sm:py-8">
          {/* ARTICLE */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-none sm:rounded-lg shadow-none sm:shadow-sm overflow-hidden"
          >
            {/* Cover image with overlay actions */}
            <div className="relative w-full h-80 sm:h-96 overflow-hidden">
              <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={onBack}
                    className="bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur shadow-lg">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <span className="text-xs text-white/90 flex items-center gap-1">
                    <Eye className="w-4 h-4" /> {viewCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                <Button
  size="sm"
  variant="secondary"
  onClick={handleFavorite}
  className="bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur shadow-lg"
  title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
>
  <Heart
    className={`w-4 h-4 transition-colors ${
      isFavorited
        ? "text-red-500 fill-red-500"
        : "text-white"
    }`}
  />
</Button>

                 

                  {/* <Button size="sm" variant="secondary" onClick={handleBookmark}
                    className="bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur shadow-lg"
                    title={bookmarked ? "Remove Bookmark" : "Bookmark"}>
                    <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-white text-orange-600" : ""}`} />
                  </Button> */}
                  <Button size="sm" variant="secondary" onClick={handleShare}
                    className="bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur shadow-lg"
                    title="Share">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Post body */}
            <div className="p-4 sm:p-6 md:p-10">
              {post.bookRelated && (
                <div className="mb-6">
                  <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 flex items-center gap-2 w-fit dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900">
                    <BookOpen className="w-4 h-4" />
                    Written after reading {post.bookRelated}
                  </Badge>
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
                {post.title}
              </h1>
              <div className="flex items-center gap-4 mb-8 pb-8 border-b dark:border-gray-800">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={post.author.avatar} />
                  <AvatarFallback>{post.author.name?.[0] || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{post.author.name}</p>
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900"
                    >
                      {post.author.role || ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-5 text-sm text-gray-600 dark:text-gray-400">
                    <span className="">
                      {new Date(post.publishDate).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric"
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {post.comments} comments
                    </span>
                  </div>
                </div>
              </div>
              <div
                className={`prose prose-base sm:prose-lg max-w-none font-serif dark:prose-invert relative break-words ${
                  showFullContent ? "" : "max-h-[520px] overflow-hidden"
                }`}
              >
                {post.content && post.content.includes("<") ? (
                  <div dangerouslySetInnerHTML={{ __html: post.content }} />
                ) : (
                  post.content.split("\n\n").map((paragraph, index) => (
                    <p key={index} className="mb-6 leading-relaxed break-words whitespace-pre-wrap">
                      {paragraph}
                    </p>
                  ))
                )}
                {!showFullContent && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80" />
                )}
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={() => setShowFullContent((v) => !v)}>
                  {showFullContent ? "Show less" : "Read full post"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t dark:border-gray-800">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.article>
          {/* Comments Section */}
          <Card className="mt-8 shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <MessageCircle className="w-5 h-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!user ? (
                <>
                  {loginCta}
                  <Separator className="dark:bg-gray-800" />
                </>
              ) : (
                <>
                  {!showCommentForm ? (
                    <Button variant="outline" className="w-full" onClick={() => setShowCommentForm(true)}>
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Add a comment
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Share your thoughts..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleComment}
                          className="bg-orange-600 hover:bg-orange-700"
                          disabled={createCommentMutation.isPending}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {createCommentMutation.isPending ? "Posting..." : "Post Comment"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowCommentForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  <Separator className="dark:bg-gray-800" />
                </>
              )}
              <div className="space-y-6">
                {commentsLoading ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</div>
                ) : commentsError ? (
                  <div className="text-sm text-red-600">
                    Failed to load comments: {commentsErr?.response?.data?.message || commentsErr?.message || "Unknown"}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No comments yet.</div>
                ) : (
                  comments.map((comment) => {
                    const displayLikes = commentLikes[comment._id] ?? (comment.likes || 0);
                    const isLiked = !!commentLikedByMe[comment._id];
                    return (
                      <div key={comment._id}>
                        <div className={`${
                          comment.isPinned || comment.isBestInsight
                            ? "bg-gradient-to-r from-orange-50 to-indigo-50 border border-orange-200 p-4 rounded-lg dark:from-orange-950 dark:to-indigo-950 dark:border-orange-900"
                            : ""
                        }`}>
                          {comment.isPinned && (
                            <div className="flex items-center gap-2 text-sm text-orange-700 mb-2 dark:text-orange-300">
                              <Pin className="w-4 h-4" />
                              <span className="font-medium">Pinned by moderator</span>
                            </div>
                          )}
                          {comment.isBestInsight && (
                            <div className="flex items-center gap-2 text-sm text-purple-700 mb-2 dark:text-purple-300">
                              <Sparkles className="w-4 h-4" />
                              <span className="font-medium">Best Insight</span>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={comment.author?.avatar} />
                              <AvatarFallback>{comment.author?.name?.[0] || "U"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {comment.author?.name || "Unknown"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    comment.author?.role === "Moderator"
                                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900"
                                      : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-900"
                                  }`}
                                >
                                  {comment.author?.role || "Member"}
                                </Badge>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {timeAgo(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-200 mb-2 break-words">
                                {comment.content}
                              </p>
                              <div className="flex items-center gap-3 text-sm">
                                <button
                                  className={`flex items-center gap-1 transition-colors ${
                                    isLiked
                                      ? "text-orange-600"
                                      : "text-gray-500 hover:text-orange-600 dark:text-gray-400"
                                  }`}
                                  onClick={() => handleCommentLike(comment)}
                                  type="button"
                                  disabled={toggleCommentLikeMutation.isPending}
                                >
                                  <ThumbsUp className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                                  <span>{displayLikes}</span>
                                </button>
                                <button
                                  className="text-gray-500 hover:text-orange-600 transition-colors dark:text-gray-400"
                                  onClick={() => openReply(comment._id)}
                                  disabled={!user}
                                  type="button"
                                >
                                  Reply
                                </button>
                                <button
                                  className="text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 dark:text-gray-400"
                                  type="button"
                                >
                                  <Flag className="w-3 h-3" />
                                  Report
                                </button>
                              </div>
                              {user && activeReplyCommentId === comment._id && (
                                <div className="mt-3 space-y-2">
                                  <Textarea
                                    placeholder="Write a reply..."
                                    rows={2}
                                    value={replyTextByCommentId[comment._id] || ""}
                                    onChange={(e) =>
                                      setReplyTextByCommentId((prev) => ({
                                        ...prev,
                                        [comment._id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => submitReply(comment._id)}
                                      disabled={createReplyMutation.isPending}
                                      className="bg-orange-600 hover:bg-orange-700"
                                    >
                                      <Send className="w-4 h-4 mr-2" />
                                      {createReplyMutation.isPending ? "Posting..." : "Reply"}
                                    </Button>
                                    <Button variant="outline" onClick={() => setActiveReplyCommentId(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                          <div className="ml-12 mt-4 space-y-4">
                            {comment.replies.map((reply) => (
                              <div key={reply._id} className="flex gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={reply.author?.avatar} />
                                  <AvatarFallback>{reply.author?.name?.[0] || "U"}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                      {reply.author?.name || "Unknown"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900"
                                    >
                                      {reply.author?.role || "Member"}
                                    </Badge>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {timeAgo(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-gray-200 break-words">
                                    {reply.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
          {/* -- Similar Topics -- */}
          {relatedPosts.length > 0 && (
            <Card className="mt-8 shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Similar Topics You May Like
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">Based on shared tags</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {relatedPosts.map((relatedPost) => (
                  <motion.div
                    key={relatedPost.id}
                    whileHover={{ scale: 1.01 }}
                    className="group cursor-pointer"
                    onClick={() => handleRelated(relatedPost.id)}
                  >
                    <div className="flex gap-3">
                      <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={relatedPost.coverImage}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-orange-600 transition-colors mb-1">
                          {relatedPost.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          By {relatedPost.author} • {relatedPost.readingTime} min
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {relatedPost.matchingTags.map((tag) => (
                            <Badge
                              key={tag}
                              className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-900"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Separator className="mt-4 dark:bg-gray-800" />
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* -- More by Author -- */}
          {moreByAuthor.length > 0 && (
            <Card className="mt-8 shadow-sm dark:bg-gray-900 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 dark:text-gray-100">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback className="text-xs">{post.author.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  More by {post.author.name}
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">Other articles from this author</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {moreByAuthor.map((authorPost) => (
                  <motion.div
                    key={authorPost.id}
                    whileHover={{ scale: 1.01 }}
                    className="group cursor-pointer"
                    onClick={() => handleRelated(authorPost.id)}
                  >
                    <div className="flex gap-3">
                      <div className="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={authorPost.coverImage}
                          alt={authorPost.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-orange-600 transition-colors mb-1">
                          {authorPost.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {authorPost.readingTime} min • {timeAgo(authorPost.publishDate)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {authorPost.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-900"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Separator className="mt-4 dark:bg-gray-800" />
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
        <Footers clubLogoSrc="/jjuclub.jpg" />
      </div>
    </>
  );
}

// -- routing wrapper --
export default function BlogDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <BlogPostDetail
      postId={id}
      onBack={() => navigate(-1)}
      onRelatedPostClick={(relatedId) => navigate(`/blogs/${relatedId}`)}
    />
  );
}