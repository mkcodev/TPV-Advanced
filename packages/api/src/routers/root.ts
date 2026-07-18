import { router } from '../trpc';
import { authRouter } from './auth';
import { catalogRouter } from './catalog';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
});

export type AppRouter = typeof appRouter;
