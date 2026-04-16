CREATE TABLE `approval_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` varchar(64) NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`platforms` json NOT NULL,
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`stripeCustomerId` varchar(128),
	`client_plan` enum('free','starter','pro') NOT NULL DEFAULT 'free',
	`planExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`clientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `platform_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`platform` enum('twitter','linkedin','bluesky','mastodon','threads','telegram','discord') NOT NULL,
	`credentials` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_cred_brand_platform` UNIQUE(`brandId`,`platform`)
);
--> statement-breakpoint
CREATE TABLE `publish_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` varchar(64) NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`platform` enum('twitter','linkedin','bluesky','mastodon','threads','telegram','discord') NOT NULL,
	`publish_status` enum('success','simulated','failed') NOT NULL,
	`postUrl` varchar(1024),
	`errorMessage` text,
	`simulated` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`impressions` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`reposts` int DEFAULT 0,
	`clicks` int DEFAULT 0,
	CONSTRAINT `publish_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`platforms` json NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`scheduled_post_status` enum('pending','processing','published','cancelled','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `brands` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `brands` ADD `requiresApproval` boolean DEFAULT false NOT NULL;