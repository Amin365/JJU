import React, { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import api from "@/app/api/apislice";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const fetchJoinClubs = async ({ queryKey }) => {
  const [, page = 1, limit = 10, statusFilter = ""] = queryKey;
  const params = { page, limit };
  if (statusFilter) params.status = statusFilter;
  const res = await api.get("/join-club", { params });
  return res.data;
};

const formatDate = (dateStr) =>
  dateStr ? new Date(dateStr).toLocaleDateString() : "-";

const StatusBadge = ({ status }) => (
  <span
    className={cn(
      "rounded-md px-2 py-1 text-xs font-semibold",
      status === "Approved"
        ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-100"
        : status === "Rejected"
          ? "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-100"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-100"
    )}
  >
    {status}
  </span>
);

const JoinClubsTable = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["join-clubs", currentPage, limit, statusFilter],
    queryFn: fetchJoinClubs,
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const requests = useMemo(() => data?.data ?? [], [data?.data]);
  const totalItems = data?.count ?? requests.length;
  const totalPages =
    data?.totalPages ?? Math.max(1, Math.ceil(totalItems / limit));

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.FullName, r.email, r.phone].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [requests, searchTerm]);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * limit, totalItems);
  const statusTabs = ["", "Pending", "Approved", "Rejected"];

  const openDetails = (requestId) => {
    navigate(`/dashboard/join-clubs/${requestId}`);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-4 animate-in fade-in duration-500 dark:bg-gray-900">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
          Join Club Requests
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-300">
          Review and manage reading club membership requests.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => {
              setStatusFilter(s);
              setCurrentPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              statusFilter === s
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid grid-cols-12 items-center gap-4">
          <div className="relative col-span-11">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              className="pl-10"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium dark:bg-gray-700">
              {filteredRequests.length}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-slate-50 dark:bg-gray-900">
              <tr>
                <th className="p-4 font-semibold">Full Name</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Phone</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Requested At</th>
                <th className="p-4 font-semibold">Reviewed By</th>
                <th className="p-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => openDetails(request.id)}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-gray-800"
                >
                  <td className="p-4 font-medium">{request.FullName}</td>
                  <td className="p-4">{request.email}</td>
                  <td className="p-4">{request.phone}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={request.status} />
                      {request.rejectionReason && (
                        <span className="text-[11px] italic text-red-500">
                          {request.rejectionReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">{formatDate(request.createdAt)}</td>
                  <td className="p-4 text-xs text-slate-500">
                    {request.reviewedBy
                      ? `${request.reviewedBy.first_name || ""} ${request.reviewedBy.last_name || ""}`.trim() ||
                        request.reviewedBy.username
                      : "-"}
                    {request.reviewedAt && (
                      <div className="text-[10px] text-slate-400">
                        {formatDate(request.reviewedAt)}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetails(request.id);
                      }}
                      className="gap-1"
                    >
                      <Eye size={14} /> View
                    </Button>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    Loading requests...
                  </td>
                </tr>
              )}

              {!isLoading && filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No join requests found.
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-red-500">
                    Failed to load join requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t p-4">
          <p className="hidden text-sm text-muted-foreground md:block">
            {totalItems === 0
              ? "Showing 0 results"
              : `Showing ${startItem} to ${endItem} of ${totalItems} results`}
          </p>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading || isFetching}
              className="dark:bg-orange-600"
            >
              <ChevronLeft size={16} /> Previous
            </Button>

            <span className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
              {currentPage} / {totalPages}
            </span>

            <Button
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading || isFetching}
              className="dark:bg-orange-600"
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default JoinClubsTable;
