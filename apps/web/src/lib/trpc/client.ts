import type { AppRouter } from '@tpv/api';
import { createTRPCReact } from '@trpc/react-query';

// Anotación explícita requerida para evitar TS2742 (tipo no portable con .mjs interno).
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>();
