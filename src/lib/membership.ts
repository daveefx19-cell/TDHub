import type { Membership } from '@/types/database';

type MembershipLike = Pick<Membership, 'status' | 'expires_at'>;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function isMembershipActive(membership: MembershipLike, now = Date.now()): boolean {
  return membership.status === 'active' && new Date(membership.expires_at).getTime() > now;
}

export function findLatestActive<T extends MembershipLike>(memberships: T[], now = Date.now()): T | null {
  let latest: T | null = null;
  for (const membership of memberships) {
    if (!isMembershipActive(membership, now)) continue;
    if (!latest || new Date(membership.expires_at) > new Date(latest.expires_at)) {
      latest = membership;
    }
  }
  return latest;
}

export function indexLatestActiveByUser<T extends MembershipLike & { user_id: string }>(
  memberships: T[],
  now = Date.now()
): Map<string, T> {
  const byUser = new Map<string, T>();
  for (const membership of memberships) {
    if (!isMembershipActive(membership, now)) continue;
    const current = byUser.get(membership.user_id);
    if (!current || new Date(membership.expires_at) > new Date(current.expires_at)) {
      byUser.set(membership.user_id, membership);
    }
  }
  return byUser;
}

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / MS_PER_DAY));
}
