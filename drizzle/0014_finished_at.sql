ALTER TABLE `shelf_items` ADD `finished_at` integer;
--> statement-breakpoint
UPDATE `shelf_items` SET `finished_at` = `updated_at` WHERE `status` = 'finished';
--> statement-breakpoint
CREATE UNIQUE INDEX `book_tags_pair_unique` ON `book_tags` (`book_id`, `tag_id`);
