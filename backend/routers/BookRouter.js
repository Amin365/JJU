
import express from 'express'
import { createBook,getBooks,getBookById, updateBook, deleteBook } from '../controller/BookController.js';
import { protect } from '../middleware/auth.js';

const BookRouter= express.Router();



BookRouter.post('/books',protect,createBook);
BookRouter.get('/books', getBooks)
BookRouter.get('/books/:id', getBookById)
BookRouter.put('/books/:id',updateBook)
BookRouter.delete('/books/:id',deleteBook)




export default BookRouter;