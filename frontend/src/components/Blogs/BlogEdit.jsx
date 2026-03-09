import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Save, Tag, X } from "lucide-react";

import QuillEditor from "./QuillEditor";
import api from "@/app/api/apislice";

import { toast } from "sonner";

const AVAILABLE_TAGS = [
  "Saynis",
  "Taariikh",
  "Sheeko Faneed",
  "Sheeko Gaaban",
  "Suugan",
  "Technology",
  "Buug Sookoobid",
  "Diin",
  "Arimo Bulsho",
];

// Utility to normalize author names: remove duplicates, extra spaces, and trim
const normalizeAuthorName = (name) => {
  if (!name) return "";
  // Split into words, remove duplicates (case-insensitive), trim, and rejoin
  const words = name.trim().replace(/\s+/g, " ").split(" ");
  const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))].map(w =>
    words.find(orig => orig.toLowerCase() === w) // Preserve original casing
  );
  return uniqueWords.join(" ");
};

// API helpers detect FormData and set multipart header
const apiGetBlogById = async (id) => {
  const res = await api.get(`/blogposts/${id}`);
  return res.data.data;
};

const apiCreateBlog = async (payload) => {
  const config = payload instanceof FormData
    ? { headers: { "Content-Type": "multipart/form-data" } }
    : undefined;
  const res = await api.post("/blogposts", payload, config);
  return res.data.data;
};

const apiUpdateBlog = async ({ id, payload }) => {
  const config = payload instanceof FormData
    ? { headers: { "Content-Type": "multipart/form-data" } }
    : undefined;
  const res = await api.put(`/blogposts/${id}`, payload, config);
  return res.data.data;
};

