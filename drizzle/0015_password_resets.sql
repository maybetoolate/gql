CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_hash_unique` ON `password_resets` (`token_hash`);
