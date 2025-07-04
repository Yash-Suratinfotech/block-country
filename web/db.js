// web/db.js
import dotenv from "dotenv";
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

// const DATABASE_URL =  process.env.DATABASE_URL;
const DATABASE_URL =  'postgresql://neondb_owner:npg_aMOn7HEc9qfi@ep-snowy-band-a856xfqa-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL, // adjust as needed
});

export default {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};