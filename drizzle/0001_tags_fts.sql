CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);
--> statement-breakpoint
CREATE TABLE `book_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE VIRTUAL TABLE `books_fts` USING fts5(`title`, `author`, `description`, `book_id` UNINDEXED);
--> statement-breakpoint
INSERT INTO `books_fts` (`title`, `author`, `description`, `book_id`) SELECT `title`, `author`, `description`, `id` FROM `books`;
--> statement-breakpoint
CREATE TRIGGER `books_ai` AFTER INSERT ON `books` BEGIN
	INSERT INTO `books_fts` (`title`, `author`, `description`, `book_id`) VALUES (new.`title`, new.`author`, new.`description`, new.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `books_ad` AFTER DELETE ON `books` BEGIN
	DELETE FROM `books_fts` WHERE `book_id` = old.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `books_au` AFTER UPDATE ON `books` BEGIN
	DELETE FROM `books_fts` WHERE `book_id` = old.`id`;
	INSERT INTO `books_fts` (`title`, `author`, `description`, `book_id`) VALUES (new.`title`, new.`author`, new.`description`, new.`id`);
END;
