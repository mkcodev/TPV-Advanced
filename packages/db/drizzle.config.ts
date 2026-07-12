import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs from packages/db — resolve the root .env two levels up.
const rootEnv = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.env.local');
config({ path: rootEnv, override: false });

// Fallback to plain .env if .env.local is absent.
const rootEnvFallback = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.env');
config({ path: rootEnvFallback, override: false });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Add it to the root .env.local file.');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
});
