import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Book,
  Megaphone,
  Calendar,
  Download,
  Search,
  Eye,
  Clock,
  ArrowRight,
  FileText,
  Filter,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Loader from "@/components/Loader";
import Footers from "@/components/Homepage/Footer";
import BlogHeros from "@/components/Homepage/HeroSections";

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

const fetchResources = async ({ type, page, limit }) => {
  const params = { page, limit, status: "Published" };
  if (type && type !== "all") params.type = type;
  const res = await api.get("/resources", { params });
  return res.data;
};

const fetchTypeSummary = async () => {
  const res = await api.get("/resources/types/summary");
  return res.data;
};

const ResourceCard = ({ resource, onClick }) => {
  const config = TYPE_CONFIG[resource.type] || TYPE_CONFIG.guide;
  const IconComponent = config.icon;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-xl transition-all transform hover:-translate-y-1 rounded-2xl overflow-hidden bg-white dark:bg-gray-800"
    >
      <div className="relative">
        <img
          src={resource.coverImage || FALLBACK_IMAGE}
          alt={resource.title}
          className="h-48 w-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <Badge className={`${config.color} border`}>
            <IconComponent className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        {resource.isPinned && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pinned</Badge>
          </div>
        )}
      </div>

      <CardContent className="p-5">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2">
          {resource.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
          {resource.description || resource.seoDescription || "No description available"}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {resource.views || 0}
            </span>
            {resource.type === "download" && (
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {resource.downloads || 0}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(resource.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center text-orange-600 dark:text-orange-400 font-semibold">
            <span className="mr-1">View</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ResourceHub = () => {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ["resources", activeType, page],
    queryFn: () => fetchResources({ type: activeType, page, limit }),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ["resources-summary"],
    queryFn: fetchTypeSummary,
    staleTime: 60_000,
  });

  const resources = resourcesData?.data || [];
  const totalPages = resourcesData?.totalPages || 1;
  const summary = summaryData?.data || {};

  const filteredResources = useMemo(() => {
    if (!search.trim()) return resources;
    const q = search.toLowerCase();
    return resources.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [resources, search]);

  const handleResourceClick = (resource) => {
    // Track view
    api.post(`/resources/${resource._id}/views`).catch(() => {});
    navigate(`/resources/${resource.slug || resource._id}`);
  };

  const totalCount = Object.values(summary).reduce((acc, s) => acc + (s.count || 0), 0);

  return (
    <div>
      <BlogHeros />

      <div className="min-h-screen py-10 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 mt-32">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              Resource Hub
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300 text-lg">
              Explore reading guides, announcements, event recaps, and downloadable resources.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card
              className={`cursor-pointer transition-all ${activeType === "all" ? "ring-2 ring-orange-500" : ""}`}
              onClick={() => { setActiveType("all"); setPage(1); }}
            >
              <CardContent className="p-4 text-center">
                <FileText className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
                <p className="text-xs text-gray-500">All Resources</p>
              </CardContent>
            </Card>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const IconComponent = config.icon;
              const count = summary[type]?.count || 0;
              return (
                <Card
                  key={type}
                  className={`cursor-pointer transition-all ${activeType === type ? "ring-2 ring-orange-500" : ""}`}
                  onClick={() => { setActiveType(type); setPage(1); }}
                >
                  <CardContent className="p-4 text-center">
                    <IconComponent className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                    <p className="text-xs text-gray-500">{config.label}s</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Search */}
          <div className="mb-8 max-w-xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search resources..."
              className="pl-9 bg-white dark:bg-gray-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Resources Grid */}
          {isLoading ? (
            <Loader />
          ) : filteredResources.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No resources found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredResources.map((resource) => (
                  <ResourceCard
                    key={resource._id}
                    resource={resource}
                    onClick={() => handleResourceClick(resource)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-4 text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <Footers clubLogoSrc="/jjuclub.jpg" />
      </div>
    </div>
  );
};

export default ResourceHub;
