import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Book,
  Megaphone,
  Calendar,
  Download,
  Star,
  Pin,
} from "lucide-react";
import api from "@/app/api/apislice";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_CONFIG = {
  guide: { icon: Book, label: "Guide", color: "bg-blue-100 text-blue-700" },
  announcement: { icon: Megaphone, label: "Announcement", color: "bg-orange-100 text-orange-700" },
  "event-recap": { icon: Calendar, label: "Event Recap", color: "bg-purple-100 text-purple-700" },
  download: { icon: Download, label: "Download", color: "bg-green-100 text-green-700" },
};

const fetchResources = async ({ page, limit }) => {
  const res = await api.get("/resources", { params: { page, limit } });
  return res.data;
};

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : "");

const StatusBadge = ({ status }) => {
  const styles = {
    Published: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100",
    Draft: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-50",
    Archived: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400",
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", styles[status] || styles.Draft)}>
      {status || "Draft"}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.guide;
  const IconComponent = config.icon;
  return (
    <Badge className={`${config.color} border-0`}>
      <IconComponent className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const ResourceTable = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page] = useState(1);
  const [limit] = useState(50);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-resources", { page, limit }],
    queryFn: () => fetchResources({ page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const resources = data?.data || [];

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/resources/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Resource deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      setIsDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete");
      setIsDialogOpen(false);
    },
  });

  const confirmDelete = (resource) => {
    setDeleteTarget(resource);
    setIsDialogOpen(true);
  };

  const handleEdit = (id) => {
    navigate(`/dashboard/resources/edit/${id}`);
  };

  const handleView = (id) => {
    navigate(`/resources/${id}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => {
      const haystack = [r.title, r.description, r.type, r.category, ...(r.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [resources, search]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resources</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Manage guides, announcements, event recaps, and downloads.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button
            className="dark:bg-orange-600"
            onClick={() => navigate("/dashboard/resources/new")}
          >
            <Plus className="h-4 w-4 mr-2" /> New Resource
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by title, type, or tag"
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
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Type</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Stats</th>
                <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-300">Created</th>
                <th className="text-right p-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Loading resources...
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-red-500">
                    Failed to load resources
                  </td>
                </tr>
              )}

              {!isLoading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No resources found.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filtered.map((resource) => (
                  <tr
                    key={resource._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {resource.coverImage ? (
                          <img
                            src={resource.coverImage}
                            alt=""
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-800" />
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            {resource.title}
                            {resource.isFeatured && <Star className="w-3 h-3 text-yellow-500" />}
                            {resource.isPinned && <Pin className="w-3 h-3 text-blue-500" />}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-300 truncate max-w-[300px]">
                            {resource.description?.slice(0, 80)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <TypeBadge type={resource.type} />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={resource.status} />
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {resource.views || 0}
                        </span>
                        {resource.type === "download" && (
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" /> {resource.downloads || 0}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">
                      {formatDate(resource.createdAt)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="View"
                          onClick={() => handleView(resource.slug || resource._id)}
                        >
                          <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Edit"
                          onClick={() => handleEdit(resource._id)}
                        >
                          <Edit2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Delete"
                          onClick={() => confirmDelete(resource)}
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

      {/* Delete Confirmation Dialog */}
      {isDialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Resource</h3>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close dialog"
              >
                ✕
              </button>
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

export default ResourceTable;
