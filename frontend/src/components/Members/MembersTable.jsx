import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search as SearchIcon,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import ImportExcelModal from "./BulkCreating";



const fetchMembers = async ({ queryKey }) => {
  const [, page = 1, limit = 10] = queryKey;
  const res = await api.get("/members", { params: { page, limit } });
  return res.data;
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

const StatusPill = ({ status = "Active" }) => {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Inactive: "bg-red-50 text-red-700 border-red-200",
  };
  const classes = map[status] ?? "bg-slate-100 text-slate-800 border-slate-200";
  return <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", classes)}>{status}</span>;
};

export default function MemberTable() {
  const navigate = useNavigate();

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // filters & UI
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRegion, setFilterRegion] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["members", currentPage, limit],
    queryFn: fetchMembers,
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const members = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? (totalItems > 0 ? Math.ceil(totalItems / limit) : 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRegion, filterStatus, limit]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.first_name && m.first_name.toLowerCase().includes(q)) ||
        (m.middle_name && m.middle_name.toLowerCase().includes(q)) ||
        (m.last_name && m.last_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q));
      const matchesRegion = filterRegion === "All" || (m.region === filterRegion);
      const matchesStatus = filterStatus === "All" || (m.status === filterStatus);
      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [members, searchTerm, filterRegion, filterStatus]);

  const regions = useMemo(() => ["All", ...Array.from(new Set(members.map((m) => m.region).filter(Boolean)))], [members]);
  const statuses = useMemo(() => ["All", ...Array.from(new Set(members.map((m) => m.status).filter(Boolean)))], [members]);

  const handleRowClick = (id) => {
    navigate(`/dashboard/members/${id}`);
  };

  const handleAddNew = () => {
    navigate("/dashboard/members/new");
  };

  const handlePageChange = (newPage) => {
    if (!isLoading && !isFetching && newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * limit, totalItems);

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Members</h1>
          <p className="text-sm mt-1 text-slate-500">Manage club members and their profiles.</p>
        </div>

        <div className="flex gap-3">
          <Button variant="default" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet size={16} /> <span className="ml-2">Import Excel</span>
          </Button>
          <Button onClick={handleAddNew}>
            <Plus size={16} /> <span className="ml-2">Add Member</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-3 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Search by name, email or code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Select onValueChange={(v) => setFilterRegion(v)} value={filterRegion}>
              <SelectTrigger>
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => <SelectItem key={r} value={r}>{r === "All" ? "All Regions" : r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select onValueChange={(v) => setFilterStatus(v)} value={filterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4 flex justify-end">
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-800">{filteredMembers.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="flex-1 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b z-10 bg-slate-50 border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-500">Member</th>
                <th className="p-4 font-semibold text-slate-500">Code</th>
                <th className="p-4 font-semibold text-slate-500">Region</th>
                <th className="p-4 font-semibold text-slate-500">Joined</th>
                <th className="p-4 font-semibold text-slate-500">Status</th>
                <th className="p-4 font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((m) => (
                <tr key={m._id ?? m.id} onClick={() => handleRowClick(m._id ?? m.id)} className="group cursor-pointer hover:bg-slate-50 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-indigo-600 text-white">
                        {(m.first_name?.[0] ?? "M") + (m.last_name?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-slate-800">{m.first_name} {m.last_name}</div>
                      <div className="text-xs text-slate-500">{m.email || m.phone || "No contact"}</div>
                    </div>
                  </td>

                  <td className="p-4 text-slate-700">{m.code}</td>
                  <td className="p-4 text-slate-700">{m.region || "N/A"}</td>
                  <td className="p-4 text-slate-700">{formatDate(m.join_date)}</td>

                  <td className="p-4">
                    <StatusPill status={m.status || "Active"} />
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end  group-hover:opacity-100 transition-opacity gap-2">
                      <span className="text-xs text-slate-400 font-medium px-2">View Details</span>
                      <ArrowLeft className="rotate-180 text-slate-300" size={16} />
                    </div>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Loading members...</td></tr>
              )}

              {!isLoading && filteredMembers.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-white">
          <p className="text-sm text-slate-500">
            {totalItems === 0 ? "Showing 0 results" : `Showing ${startItem} to ${endItem} of ${totalItems} results`}
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading || isFetching}>
              <ChevronLeft size={16} /> Previous
            </Button>

            <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-orange-100 text-orange-600">
              {currentPage} / {totalPages}
            </span>

            <Button size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0 || isLoading || isFetching}>
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* <ImportExcelModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} refreshTable={refetch} /> */}
    </div>
  );
}