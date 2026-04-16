CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`media_source` enum('generated','uploaded','edited') NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `publish_log` ADD `content` text;