const BlogEdit = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user = useSelector((state) => state.auth?.user);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false);

  // Image state
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  // New author state
  const [authorType, setAuthorType] = useState("me"); // "me" or "another"
  const [authorName, setAuthorName] = useState("");
  const [authorPictureUrl, setAuthorPictureUrl] = useState("");
  const [selectedAuthorImage, setSelectedAuthorImage] = useState(null);

  // Phase 7: SEO and Scheduling state
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fileInputRef = useRef(null);
  const authorFileInputRef = useRef(null);
  const editorRef = useRef(null);

  const { data: post, isLoading, isError, error } = useQuery({
    queryKey: ["blogpost", id],
    queryFn: () => apiGetBlogById(id),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!isEditMode) return;
    if (!post) return;

    const ownerId = post.created_by?._id || post.created_by;
    const myId = user?.id || user?._id;

    if (myId && ownerId && String(ownerId) !== String(myId)) {
      toast.error("You do not have permission to edit this article.");
      navigate("/");
      return;
    }

    setTitle(post.title || "");
    setContent(post.content || "");
    setSelectedTags(Array.isArray(post.tags) ? post.tags : []);
    setFeaturedImageUrl(post.blog_picture || "");

    // Initialize author fields with normalization
    const normalizedAuthorName = normalizeAuthorName(post.author_name);
    setAuthorType(normalizedAuthorName ? "another" : "me");
    setAuthorName(normalizedAuthorName || "");
    setAuthorPictureUrl(post.author_picture || "");

    // Phase 7: Load SEO and scheduling fields
    setSlug(post.slug || "");
    setSeoTitle(post.seoTitle || "");
    setSeoDescription(post.seoDescription || "");
    setPublishAt(post.publishAt ? new Date(post.publishAt).toISOString().slice(0, 16) : "");
  }, [isEditMode, post, user, navigate]);

  const createMutation = useMutation({
    mutationFn: apiCreateBlog,
    onSuccess: () => {
      toast.success("Article created successfully.");
      queryClient.invalidateQueries({ queryKey: ["blogposts"] });
      navigate(-1);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to create article.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: apiUpdateBlog,
    onSuccess: () => {
      toast.success("Article updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["blogpost", id] });
      queryClient.invalidateQueries({ queryKey: ["blogposts"] });
      navigate(-1);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update article.");
    },
  });

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  // Helpers
  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t.trim()) : [...prev, tag]
    );
  };

  const handleContentChange = (value) => setContent(value);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      e.target.value = "";
      setSelectedImage(null);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 5MB limit.`
      );
      e.target.value = "";
      setSelectedImage(null);
      return;
    }

    setSelectedImage(file);
    // show preview immediately by setting featuredImageUrl to local blob URL (optional)
    setFeaturedImageUrl(URL.createObjectURL(file));
    toast.success("Image selected (will be uploaded with the form).");
  };

  const handleAuthorImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      e.target.value = "";
      setSelectedAuthorImage(null);
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 2MB limit.`
      );
      e.target.value = "";
      setSelectedAuthorImage(null);
      return;
    }

    setSelectedAuthorImage(file);
    setAuthorPictureUrl(URL.createObjectURL(file));
    toast.success("Author image selected (will be uploaded with the form).");
  };

  const handleSave = async (publish, schedulePublish = false) => {
    if (!title.trim()) {
      return toast.error("Please add a title to your article.");
    }

    if (!content || content === "<p><br></p>") {
      return toast.error("Please add some content to your article.");
    }

    if (!user) {
      toast.error("You must be signed in to save an article.");
      navigate("/login");
      return;
    }

    if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
      return toast.error("Please select at least one tag.");
    }

    // Validate and normalize author
    let finalAuthorName = "";
    if (authorType === "another") {
      finalAuthorName = normalizeAuthorName(authorName);
      if (!finalAuthorName.trim()) {
        return toast.error("Please provide the author's name.");
      }
    }

    // Determine status
    let status = "Draft";
    if (schedulePublish && publishAt) {
      status = "Scheduled";
    } else if (publish) {
      status = "Published";
    }

    // If there is a file, send FormData. Must append file under field name "image"
    // because router uses upload.single("image").
    const hasFile = Boolean(selectedImage);
    const hasAuthorFile = Boolean(selectedAuthorImage);
    let payload;

    if (hasFile || hasAuthorFile) {
      payload = new FormData();
      payload.append("title", title);
      payload.append("content", content);
      // send tags as JSON string; server will JSON.parse if needed
      payload.append("tags", JSON.stringify(selectedTags));
      payload.append("status", status);
      payload.append("author_type", authorType);
      if (authorType === "another") {
        payload.append("author_name", finalAuthorName);
        payload.append("author_picture", authorPictureUrl);
      }
      // Phase 7: Add SEO and scheduling fields
      if (slug.trim()) payload.append("slug", slug.trim());
      if (seoTitle.trim()) payload.append("seoTitle", seoTitle.trim());
      if (seoDescription.trim()) payload.append("seoDescription", seoDescription.trim());
      if (publishAt) payload.append("publishAt", publishAt);
      
      // field name must match multer: "image"
      if (hasFile) payload.append("image", selectedImage, selectedImage.name);
      if (hasAuthorFile) payload.append("author_picture", selectedAuthorImage, selectedAuthorImage.name); // Assuming multer fields setup
    } else {
      // plain JSON payload — backend supports both JSON and multipart
      payload = {
        title,
        content,
        tags: selectedTags,
        blog_picture: featuredImageUrl || "",
        status,
        author_type: authorType,
        ...(authorType === "another" && {
          author_name: finalAuthorName,
          author_picture: authorPictureUrl,
        }),
        // Phase 7: SEO and scheduling fields
        ...(slug.trim() && { slug: slug.trim() }),
        ...(seoTitle.trim() && { seoTitle: seoTitle.trim() }),
        ...(seoDescription.trim() && { seoDescription: seoDescription.trim() }),
        ...(publishAt && { publishAt }),
      };
    }

    try {
      if (isEditMode) {
        // updateMutation expects an object { id, payload }
        updateMutation.mutate({ id, payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save article.");
    }
  };

  if (isEditMode && isLoading) return <div className="p-6">Loading...</div>;

  if (isEditMode && isError) {
    return (
      <div className="p-6">
        Failed to load article:{" "}
        {error?.response?.data?.message || error?.message || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* header buttons */}
      <div className="mb-6 space-x-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
          {isEditMode ? "Edit Article" : "Create New Article"}
        </h1>

        <div className="flex space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <X className="inline mr-2 h-4 w-4" />
            Cancel
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="inline mr-2 h-4 w-4" />
            {isEditMode ? "Update Draft" : "Save as Draft"}
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="inline mr-2 h-4 w-4" />
            {isEditMode ? "Update and Publish" : "Save and Publish"}
          </button>
        </div>
      </div>

      {/* Title input */}
      <div className="mb-6">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          placeholder="Enter article title"
        />
      </div>

      {/* Author selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="authorType"
              value="me"
              checked={authorType === "me"}
              onChange={(e) => setAuthorType(e.target.value)}
              className="mr-2"
            />
            ME (I am the author)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="authorType"
              value="another"
              checked={authorType === "another"}
              onChange={(e) => setAuthorType(e.target.value)}
              className="mr-2"
            />
            Another person
          </label>
        </div>
        {authorType === "another" && (
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="authorName" className="block text-sm font-medium text-gray-700">
                Author's Name
              </label>
              <input
                type="text"
                id="authorName"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                placeholder="Enter author's name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Author's Picture
              </label>
              <input
                type="file"
                id="author-picture"
                accept="image/*"
                onChange={handleAuthorImageSelect}
                ref={authorFileInputRef}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              {authorPictureUrl && (
                <div className="mt-2">
                  <img
                    src={authorPictureUrl}
                    alt="Author picture"
                    className="w-24 h-24 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorPictureUrl("");
                      setSelectedAuthorImage(null);
                      if (authorFileInputRef.current) authorFileInputRef.current.value = "";
                      toast("Author image removed.");
                    }}
                    className="ml-2 text-red-500 text-xs hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Featured Image Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Featured Image
          <button
            type="button"
            onClick={() => toast("Maximum image size allowed is 2MB")}
            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <Info className="inline-block h-4 w-4" />
          </button>
        </label>

        <div className="mb-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="featured-image"
                accept="image/*"
                onChange={handleImageSelect}
                ref={fileInputRef}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
            </div>
          </div>
        </div>

        {featuredImageUrl && (
          <div className="mt-2 mb-4">
            <img
              src={featuredImageUrl}
              alt="Featured image"
              className="w-full max-h-64 object-cover rounded-md"
            />

            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500 truncate max-w-[80%]">
                {featuredImageUrl}
              </span>

              <button
                type="button"
                onClick={() => {
                  setFeaturedImageUrl("");
                  setSelectedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  toast("Image removed from the form.");
                }}
                className="text-red-500 text-xs hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tags selection */}
      <div className="mb-6 dark:text-black relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>

        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          onClick={() => setIsTagsMenuOpen((v) => !v)}
        >
          <Tag className="mr-1.5 h-4 w-4" />
          Add Tags
        </button>

        {isTagsMenuOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            <div className="grid grid-cols-2 gap-2 p-2">
              {AVAILABLE_TAGS.map((tag) => (
                <div
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`cursor-pointer px-3 py-2 rounded hover:bg-gray-100 ${
                    selectedTags.includes(tag) ? "bg-orange-50 text-orange-700" : ""
                  }`}
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <QuillEditor
            ref={editorRef}
            value={content}
            onChange={handleContentChange}
            placeholder={"Write your article content here..."}
            height="500"
          />
        </div>
      </div>

      {/* Phase 7: Advanced Settings (SEO & Scheduling) */}
      <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 text-left flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">
            Advanced Settings (SEO & Scheduling)
          </span>
          <span className="text-gray-500">{showAdvanced ? "−" : "+"}</span>
        </button>
        
        {showAdvanced && (
          <div className="p-4 space-y-4 bg-white">
            {/* URL Slug */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                URL Slug
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                placeholder="url-friendly-slug (auto-generated if empty)"
              />
              <p className="mt-1 text-xs text-gray-500">Leave empty to auto-generate from title</p>
            </div>

            {/* SEO Title */}
            <div>
              <label htmlFor="seoTitle" className="block text-sm font-medium text-gray-700">
                SEO Title
              </label>
              <input
                type="text"
                id="seoTitle"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={70}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                placeholder="Custom title for search engines"
              />
              <p className="mt-1 text-xs text-gray-500">{seoTitle.length}/70 characters</p>
            </div>

            {/* SEO Description */}
            <div>
              <label htmlFor="seoDescription" className="block text-sm font-medium text-gray-700">
                SEO Description
              </label>
              <textarea
                id="seoDescription"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                maxLength={160}
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                placeholder="Custom description for search engines and social sharing"
              />
              <p className="mt-1 text-xs text-gray-500">{seoDescription.length}/160 characters</p>
            </div>

            {/* Schedule Publishing */}
            <div>
              <label htmlFor="publishAt" className="block text-sm font-medium text-gray-700">
                Schedule Publishing
              </label>
              <input
                type="datetime-local"
                id="publishAt"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Set a future date/time to automatically publish</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-6 py-4 md:px-10 flex flex-wrap justify-end gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isEditMode ? "Update as Draft" : "Save as Draft"}
        </button>

        {publishAt && (
          <button
            onClick={() => handleSave(false, true)}
            disabled={isSaving}
            className="px-6 py-3 border border-blue-300 rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Schedule for {new Date(publishAt).toLocaleDateString()}
          </button>
        )}

        <button
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className="px-6 py-3 border border-transparent rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isEditMode ? "Update and Publish" : "Save and Publish"}
        </button>
      </div>
    </div>
  );
};

export default BlogEdit;