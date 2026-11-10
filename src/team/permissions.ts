// Single source of truth for what each role may see and change in the app.
// Mirrors the Row Level Security policies in supabase/migrations (enforced on the server).
import type { SyncTable } from '../lib/types';

export type MemberRole = 'owner' | 'manager' | 'member' | 'accountant' | 'viewer';
export const INVITE_ROLES: MemberRole[] = ['manager', 'member', 'accountant', 'viewer'];

export type Area = 'events' | 'money' | 'bookings' | 'contacts' | 'studio' | 'contracts' | 'riders' | 'tasks' | 'team';

const READ: Record<Area, MemberRole[]> = {
  events: ['owner', 'manager', 'member', 'accountant', 'viewer'],
  money: ['owner', 'manager', 'accountant'],
  bookings: ['owner', 'manager'],
  contacts: ['owner', 'manager', 'member', 'accountant', 'viewer'],
  studio: ['owner', 'manager', 'member', 'accountant', 'viewer'],
  contracts: ['owner', 'manager', 'accountant'],
  riders: ['owner', 'manager', 'member', 'accountant', 'viewer'],
  tasks: ['owner', 'manager', 'member', 'accountant', 'viewer'],
  team: ['owner', 'manager', 'member', 'accountant', 'viewer'],
};

const WRITE: Record<Area, MemberRole[]> = {
  events: ['owner', 'manager'],
  money: ['owner', 'manager', 'accountant'],
  bookings: ['owner', 'manager'],
  contacts: ['owner', 'manager'],
  studio: ['owner', 'manager'],
  contracts: ['owner', 'manager'],
  riders: ['owner', 'manager'],
  tasks: ['owner', 'manager'],
  team: ['owner'],
};

export function canRead(role: MemberRole, area: Area): boolean {
  return READ[area].includes(role);
}
export function canWrite(role: MemberRole, area: Area): boolean {
  return WRITE[area].includes(role);
}

export const TABLE_AREA: Record<SyncTable, Area> = {
  events: 'events',
  money_records: 'money',
  booking_requests: 'bookings',
  contacts: 'contacts',
  songs: 'studio',
  setlists: 'studio',
  contracts: 'contracts',
  riders: 'riders',
  tasks: 'tasks',
};

/** Tables this role should push in full. Tasks are special: assignees push only their own done flag. */
export function pushableTables(role: MemberRole, tables: SyncTable[]): SyncTable[] {
  return tables.filter((t) => canWrite(role, TABLE_AREA[t]));
}
export function readableTables(role: MemberRole, tables: SyncTable[]): SyncTable[] {
  return tables.filter((t) => canRead(role, TABLE_AREA[t]));
}

/** Without a cloud workspace the phone owner is the artist: full access. */
export function effectiveRole(cloudRole: MemberRole | null | undefined, workspaceId: string | null): MemberRole {
  return workspaceId && cloudRole ? cloudRole : 'owner';
}
