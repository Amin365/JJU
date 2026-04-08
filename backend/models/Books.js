import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const Counter = sequelize.define('Counter', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
  seq: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'counters', timestamps: false });

const Book = sequelize.define('Book', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  author: { type: DataTypes.STRING },
  isbn: { type: DataTypes.STRING, unique: true },
  BookType: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('available', 'borrowed', 'lost', 'damaged', 'archived'), defaultValue: 'available' },
  book_picture: { type: DataTypes.STRING },
  totalPages: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalCopies: { type: DataTypes.INTEGER, defaultValue: 1 },
  availableCopies: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { tableName: 'books', timestamps: true });

Book.addHook('beforeCreate', async (book) => {
  if (book.isbn) return;
  const prefix = 'ISBN';
  const padding = 4;
  const counterName = 'book_isbn';
  const [counter] = await Counter.findOrCreate({ where: { name: counterName }, defaults: { seq: 0 } });
  counter.seq = (counter.seq || 0) + 1;
  await counter.save();
  book.isbn = `${prefix}${String(counter.seq).padStart(padding, '0')}`;
});

export default Book;
