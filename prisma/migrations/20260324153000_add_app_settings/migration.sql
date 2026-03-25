-- CreateTable
CREATE TABLE `app_settings` (
    `id` VARCHAR(191) NOT NULL,
    `brand_name` VARCHAR(191) NOT NULL,
    `app_name` VARCHAR(191) NOT NULL,
    `logo_path` VARCHAR(500) NULL,
    `tagline` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
