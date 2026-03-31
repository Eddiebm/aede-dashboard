CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`audience` text,
	`tone` text,
	`url` varchar(256),
	`schedule` varchar(64),
	`accentColor` varchar(32),
	`active` boolean NOT NULL DEFAULT true,
	`cta` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_brandId_unique` UNIQUE(`brandId`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`postsGenerated` int DEFAULT 0,
	`postsApproved` int DEFAULT 0,
	`postsPublished` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `pipeline_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`variantType` enum('original','hot_take','thread','hook') NOT NULL DEFAULT 'original',
	`score` float,
	`status` enum('pending','approved','rejected','published') NOT NULL DEFAULT 'pending',
	`platforms` json,
	`publishedAt` timestamp,
	`impressions` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`reposts` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
