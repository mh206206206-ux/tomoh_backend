import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // مطلوب لتشغيل SSL مع Neon
  },
  // هنا نحدد الـ Schema المطلوبة لتكون هي المسار الافتراضي
  options: '-c search_path=tomoh'
});

pool.on('connect', () => {
	console.log('connected to postgre SQL');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
