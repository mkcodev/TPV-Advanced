import { router } from '../trpc';
import { authRouter } from './auth';
import { catalogRouter } from './catalog';
import { floorRouter } from './floor';
import { meRouter } from './me';
import { ordersRouter } from './orders';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  floor: floorRouter,
  me: meRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;
