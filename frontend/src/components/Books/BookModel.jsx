import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api/apislice";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function BookModal({ isOpen, onClose, onSuccess, initialData = null, mode: inputMode = null }) {
  const qc = useQueryClient();
  const mode = inputMode || (initialData ? "edit" : "create");

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      BookType: "",
      status: "available",
      book_picture: "",
      totalPages: "",
      availableCopies: "",
    },
  });

  // reset form when initialData or open state changes
  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title ?? "",
        author: initialData.author ?? "",
        isbn: initialData.isbn ?? "",
        BookType: initialData.BookType ?? "",
        status: initialData.status ?? "available",
        book_picture: initialData.book_picture ?? "",
        totalPages: initialData.totalPages ?? "",
        availableCopies: initialData.availableCopies ?? "",
      });
    } else {
      reset({
        title: "",
        author: "",
        isbn: "",
        BookType: "",
      
        status: "available",
        book_picture: "",
        totalPages: "",
        availableCopies: "",
      });
    }
  }, [initialData, isOpen, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/books", payload);
      // controller returns { data: book } or book — normalize below
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      toast.success("Book created");
      qc.invalidateQueries({ queryKey: ["books"] });
      onSuccess && onSuccess(data);
      onClose && onClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to create book";
      toast.error(msg);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/books/${id}`, payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data) => {
      toast.success("Book updated");
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["book", data._id ?? data.id] });
      onSuccess && onSuccess(data);
      onClose && onClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Failed to update book";
      toast.error(msg);
    },
  });

  const onSubmit = (values) => {
   
    const payload = {
      title: values.title || undefined,
      author: values.author || undefined,
      isbn: values.isbn || undefined,
      BookType: values.BookType || undefined,
      status: values.status || undefined,
      book_picture: values.book_picture || undefined,
      totalPages: values.totalPages !== undefined ? Number(values.totalPages) : undefined,
      availableCopies: values.availableCopies !== undefined ? Number(values.availableCopies) : undefined,
    };

    if (mode === "edit" && initialData && (initialData._id )) {
      updateMutation.mutate({ id: initialData._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const loading = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Book" : "Register New Book"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="mb-3">
            <Label htmlFor="title" className="block mb-1">Title</Label>
            <Input id="title" {...register("title", { required: "Title is required" })} />
            {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>}
          </div>

          <div className="mb-3">
            <Label htmlFor="author" className="block mb-1">Author</Label>
            <Input id="author" {...register("author")} />
          </div>

          <div className="mb-3">
            <Label htmlFor="totalPages" className="block mb-1">Total Pages </Label>
            <Input id="totalPages" {...register("totalPages")} />
          </div>

          <div className="mb-3">
            <Label htmlFor="BookType" className="block mb-1">Book Type</Label>
            <Input id="BookType" {...register("BookType")} placeholder="e.g. Fiction, Non-fiction" />
          </div>

          <div className="mb-3">
            <Label htmlFor="publishedDate" className="block mb-1">Available Copies</Label>
            <Input id="availableCopies" {...register("availableCopies")} />
          </div>

          <div className="mb-3">
            <Label htmlFor="status" className="block mb-1">Status</Label>
            <Controller
              name="status"
              control={control}
              defaultValue="available"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">available</SelectItem>
                    <SelectItem value="borrowed">borrowed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="mb-3">
            <Label htmlFor="book_picture" className="block mb-1">Book Picture URL</Label>
            <Input id="book_picture" {...register("book_picture")} placeholder="https://..." />
            { /* optional preview */ }
            { /* If you want preview: show <img src={watch('book_picture')} /> */ }
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { reset(); onClose && onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={loading || isSubmitting}>
              {loading ? (mode === "edit" ? "Updating..." : "Registering...") : (mode === "edit" ? "Update Book" : "Register Book")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}