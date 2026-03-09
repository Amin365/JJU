import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Book,
  Megaphone,
  Calendar,
  Download,
  Eye,
  Clock,
  ArrowLeft,
  MapPin,
  FileText,
  Share2,
  ExternalLink,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Loader from "@/components/Loader";
import Footers from "@/components/Homepage/Footer";
import { toast } from "sonner";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=400&fit=crop";

const TYPE_CONFIG = {
  guide: {
    icon: Book,
    label: "Reading Guide",
    color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  announcement: {
    icon: Megaphone,
    label: "Announcement",
    color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "event-recap": {
    icon: Calendar,
    label: "Event Recap",
    color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  },
  download: {
    icon: Download,
    label: "Download",
    color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  },
};

const fetchResource = async (id) => {
  const res = await api.get(`/resources/${id}`);
  return res.data;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const ResourceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resource", id],
    queryFn: () => fetchResource(id),
    staleTime: 60_000,
  });

  // Track view on mount
  useEffect(() => {
    if (id) {
      api.post(`/resources/${id}/views`).catch(() => {});
    }
  }, [id]);

  const handleDownload = async () => {
    if (!data?.data?.fileUrl) return;
    
    try {
      // Track download
      await api.post(`/resources/${id}/downloads`);
      window.open(data.data.fileUrl, "_blank");
    } catch (err) {
      console.error("Download error:", err);
      window.open(data.data.fileUrl, "_blank");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: data?.data?.title,
        text: data?.data?.description,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (isLoading) return <Loader />;

  if (isError || !data?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Resource Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The resource you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/resources")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Button>
        </div>
      </div>
    );
  }

  const resource = data.data;
  const config = TYPE_CONFIG[resource.type] || TYPE_CONFIG.guide;
  const IconComponent = config.icon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/resources")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Resources
          </Button>
        </div>
      </div>

      {/* Cover Image */}
      <div className="relative h-64 md:h-80 lg:h-96 bg-gray-200 dark:bg-gray-700">
        <img
          src={resource.coverImage || FALLBACK_IMAGE}
          alt={resource.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <Badge className={`${config.color} border mb-3`}>
              <IconComponent className="w-4 h-4 mr-1" />
              {config.label}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {resource.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {resource.views || 0} views
              </span>
              {resource.type === "download" && (
                <span className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  {resource.downloads || 0} downloads
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(resource.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {resource.description && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Description
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300">{resource.description}</p>
                </CardContent>
              </Card>
            )}

            {resource.content && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div
                    className="prose prose-base max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: resource.content }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Event Details (for event-recap) */}
            {resource.type === "event-recap" && (resource.eventDate || resource.eventLocation) && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Event Details
                  </h2>
                  <div className="space-y-3">
                    {resource.eventDate && (
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <Calendar className="w-5 h-5 text-purple-600" />
                        <span>{new Date(resource.eventDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}</span>
                      </div>
                    )}
                    {resource.eventLocation && (
                      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                        <MapPin className="w-5 h-5 text-purple-600" />
                        <span>{resource.eventLocation}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Download Card (for download type) */}
            {resource.type === "download" && resource.fileUrl && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Download File
                  </h2>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-10 h-10 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {resource.fileName || "File"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(resource.fileSize)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Share Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Share
                </h2>
                <Button variant="outline" className="w-full" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Resource
                </Button>
              </CardContent>
            </Card>

            {/* Tags */}
            {resource.tags?.length > 0 && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {resource.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Resources */}
            {resource.relatedResources?.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Related Resources
                  </h2>
                  <div className="space-y-3">
                    {resource.relatedResources.map((related) => (
                      <div
                        key={related._id}
                        onClick={() => navigate(`/resources/${related.slug || related._id}`)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <img
                          src={related.coverImage || FALLBACK_IMAGE}
                          alt={related.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {related.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {TYPE_CONFIG[related.type]?.label || "Resource"}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Footers clubLogoSrc="/jjuclub.jpg" />
    </div>
  );
};

export default ResourceDetails;
