const { defineConfig, env } = require('prisma/config'); // Imports the Prisma v7 configuration tools
require('dotenv').config(); // Loads your environment variables from the .env file

module.exports = defineConfig({
  schema: 'prisma/schema.prisma', // Tells Prisma where your schema file is located
  datasource: {
    url: env('DATABASE_URL') // Feeds the connection URL from .env to the Prisma CLI for migrations
  }
});
