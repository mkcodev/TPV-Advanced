import type { NavRole } from './nav-config';

const RANK: Record<NavRole, number> = { staff: 0, admin: 1, owner: 2 };

export function canSeeItem(userRole: NavRole, minRole: NavRole): boolean {
  return RANK[userRole] >= RANK[minRole];
}
