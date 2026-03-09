import React, { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Book,
  Megaphone,
  Calendar,
  Download,
  Save,
  ArrowLeft,
  Upload,
  FileText,
  X,
  Star,
  Pin,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import QuillEditor from "@/components/Blogs/QuillEditor";
import { toast } from "sonner";
import Loader from "@/components/Loader";

const TYPE_OPTIONS = [
  { value: "guide", label: "Reading Guide", icon: Book },
  { value: "announcement", label: "Announcement", icon: Megaphone },
  { value: "event-recap", label: "Event Recap", icon: Calendar },
  { value: "download", label: "Download", icon: Download },
];

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Archived", label: "Archived" },
];

const fetchResource = async (id) => {
  const res = await api.get(`/resources/${id}`);
  return res.data;
};

const ResourceEdit = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("guide");
  const [status, setStatus] = useState("Draft");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);

  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [selectedCoverImage, setSelectedCoverImage] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");

  const coverInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { data: resourceData, isLoading } = useQuery({
    queryKey: ["resource", id],
    queryFn: () => fetchResource(id),
    enabled: isEditMode,
    onSuccess: (data) => {
      const r = data?.data;
      if (r) {
        setTitle(r.title || "");
        setDescription(r.description || "");
        setContent(r.content || "");
        setType(r.type || "guide");
        setStatus(r.status || "Draft");
        setTags((r.tags || []).join(", "));
        setCategory(r.category || "");
        setSlug(r.slug || "");
        setSeoTitle(r.seoTitle || "");
        setSeoDescription(r.seoDescription || "");
        setEventDate(r.eventDate ? new Date(r.eventDate).toISOString().split("T")[0] : "");
        setEventLocation(r.eventLocation || "");
        setPublishAt(r.publishAt ? new Date(r.publishAt).toISOString().slice(0, 16) : "");
        setIsFeatured(r.isFeatured || false);
        setIsPinned(r.isPinned || false);
        setDisplayOrder(r.displayOrder || 0);
        setCoverImageUrl(r.coverImage || "");
        setFileUrl(r.fileUrl || "");
        setFileName(r.fileName || "");
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post("/resources", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Resource created successfully");
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      navigate("/dashboard/resources");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to create resource");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.put(`/resources/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Resource updated successfully");
      queryClient.invalidateQueries({ queryKey: ["resource", id] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      navigate("/dashboard/resources");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update resource");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleCoverImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedCoverImage(file);
      setCoverImageUrl(URL.createObjectURL(file));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("content", content);
    formData.append("type", type);
    formData.append("status", status);
    formData.append("tags", JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)));
    formData.append("category", category.trim());
    formData.append("slug", slug.trim());
    formData.append("seoTitle", seoTitle.trim());
    formData.append("seoDescription", seoDescription.trim());
    formData.append("isFeatured", isFeatured);
    formData.append("isPinned", isPinned);
    formData.append("displayOrder", displayOrder);

    if (type === "event-recap") {
      if (eventDate) formData.append("eventDate", eventDate);
      formData.append("eventLocation", eventLocation.trim());
    }

    if (publishAt) formData.append("publishAt", publishAt);

    if (selectedCoverImage) {
      formData.append("coverImage", selectedCoverImage);
    }

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    if (isEditMode) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isEditMode && isLoading) return <Loader />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? "Edit Resource" : "Create Resource"}
          </h1>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resource title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Fiction, Non-fiction"
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="reading, club, resources"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Content
            </h2>
            <QuillEditor value={content} onChange={setContent} />
          </CardContent>
        </Card>

        {/* Event Details (for event-recap) */}
        {type === "event-recap" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Event Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="eventLocation">Event Location</Label>
                  <Input
                    id="eventLocation"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Location or venue"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Media */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Media
            </h2>

            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <div className="mt-2">
                {coverImageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={coverImageUrl}
                      alt="Cover"
                      className="w-48 h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImageUrl("");
                        setSelectedCoverImage(null);
                        if (coverInputRef.current) coverInputRef.current.value = "";
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="w-48 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-500 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Download File (for download type) */}
            {type === "download" && (
              <div>
                <Label>Downloadable File</Label>
                <div className="mt-2">
                  {fileName ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <FileText className="w-8 h-8 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFileName("");
                          setSelectedFile(null);
                          setFileUrl("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-500 transition-colors"
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Click to upload file</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEO & Publishing */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              SEO & Publishing
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                />
              </div>

              <div>
                <Label htmlFor="publishAt">Schedule Publish</Label>
                <Input
                  id="publishAt"
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="SEO optimized title"
                  maxLength={70}
                />
                <p className="text-xs text-gray-500 mt-1">{seoTitle.length}/70 characters</p>
              </div>

              <div>
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  min={0}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="seoDescription">SEO Description</Label>
                <Textarea
                  id="seoDescription"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="SEO optimized description"
                  maxLength={160}
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">{seoDescription.length}/160 characters</p>
              </div>
            </div>

            {/* Featured/Pinned toggles */}
            <div className="flex items-center gap-6 pt-4 border-t dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Featured</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <Pin className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Pinned</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default ResourceEdit;
