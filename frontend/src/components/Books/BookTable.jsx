import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, FileSpreadsheet, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NewBookModal from "./BookModel";

const fetchBooks = async ({ queryKey }) => {
  const [, page = 1, limit = 10] = queryKey;

  const res = await api.get("/books", { params: { page, limit } });
  return res.data;

};

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : "N/A");

const Badge = ({ status = "unknown" }) => {
  const map = {
    available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700",
    borrowed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700",
  };
  const classes = map[status] ?? "bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-gray-200 border-slate-200 dark:border-gray-600";
  return <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", classes)}>{status}</span>;
};

const BookTable = () => {
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewBookOpen, setIsNewBookOpen] = useState(false);

  
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["books", currentPage, limit],
    queryFn: fetchBooks,
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const books = data?.data ?? [];

  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? (totalItems > 0 ? Math.ceil(totalItems / limit) : 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, limit]);

  const filteredBooks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return books.filter((b) => {
      const matchesSearch =
        !q ||
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q)) ||
        (b.isbn && b.isbn.toLowerCase().includes(q));
      const matchesType = filterType === "All" || !filterType || (b.BookType === filterType);
      const matchesStatus = filterStatus === "All" || !filterStatus || (b.status === filterStatus);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [books, searchTerm, filterType, filterStatus]);

  const bookTypes = useMemo(() => ["All", ...Array.from(new Set(books.map((b) => b.BookType).filter(Boolean)))], [books]);
  const statusTypes = useMemo(() => ["All", ...Array.from(new Set(books.map((b) => b.status).filter(Boolean)))], [books]);

  const handleRowClick = (id) => navigate(`${id}`);

  const handlePageChange = (newPage) => {
    if (!isLoading && !isFetching && newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(currentPage * limit, totalItems);

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 p-4 dark:bg-gray-900 bg-slate-50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Books</h1>
          <p className="text-sm mt-1 text-slate-500 dark:text-gray-300">Manage books in the catalog.</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => setIsImportModalOpen(true)} variant="default">
            <FileSpreadsheet size={16} /> <span className="ml-2">Import Excel</span>
          </Button>
          <Button onClick={() => setIsNewBookOpen(true)}>
            <Plus size={16} /> <span className="ml-2">Register Book</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Search by title, author or ISBN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="md:col-span-3">
            <Select onValueChange={(v) => setFilterType(v)} value={filterType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {bookTypes.map((t) => <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select onValueChange={(v) => setFilterStatus(v)} value={filterStatus}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                {statusTypes.map((s) => <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1 flex justify-end">
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-white">{filteredBooks.length}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Book</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">ISBN</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Type</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Total Copies</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Borrowed</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Remaining</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white">Status</th>
                <th className="p-4 font-semibold text-slate-500 dark:text-white text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
              {filteredBooks.map((b) => (
                <tr key={b._id || b.id} onClick={() => handleRowClick(b._id || b.id)} className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-md flex items-center justify-center font-medium text-white shadow-sm", b.book_picture ? "bg-cover bg-center" : "bg-gradient-to-br from-orange-500 to-indigo-600")} style={b.book_picture ? { backgroundImage: `url(${b.book_picture})` } : undefined}>
                      {!b.book_picture && (b.title?.[0] ?? "")}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 dark:text-white">{b.title}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-300">{b.author}</div>
                    </div>
                  </td>

                  <td className="p-4 text-slate-700 dark:text-white">{b.isbn}</td>
                  <td className="p-4 text-slate-700 dark:text-white">{b.BookType ?? "—"}</td>
                  <td className="p-4 text-slate-700 dark:text-white">{b.totalCopies ?? 0}</td>
                  <td className="p-4 text-slate-700 dark:text-white">{b.borrowedCount ?? 0}</td>
                  <td className="p-4 text-slate-700 dark:text-white">{b.availableCopies}</td>
                  <td className="p-4"><Badge status={b.status} /></td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end  group-hover:opacity-100 transition-opacity gap-2">
                      <span className="text-xs text-slate-400 font-medium px-2">View Details</span>
                      <ArrowLeft className="rotate-180 text-slate-300" size={16} />
                    </div>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400 dark:text-gray-400">Loading books...</td></tr>
              )}

              {!isLoading && filteredBooks.length === 0 && (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400 dark:text-gray-400">No books found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {totalItems === 0 ? "Showing 0 results" : `Showing ${startItem} to ${endItem} of ${totalItems} results`}
          </p>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading || isFetching}>
              <ChevronLeft size={16} /> Previous
            </Button>

            <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-orange-100 dark:bg-orange-600 text-orange-600 dark:text-white">{currentPage} / {totalPages}</span>

            <Button size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0 || isLoading || isFetching}>
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* <ImportExcelModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} refreshTable={refetch} /> */}

      <NewBookModal isOpen={isNewBookOpen} onClose={() => setIsNewBookOpen(false)} onSuccess={() => { setIsNewBookOpen(false); refetch(); }} />
    </div>
  );
};

export default BookTable;