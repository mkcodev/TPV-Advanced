import { router } from '../trpc';
import { authRouter } from './auth';
import { catalogRouter } from './catalog';
import { meRouter } from './me';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
