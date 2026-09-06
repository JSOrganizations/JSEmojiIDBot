import { table, integer, text, boolean, sql } from 'sdk/db';

export const users = table('users', {
  userId:       integer('user_id').primaryKey(),
  firstName:    text('first_name').notNull(),
  username:     text('username'),
  languageCode: text('language_code'),
  isPremium:    boolean('is_premium').default(false),
  lastActive:   integer('last_active', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  createdAt:    integer('created_at',  { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
