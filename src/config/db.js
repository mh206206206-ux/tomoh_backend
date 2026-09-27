import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
	client.query('SET search_path TO tomoh');
	console.log('connected to postgre SQL');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
