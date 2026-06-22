const { z } = require('zod');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('10000').transform(Number),
  ALLOWED_ORIGIN: z.string().optional(),
  CACHE_TTL: z.string().default('60').transform(Number),
  DATABASE_URL: z.string().default('mock'),
  JWT_SECRET: z.string().default('default_jwt_secret_change_me_in_production'),
  JWT_REFRESH_SECRET: z.string().default('default_jwt_refresh_secret_change_me_in_production'),
  ADMIN_USER: z.string().optional(),
  ADMIN_PASS: z.string().optional(),
  USER_USER: z.string().optional(),
  USER_PASS: z.string().optional(),
  API_SECRET: z.string().optional(),
  LIVE_URL: z.string().optional(),
  HISTORY_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.format());
  process.exit(1);
}

const env = _env.data;

const isProd = env.NODE_ENV === 'production';

// Configuration warning for unsafe defaults in production
if (isProd) {
  if (env.JWT_SECRET === 'default_jwt_secret_change_me_in_production') {
    console.warn('[CONFIG WARNING] JWT_SECRET uses unsafe default value in production!');
  }
  if (env.JWT_REFRESH_SECRET === 'default_jwt_refresh_secret_change_me_in_production') {
    console.warn('[CONFIG WARNING] JWT_REFRESH_SECRET uses unsafe default value in production!');
  }
  if (env.DATABASE_URL === 'mock' || !env.DATABASE_URL) {
    console.warn('[CONFIG WARNING] DATABASE_URL is set to mock or missing in production!');
  }
}

// Validate UPSTASH_REDIS_REST_URL format if provided
if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_URL !== 'mock') {
  try {
    new URL(env.UPSTASH_REDIS_REST_URL);
  } catch (err) {
    console.error('❌ Invalid UPSTASH_REDIS_REST_URL format:', env.UPSTASH_REDIS_REST_URL);
    process.exit(1);
  }
}

module.exports = { env };
