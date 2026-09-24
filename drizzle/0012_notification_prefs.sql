CREATE TABLE `notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`follow` integer NOT NULL DEFAULT 1,
	`like` integer NOT NULL DEFAULT 1,
	`comment` integer NOT NULL DEFAULT 1,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
