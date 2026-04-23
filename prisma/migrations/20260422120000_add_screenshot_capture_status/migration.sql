-- AlterTable
ALTER TABLE `review_revisions` ADD COLUMN `screenshot_status` ENUM('PENDING', 'CAPTURING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `screenshot_captured_at` DATETIME(3) NULL,
    ADD COLUMN `screenshot_error` VARCHAR(191) NULL;

-- Rollback (manual): ALTER TABLE `review_revisions` DROP COLUMN `screenshot_error`, DROP COLUMN `screenshot_captured_at`, DROP COLUMN `screenshot_status`;
