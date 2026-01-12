import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Save, Tag, X } from "lucide-react";

import QuillEditor from "./QuillEditor";
import api from "@/app/api/apislice";

import { toast } from "sonner";


const AVAILABLE_TAGS = [
  "React",
  "JavaScript",
  "CSS",
  "Tailwind",
  "Web Development",
  "Backend",
  "Frontend",
  "UI Design",
  "Performance",
  "Supabase",
  "Real-time",
  "API",
  "Testing",
  "TypeScript",
  "Future Tech",
];

// --- API calls using your api instance ---
const apiGetBlogById = async (id) => {
  const res = await api.get(`/blogposts/${id}`);
  return res.data.data;
};

const apiCreateBlog = async (payload) => {
  const res = await api.post(`/blogposts`, payload);
  return res.data.data;
};

const apiUpdateBlog = async ({ id, payload }) => {
  const res = await api.put(`/blogposts/${id}`, payload);
  return res.data.data;
};

const BlogEdit = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redux user (adjust selector to your store shape)
  const user = useSelector((state) => state.auth?.user);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false);

  // Image state
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [imagePath, setImagePath] = useState(""); // optional
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // 
  // Fetch blog post in edit mode
  // 
  const {
    data: post,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["blogpost", id],
    queryFn: () => apiGetBlogById(id),
    enabled: isEditMode,
  });

  // Hydrate form once post loads
  useEffect(() => {
    if (!isEditMode) return;
    if (!post) return;

    // Permission check (if backend sends created_by populated or raw)
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
  }, [isEditMode, post, user, navigate]);

  // 
  // Mutations
  // 
  const createMutation = useMutation({
    mutationFn: apiCreateBlog,
    onSuccess: (created) => {
      toast.success("Article created successfully.");
      queryClient.invalidateQueries({ queryKey: ["blogposts"] });

      // If you want to go to edit page after create, uncomment:
      // navigate(`/blog/edit/${created._id}`);

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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // 
  // Helpers
  // 
  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error(
        `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 2MB limit.`
      );
      e.target.value = "";
      setSelectedImage(null);
      return;
    }

    setSelectedImage(file);
    toast(file.name || "Image selected");
  };

  const handleUploadImage = async () => {
    if (!selectedImage) {
      toast.error("Please select an image first.");
      return null;
    }

    if (!user) {
      toast.error("You must be signed in to upload images.");
      navigate("/signin");
      return null;
    }

    setIsUploading(true);
    try {
      const myId = user?.id || user?._id;
      const { path, url } = await uploadImage(selectedImage, myId);

      setFeaturedImageUrl(url);
      setImagePath(path);

      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast.success("Image uploaded successfully.");

      return { url, path };
    } catch (e) {
      toast.error(e?.message || "Failed to upload image.");
      throw e;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (publish) => {
    // validations
    if (!title.trim()) {
      return toast.error("Please add a title to your article.");
    }

    if (!content || content === "<p><br></p>") {
      return toast.error("Please add some content to your article.");
    }

    if (!user) {
      toast.error("You must be signed in to save an article.");
      navigate("/signin");
      return;
    }

    if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
      return toast.error("Please select at least one tag.");
    }

    let uploadedImageData = null;

    // If an image is selected but not uploaded yet, ask
    if (selectedImage) {
      const shouldUpload = confirm(
        "You selected an image that hasn't been uploaded yet. Upload it now?"
      );

      if (shouldUpload) {
        try {
          uploadedImageData = await handleUploadImage();
          await new Promise((r) => setTimeout(r, 50));
        } catch {
          return; // toast already shown
        }
      } else {
        const shouldProceed = confirm("Proceed without uploading the image?");
        if (!shouldProceed) return;

        setSelectedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }

    const payload = {
      title,
      content,
      tags: selectedTags,
      blog_picture: uploadedImageData?.url || featuredImageUrl || "",
      status: publish ? "Published" : "Draft",
    };

    if (isEditMode) {
      updateMutation.mutate({ id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // 
  // UI states
  // 
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

      {/* Featured Image Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Featured Image
          <button
            type="button"
            onClick={() =>
              toast("Maximum image size allowed is 2MB")
            }
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

              {selectedImage && (
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={isUploading}
                  className="px-3 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              )}
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
                  setImagePath("");
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
      <div className="mb-6 relative">
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

      {/* Bottom actions */}
      <div className="px-6 py-4 md:px-10 flex justify-end space-x-4">
        <button
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isEditMode ? "Update as Draft" : "Save as Draft"}
        </button>

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