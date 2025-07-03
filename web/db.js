// web/db.js
import dotenv from "dotenv";
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

// const DATABASE_URL =  process.env.DATABASE_URL;
const DATABASE_URL =  'postgresql://postgres:I5KNsANROUBfkDWQ@db.iygbzliuvagbjvbrhcka.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL, // adjust as needed
});

export default {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};