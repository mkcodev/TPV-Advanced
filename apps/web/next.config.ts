import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Next.js runs with cwd=apps/web, so ../../.env resolves to the monorepo root.
// override:false preserves vars already set by the shell/Vercel.
loadDotenv({ path: '../../.env', override: false });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
