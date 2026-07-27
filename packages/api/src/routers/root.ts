import { router } from '../trpc';
import { authRouter } from './auth';
import { cashSessionRouter } from './cash-session';
import { catalogRouter } from './catalog';
import { floorRouter } from './floor';
import { meRouter } from './me';
import { ordersRouter } from './orders';

export const appRouter = router({
  auth: authRouter,
  cashSession: cashSessionRouter,
  catalog: catalogRouter,
  floor: floorRouter,
  me: meRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;
