import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('planner_accounts',{userId:text('user_id').primaryKey(),revision:integer('revision').notNull().default(0),active:text('active')});
export const days = sqliteTable('planner_days',{userId:text('user_id').notNull(),date:text('date').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.date]})]);

export const profiles=sqliteTable('planner_profiles',{userId:text('user_id').primaryKey(),data:text('data').notNull()});
export const tasks=sqliteTable('planner_tasks',{userId:text('user_id').notNull(),id:text('id').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const drafts=sqliteTable('planner_drafts',{userId:text('user_id').notNull(),date:text('date').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.date]})]);

export const calendarConnections=sqliteTable('calendar_connections',{
 userId:text('user_id').primaryKey(),googleSub:text('google_sub').notNull(),email:text('email').notNull(),
 refreshToken:text('refresh_token'),calendarId:text('calendar_id'),startDate:text('start_date').notNull(),
 lastRevision:integer('last_revision').notNull().default(-1),lastWindow:text('last_window'),lastSyncedAt:integer('last_synced_at'),
 error:text('error'),retryAt:integer('retry_at').notNull().default(0),
 lockToken:text('lock_token'),lockUntil:integer('lock_until').notNull().default(0),
});
export const calendarEvents=sqliteTable('calendar_events',{
 userId:text('user_id').notNull(),localKey:text('local_key').notNull(),date:text('date').notNull(),
 eventId:text('event_id').notNull(),fingerprint:text('fingerprint').notNull(),
},t=>[primaryKey({columns:[t.userId,t.localKey]})]);
export const calendarOauth=sqliteTable('calendar_oauth',{
 userId:text('user_id').primaryKey(),stateHash:text('state_hash').notNull(),verifier:text('verifier').notNull(),
 browserHash:text('browser_hash').notNull(),expiresAt:integer('expires_at').notNull(),
});
