import { router } from '../trpc';
import { authRouter } from './auth';
import { catalogRouter } from './catalog';
import { meRouter } from './me';
import { ordersRouter } from './orders';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  me: meRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;
