import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Eye, Filter, ChevronRight } from "lucide-react";

import api from "@/app/api/apislice";
// import BlogHeros from "./BlogHero";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge"; // shadcn badge

import Footers from "../Homepage/Footer";
import BlogHeros from "../Homepage/HeroSections"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

/*  constants  */

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&h=600&fit=crop";

const PAGE_SIZE = 12;

/*  utils  */

function stripHtml(input) {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normTag(tag) {
  return String(tag ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tagLabel(tag) {
  if (typeof tag === "string") return tag;
  if (tag && typeof tag === "object")
    return tag.name || tag.label || tag.value || tag.title || "";
  return "";
}

/*  tag pill  */

function TagPill({ active, children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-100",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/*  main component  */

export default function BlogFeed({ onPostClick }) {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagKey, setSelectedTagKey] = useState("");
  const [page, setPage] = useState(1);

  /* -------- fetch posts -------- */

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["blogposts-feed"],
    queryFn: async () => {
      const res = await api.get("/blogposts", {
        params: { scope: "public", limit: 1000 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  /* -------- normalize posts -------- */

  const posts = useMemo(() => {
    const raw = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    return raw.map((post, index) => {
      const tags = (Array.isArray(post?.tags) ? post.tags : [])
        .map(tagLabel)
        .filter(Boolean);

      return {
        id: String(post?._id || post?.id || `fallback-${index}`),
        title: stripHtml(post?.title) || "Untitled",
        excerpt:
          stripHtml(post?.excerpt) ||
          `${stripHtml(post?.content).slice(0, 140)}...`,
        coverImage:
          post?.blog_picture || post?.coverImage || FALLBACK_IMAGE,
        author: post?.author || "Unknown",
        readingTime: post?.readingTime || 5,
        publishDate:
          post?.createdAt || post?.publishDate || new Date().toISOString(),
        views: post?.views || 0,
        tags,
        tagsNorm: tags.map(normTag),
      };
    });
  }, [data]);

  /* -------- collect all tags -------- */

  const allTags = useMemo(() => {
    const map = new Map();

    posts.forEach((post) => {
      post.tags.forEach((label) => {
        const key = normTag(label);
        if (key && !map.has(key)) {
          map.set(key, label);
        }
      });
    });

    return Array.from(map.entries()).map(([key, label]) => ({
      key,
      label,
    }));
  }, [posts]);

  /* -------- reset invalid tag -------- */

  useEffect(() => {
    if (selectedTagKey && !allTags.some((t) => t.key === selectedTagKey)) {
      setSelectedTagKey("");
    }
  }, [allTags, selectedTagKey]);

  /* -------- reset page on filter change -------- */

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedTagKey]);

  /* -------- clear filters -------- */

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedTagKey("");
    setPage(1);
  };

  /* -------- filtering -------- */

  const filteredPosts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return posts
      .slice()
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
      .filter((post) => {
        const matchSearch =
          !q ||
          post.title.toLowerCase().includes(q) ||
          post.excerpt.toLowerCase().includes(q);

        const matchTag =
          !selectedTagKey || post.tagsNorm.includes(selectedTagKey);

        return matchSearch && matchTag;
      });
  }, [posts, searchTerm, selectedTagKey]);

  /* -------- pagination -------- */

  const totalPosts = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));

  // clamp page if totalPages changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pagePosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, page]);

  const startIndex = totalPosts === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(totalPosts, page * PAGE_SIZE);
  const remaining = Math.max(0, totalPosts - endIndex);

  // produces array of numbers and "…" markers for pagination
  function renderPages() {
    const pages = [];
    const delta = 2; // how many pages around current to show
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - delta && i <= page + delta)
      ) {
        pages.push(i);
      } else {
        if (pages[pages.length - 1] !== "…") pages.push("…");
      }
    }
    return pages;
  }

  const handlePostClick = (id) => {
    onPostClick ? onPostClick(id) : navigate(`/blogs/${id}`);
  };

  /* -------- UI -------- */

  if (isLoading)
    return <p className="p-6 text-gray-500">Loading blog posts...</p>;

  if (isError)
    return (
      <p className="p-6 text-red-600">
        Failed to load posts: {error?.message}
      </p>
    );

  return (
    <div>
          <BlogHeros />

   
    <div className="min-h-screen py-10">

      <div className="mx-auto max-w-7xl px-4 mt-32">
        {/* Header + Paragraph */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">Our Blog</h2>
          <p className="mt-3 text-gray-600 text-lg">
            Explore our latest insights, tutorials, and updates about education technology and online learning.
          </p>
          <div className="mt-2 text-sm text-gray-500">Blog posts</div>
        </div>

        {/* Search */}
        <div className="mb-6 max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search articles..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="mb-10 max-w-xl mx-auto">
          <div className="flex justify-between mb-3">
            <div className="flex gap-2 items-center">
              {/* <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold">Tags</span> */}
            </div>

            {(searchTerm || selectedTagKey) && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <TagPill active={!selectedTagKey} onClick={clearFilters}>
              All
            </TagPill>

            {allTags.map(({ key, label }) => (
              <TagPill
                key={key}
                active={key === selectedTagKey}
                onClick={() =>
                  setSelectedTagKey((prev) => (prev === key ? "" : key))
                }
              >
                {label}
              </TagPill>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pagePosts.map((post) => {
            const tags = post.tags || [];
            const showHorizontal = tags.length > 1; // if more than one, show horizontal
            return (
              <Card
                key={post.id}
                onClick={() => handlePostClick(post.id)}
                className="cursor-pointer hover:shadow-xl transition-transform transform hover:-translate-y-1 rounded-2xl overflow-hidden relative bg-white"
              >
                <div className="relative">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="h-48 w-full object-cover"
                  />

                  {/* Tag overlays using shadcn Badge */}
                  <div
                    className={`absolute left-3 top-3 pointer-events-none ${
                      showHorizontal
                        ? "flex flex-row items-center gap-2 p-1"
                        : "flex flex-col p-0"
                    }`}
                  >
                    {tags.slice(0, 3).map((t, i) => (
                      <Badge
                        key={i}
                        className="bg-white/95 text-xs text-gray-800 font-semibold px-2 py-1 shadow-sm"
                      >
                        {t}
                      </Badge>
                    ))}

                    {tags.length > 3 && (
                      <Badge className="bg-white/90 text-xs text-gray-600 font-medium px-2 py-1 shadow-sm">
                        +{tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-5">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>

                 

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                    <div>
                         <Avatar className="w-10 h-10">
                            <AvatarImage src={post.author?.avatar} />
                            <AvatarFallback>{post.author?.name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                    </div>

                        <div>
                             <p>{post.author}</p>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                    <div className="inline-flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{post.readingTime} min</span>
                    </div>

                    <div className="inline-flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>{post.views}</span>
                    </div>
                  </div>
                        </div>
                   
                    
                    </div>

                    {/* Read more with arrow — more prominent and animates on hover */}
                    <div className="flex items-center text-sm text-blue-600 font-semibold transition-transform group">
                      <span className="mr-2">Read more</span>
                      <ChevronRight className="w-4 h-4 transition-transform transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPosts > 0 && (
          <div className="mt-10 flex flex-col gap-3 items-center">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {renderPages().map((p, idx) =>
                p === "…" ? (
                  <span key={`dots-${idx}`} className="px-2 text-gray-500">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-10 w-10 rounded-md border text-sm font-semibold transition ${
                      page === p
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                    }`}
                    aria-current={page === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                disabled={page >= totalPages}
                className="h-10 px-4 rounded-md border bg-white text-gray-800 border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {startIndex}-{endIndex} of {totalPosts} posts
            </div>
            {remaining > 0 && (
              <div className="text-sm text-gray-500">
                {remaining} more posts available
              </div>
            )}
          </div>
        )}
      </div>
      <Footers clubLogoSrc="/jjuclub.jpg" />
    </div>
     </div>
  );
}