ALTER TABLE `brands` ADD `frequency` enum('daily','weekly','monthly','off') DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `brands` ADD `postTime` varchar(8) DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `brands` ADD `postDays` json;