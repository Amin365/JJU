
import React, { useEffect, useMemo, useState } from "react"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/app/api/apislice"
import { cn } from "@/lib/utils"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

/* ================================
   API
================================ */
const fetchJoinClubs = async ({ queryKey }) => {
  const [, page = 1, limit = 10] = queryKey
  const res = await api.get("/join-club", { params: { page, limit } })
  return res.data
}

const formatDate = (dateStr) =>
  dateStr ? new Date(dateStr).toLocaleDateString() : "—"

/* ================================
   Status Badge
================================ */
const StatusBadge = ({ status }) => (
  <span
    className={cn(
      "px-2 py-1 rounded-md text-xs font-semibold",
      status === "Approved"
        ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-100"
        : status === "Rejected"
        ? "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-100"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-100"
    )}
  >
    {status}
  </span>
)

/* ================================
   Component
================================ */
const JoinClubsTable = () => {
  const queryClient = useQueryClient()

  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["join-clubs", currentPage, limit],
    queryFn: fetchJoinClubs,
    keepPreviousData: true,
    staleTime: 30_000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch(`/join-club/${id}/status`, { status })
      return res.data
    },
    onSuccess: () => {
      toast.success("Request status updated")
      queryClient.invalidateQueries({ queryKey: ["join-clubs"] })
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update status")
    },
  })

  const requests = data?.data ?? []
  const totalItems = data?.count ?? requests.length
  const totalPages =
    data?.totalPages ?? Math.max(1, Math.ceil(totalItems / limit))

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return requests

    return requests.filter((r) =>
      [r.FullName, r.email, r.phone].some((field) =>
        field?.toLowerCase().includes(q)
      )
    )
  }, [requests, searchTerm])

  const handleStatusChange = (id, status) => {
    updateStatusMutation.mutate({ id, status })
  }

  const startItem =
    totalItems === 0 ? 0 : (currentPage - 1) * limit + 1
  const endItem =
    totalItems === 0 ? 0 : Math.min(currentPage * limit, totalItems)

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 dark:bg-gray-900">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
          Join Club Requests
        </h1>
        <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">
          Review and manage reading club membership requests.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-11 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              className="pl-10"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-700">
              {filteredRequests.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900 border-b">
              <tr>
                <th className="p-4 font-semibold">Full Name</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Phone</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Requested At</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredRequests.map((r) => (
                <tr
                  key={r._id}
                  className="hover:bg-slate-50 dark:hover:bg-gray-800 transition"
                >
                  <td className="p-4 font-medium">{r.FullName}</td>
                  <td className="p-4">{r.email}</td>
                  <td className="p-4">{r.phone}</td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4">{formatDate(r.createdAt)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={r.status === "Approved"}
                        onClick={() =>
                          handleStatusChange(r._id, "Approved")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={r.status === "Rejected"}
                        onClick={() =>
                          handleStatusChange(r._id, "Rejected")
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    Loading requests...
                  </td>
                </tr>
              )}

              {!isLoading && filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    No join requests found.
                  </td>
                </tr>
              )}

              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-red-500">
                    Failed to load join requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t">
          <p className="text-sm text-muted-foreground hidden md:block">
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

            <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-muted">
              {currentPage} / {totalPages}
            </span>

            <Button
              size="sm"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={
                currentPage === totalPages ||
                isLoading ||
                isFetching
              }
              className="dark:bg-orange-600"
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default JoinClubsTable
