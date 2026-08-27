const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // requerido por Supabase
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres', err);
});

module.exports = { pool };
