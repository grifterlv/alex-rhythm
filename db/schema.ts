import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('planner_accounts',{userId:text('user_id').primaryKey(),revision:integer('revision').notNull().default(0),active:text('active')});
export const days = sqliteTable('planner_days',{userId:text('user_id').notNull(),date:text('date').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.date]})]);

export const profiles=sqliteTable('planner_profiles',{userId:text('user_id').primaryKey(),data:text('data').notNull()});
export const tasks=sqliteTable('planner_tasks',{userId:text('user_id').notNull(),id:text('id').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const drafts=sqliteTable('planner_drafts',{userId:text('user_id').notNull(),date:text('date').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.userId,t.date]})]);
