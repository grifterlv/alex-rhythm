CREATE TABLE `planner_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`active` text
);
--> statement-breakpoint
CREATE TABLE `planner_days` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
