CREATE TABLE `calendar_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text,
	`calendar_id` text,
	`start_date` text NOT NULL,
	`last_revision` integer DEFAULT -1 NOT NULL,
	`last_window` text,
	`last_synced_at` integer,
	`error` text,
	`retry_at` integer DEFAULT 0 NOT NULL,
	`lock_token` text,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`user_id` text NOT NULL,
	`local_key` text NOT NULL,
	`date` text NOT NULL,
	`event_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	PRIMARY KEY(`user_id`, `local_key`)
);
--> statement-breakpoint
CREATE TABLE `calendar_oauth` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`browser_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
