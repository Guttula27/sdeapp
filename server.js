const express = require('express'); // Web framework to handle HTTP requests and routing
require('dotenv').config(); // Loads environment variables from the .env file

const authRoutes = require('./routes/authRoutes'); // Router for login/register endpoints
const bookRoutes = require('./routes/bookRoutes'); // Router for book CRUD endpoints
const morgan = require('morgan'); // Logger middleware for HTTP request details

const app = express(); // Instantiates the Express application

app.use(express.json()); // Global middleware to parse JSON request bodies
app.use(morgan('dev')); // Global middleware to log HTTP requests to console in dev format

app.use('/api/auth', authRoutes); // Mounts authentication routes under /api/auth
app.use('/api/books', bookRoutes); // Mounts book routes under /api/books

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Welcome to the Book Collection REST API! (Prisma Version)' }); // Welcome route
});

const PORT = process.env.PORT || 5000; // Reads port from env, defaults to 5000

app.listen(PORT, () => {
  console.log(`[SUCCESS] Express server is running on port ${PORT}`); // Logs success startup
  console.log(`[INFO] Public base URL: http://localhost:${PORT}`); // Logs connection endpoint URL
});
