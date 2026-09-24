CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_pair_unique` ON `follows` (`follower_id`, `followee_id`);
