// ==========================================
// Authentication Routes (Prisma Version)
// ==========================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../db'); // Imports the Prisma client from our db.js configuration file
require('dotenv').config();

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body; // Extracts credentials sent in the request body

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password.' }); // Returns 400 if fields missing
    }

    let userRole = 'user'; // Defaults user role to "user"
    if (role) {
      if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ error: "Role must be 'user' or 'admin'." }); // Returns 400 if invalid role sent
      }
      userRole = role; // Sets custom role if valid
    }

    const saltRounds = 10; // Hashing cost factor
    const hashedPassword = await bcrypt.hash(password, saltRounds); // Hashes password before DB insertion

    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: userRole }, // Inserts new user record
      select: { id: true, name: true, email: true, role: true, createdAt: true } // Selects safe columns to return (no password)
    });

    return res.status(201).json({ message: 'User registered successfully!', user: newUser }); // Sends success response
  } catch (error) {
    console.error('Registration Error:', error); // Logs error details to server console
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this email already exists.' }); // Returns 409 if unique email violated (code P2002)
    }
    return res.status(500).json({ error: 'Internal Server Error. Registration failed.' }); // Returns 500 on unexpected errors
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body; // Extracts email and password from login request body

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' }); // Returns 400 if input incomplete
    }

    const user = await prisma.user.findUnique({
      where: { email: email } // Queries database for matching unique email using Prisma
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' }); // Returns 401 if user not found (security reasons)
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password); // Compares input password with hashed db password

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' }); // Returns 401 if password check fails
    }

    const payload = { id: user.id, email: user.email, role: user.role }; // Defines token payload
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h' // Signs JWT token with secret key and expiration limit
    });

    return res.status(200).json({ message: 'Login successful!', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }); // Returns token and user details
  } catch (error) {
    console.error('Login Error:', error); // Logs error to server console
    return res.status(500).json({ error: 'Internal Server Error. Login failed.' }); // Returns 500 error response
  }
});

module.exports = router;
