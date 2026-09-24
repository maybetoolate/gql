CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`type` text NOT NULL,
	`review_id` text,
	`comment_id` text,
	`book_id` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`comment_id`) REFERENCES `review_comments`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`, `created_at`);
