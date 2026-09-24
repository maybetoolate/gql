ALTER TABLE `shelf_items` ADD `progress` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `review_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_likes_user_review_unique` ON `review_likes` (`user_id`, `review_id`);
