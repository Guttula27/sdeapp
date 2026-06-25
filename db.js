const { Pool } = require('pg'); // Imports the native PostgreSQL Pool class from 'pg' package
const { PrismaPg } = require('@prisma/adapter-pg'); // Imports the Prisma PG adapter bridge
const { PrismaClient } = require('@prisma/client'); // Imports the PrismaClient generator class
require('dotenv').config(); // Loads the environment variables from the .env file

const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // Creates pg connection pool using DATABASE_URL
const adapter = new PrismaPg(pool); // Wraps the pg connection pool inside the Prisma PG adapter
const prisma = new PrismaClient({ adapter }); // Instantiates PrismaClient configured with our PG driver adapter

module.exports = prisma; // Exports the client instance to be used throughout the app
