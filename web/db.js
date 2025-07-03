// web/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite'; // simple async wrapper

// Open and export a singleton db connection
const dbPromise = open({
  filename: './database.sqlite',
  driver: sqlite3.Database
});

// Helper function for queries (returns all rows)
async function query(sql, params) {
  const db = await dbPromise;
  // If it's a SELECT, use all, otherwise run
  if (/^\s*select/i.test(sql)) {
    return db.all(sql, params);
  } else {
    return db.run(sql, params);
  }
}

// If you want to use transactions or get the db client:
async function getClient() {
  return await dbPromise;
}

export default {
  query,
  getClient
};
