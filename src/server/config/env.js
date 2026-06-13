const { z } = require('zod');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('10000').transform(Number),
  ALLOWED_ORIGIN: z.string().optional(),
  CACHE_TTL: z.string().default('60').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().default('admin123'),
  USER_USER: z.string().default('user'),
  USER_PASS: z.string().default('user123'),
  API_SECRET: z.string().optional(),
  LIVE_URL: z.string().optional(),
  HISTORY_URL: z.string().optional(),
  // For sheets URL, Google Sheets ID could be required if that's the logic
  // The plan requested validation for GOOGLE_SHEET_ID but .env.example uses LIVE_URL and HISTORY_URL
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.format());
  process.exit(1);
}

module.exports = { env: _env.data };
