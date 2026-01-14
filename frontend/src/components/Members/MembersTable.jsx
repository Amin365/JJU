import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search as SearchIcon,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import ImportExcelModal from "./ImportExcelModel";



const fetchMembers = async ({ queryKey }) => {
  const [, params] = queryKey;
  const { page = 1, limit = 10, searchTerm = "", region = "All", moderatorId } = params || {};
  if (moderatorId) {
    // fetch assigned members for a moderator (backend returns assignments or members)
    const res = await api.get(`/moderators/${moderatorId}/members`);
    let arr = res.data?.data ?? [];
    // If backend returned ModeratorMember entries with populated `member`, extract members
    if (arr.length > 0 && arr[0].member) {
      arr = arr.map((a) => a.member ?? a);
    }
    return { data: arr, total: arr.length, totalPages: Math.max(1, Math.ceil((arr.length || 0) / limit)) };
  }

  // Use the scoped members list endpoint which returns:
  // - all members for super admin
  // - assigned members for moderators
  // - the user's own member for regular users
  const res = await api.get("/members/list");
  return { data: res.data?.data ?? [], total: (res.data?.data ?? []).length, totalPages: 1 };
};





const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

const StatusPill = ({ status = "Active" }) => {
  const map = {
    Active: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800",
    Inactive: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-800",
  };
  const classes = map[status] ?? "bg-muted text-foreground border-border";
  return <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", classes)}>{status}</span>;
};

export default function MemberTable() {
  const navigate = useNavigate();

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // filters & UI
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRegion, setFilterRegion] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const urlModeratorId = urlParams.get("moderatorId");

  const authUser = useSelector((s) => s.auth.user);
  const userRoleName = (authUser?.role?.role || authUser?.role?.plural || "").toLowerCase();
  const userIsModerator = /moderator/i.test(userRoleName);
  const userIsSuperAdmin = /super\s*admin/i.test(userRoleName);

  // effective moderatorId: URL param takes precedence; otherwise, if current user is a moderator, scope to them
  const moderatorId = urlModeratorId || (userIsModerator ? authUser?._id : null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["members", { page: currentPage, limit, searchTerm, region: filterRegion, moderatorId }],
    queryFn: fetchMembers,
    keepPreviousData: true,
    staleTime: 30_000,
  });
  
 

  const members = data?.data ?? [];

  console.log("members",members)
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? (totalItems > 0 ? Math.ceil(totalItems / limit) : 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRegion, filterStatus]);

  const filteredMembers = useMemo(() => {
    if (filterStatus === "All") return members;
    return members.filter((m) => m.status === filterStatus);
  }, [members, filterStatus]);

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

  const[showmodelExcel,setModelExcell]=useState(false);

 const OpenModelExcel=()=>{
  setModelExcell(true);
 }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * limit, totalItems);

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-sm mt-1 text-muted-foreground">Manage club members and their profiles.</p>
        </div>

        <div className="flex gap-3">
          <Button variant="default" onClick={OpenModelExcel}>
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
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
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
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-foreground">{filteredMembers.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b z-10 bg-muted/60 border-border">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">Member</th>
                <th className="p-4 font-semibold text-muted-foreground">Code</th>
                <th className="p-4 font-semibold text-muted-foreground">Region</th>
                <th className="p-4 font-semibold text-muted-foreground">Joined</th>
                <th className="p-4 font-semibold text-muted-foreground">Status</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filteredMembers.map((m) => (
                <tr key={m._id ?? m.id} onClick={() => handleRowClick(m._id ?? m.id)} className="group cursor-pointer hover:bg-muted/50 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    {m.Profile_picture ? (
                      <Avatar className="w-10 h-10 rounded-md">
                        <AvatarImage src={m.Profile_picture} alt={m.first_name || "Profile"} />
                        <AvatarFallback>{(m.first_name?.[0] ?? "").toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className={cn("w-10 h-10 rounded-md flex items-center justify-center font-medium text-white shadow-sm bg-gradient-to-br from-orange-500 to-indigo-600")}> 
                        {(m.first_name?.[0] ?? "").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{m.first_name} {m.last_name}</div>
                      <div className="text-xs text-muted-foreground">{m.email || m.phone || "No contact"}</div>
                    </div>
                  </td>

                  <td className="p-4">{m.code}</td>
                  <td className="p-4">{m.region || "N/A"}</td>
                  <td className="p-4">{formatDate(m.join_date)}</td>

                  <td className="p-4">
                    <StatusPill status={m.status || "Active"} />
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end  group-hover:opacity-100 transition-opacity gap-2">
                      <span className="text-xs text-muted-foreground font-medium px-2">View Details</span>
                      <ArrowLeft className="rotate-180 text-muted-foreground" size={16} />
                    </div>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Loading members...</td></tr>
              )}

              {!isLoading && filteredMembers.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center p-4 border-t border-border bg-card">
          <p className="text-sm text-muted-foreground">
            {totalItems === 0 ? "Showing 0 results" : `Showing ${startItem} to ${endItem} of ${totalItems} results`}
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading || isFetching}>
              <ChevronLeft size={16} /> Previous
            </Button>

            <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground">
              {currentPage} / {totalPages}
            </span>

            <Button size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0 || isLoading || isFetching}>
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      <ImportExcelModal isOpen={showmodelExcel} onClose={()=>setModelExcell(false)}/>
    </div>
  );
}