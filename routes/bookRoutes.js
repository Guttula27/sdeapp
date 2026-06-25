// ==========================================
// Book Collection Routes (Prisma Version)
// ==========================================

const express = require('express');
const router = express.Router();
const prisma = require('../db'); // Imports the Prisma client from our db.js configuration file
const checkAuth = require('../middleware/checkAuth'); // Imports the JWT authentication verification middleware
const isAdmin = require('../middleware/isAdmin'); // Imports the Admin role verification middleware

router.get('/', async (req, res) => {
  try {
    const books = await prisma.book.findMany({
      include: {
        user: { select: { name: true } } // Left Joins user table to get the name of the user who added the book
      },
      orderBy: { createdAt: 'desc' } // Sorts the list by creation date/time descending
    });

    // We format the array to keep the exact same response layout as our old version
    const formattedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      created_at: book.createdAt,
      user_id: book.addedBy,
      added_by_name: book.user ? book.user.name : null
    }));

    return res.status(200).json({ message: 'Books retrieved successfully.', books: formattedBooks }); // Sends list of books
  } catch (error) {
    console.error('Get Books Error:', error); // Logs query error to server console
    return res.status(500).json({ error: 'Internal Server Error. Could not fetch books.' }); // Returns 500 status code
  }
});

router.post('/', checkAuth, async (req, res) => {
  const { title, author } = req.body; // Extracts book info from request body

  try {
    if (!title || !author) {
      return res.status(400).json({ error: 'Please provide both title and author for the book.' }); // Returns 400 if fields missing
    }

    const addedByUserId = req.user.id; // Retrieves user ID from req.user (attached by checkAuth middleware)

    const newBook = await prisma.book.create({
      data: { title, author, addedBy: addedByUserId } // Inserts new book record linked to logged-in user
    });

    return res.status(201).json({ message: 'Book added successfully!', book: newBook }); // Sends 201 Created and new book details
  } catch (error) {
    console.error('Add Book Error:', error); // Logs error details to server console
    return res.status(500).json({ error: 'Internal Server Error. Could not add book.' }); // Returns 500 error code
  }
});

router.delete('/:id', checkAuth, isAdmin, async (req, res) => {
  const bookId = parseInt(req.params.id); // Extracts book ID from URL parameter and parses to integer

  try {
    const deletedBook = await prisma.book.delete({
      where: { id: bookId } // Deletes the book matching the ID using Prisma
    });

    return res.status(200).json({ message: 'Book deleted successfully!', deletedBook }); // Sends 200 OK and deleted book record
  } catch (error) {
    console.error('Delete Book Error:', error); // Logs query error details to server console
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Book not found. No book deleted.' }); // Returns 404 if record not found in DB (code P2025)
    }
    return res.status(500).json({ error: 'Internal Server Error. Could not delete book.' }); // Returns 500 on unexpected errors
  }
});

module.exports = router;
