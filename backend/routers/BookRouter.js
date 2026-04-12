
import express from 'express'
import { createBook,getBooks,getBookById,bulkCreateBooks, updateBook, deleteBook, updateBookCondition, getBookHistory } from '../controller/BookController.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { requirePermission } from '../middleware/role.js';
import { apiLimiter } from '../utility/rateLimiter.js';

const BookRouter= express.Router();

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from '../utility/cloudinary.js'

   
    const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Books", // folder in cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    public_id: (req, file) => Date.now() + "-" + file.originalname.split(".")[0],
  },
});

const upload = multer({ storage });

BookRouter.post('/books',protect, requirePermission(["Manage Books"]), upload.single('image'), createBook);
BookRouter.get('/books', getBooks)
BookRouter.get('/books/:id', getBookById)
BookRouter.put('/books/:id', protect, requirePermission(["Manage Books"]), upload.single('image'), updateBook);
BookRouter.delete('/books/:id', protect, requirePermission(["Manage Books"]), deleteBook)

BookRouter.post("/books/bulk", protect, requirePermission(["Manage Books"]), bulkCreateBooks);
BookRouter.patch("/books/:id/condition", apiLimiter, protect, requirePermission(["Manage Books"]), updateBookCondition);
BookRouter.get("/books/:id/history", apiLimiter, protect, requirePermission(["Manage Books", "Manage Issues", "View Members"]), getBookHistory);


export default BookRouter;