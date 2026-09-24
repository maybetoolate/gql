CREATE TABLE `review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`review_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
