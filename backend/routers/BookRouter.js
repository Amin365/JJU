
import express from 'express'
import { createBook,getBooks,getBookById,bulkCreateBooks, updateBook, deleteBook } from '../controller/BookController.js';
import { protect } from '../middleware/auth.js';
 import { requireRole } from '../middleware/role.js';

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

BookRouter.post('/books',protect, upload.single('image'), createBook);
BookRouter.get('/books', getBooks)
BookRouter.get('/books/:id', getBookById)
BookRouter.put('/books/:id', protect, upload.single('image'), updateBook);
BookRouter.delete('/books/:id',deleteBook)

BookRouter.post("/books/bulk", protect, bulkCreateBooks);


export default BookRouter;