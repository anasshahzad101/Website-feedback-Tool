-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'REVIEWER') NOT NULL DEFAULT 'REVIEWER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `api_token` VARCHAR(191) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_api_token_key`(`api_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_by_id` VARCHAR(191) NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `projects_client_id_idx`(`client_id`),
    INDEX `projects_status_idx`(`status`),
    UNIQUE INDEX `projects_client_id_slug_key`(`client_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `client_id` VARCHAR(191) NULL,
    `role_in_project` ENUM('MANAGER', 'REVIEWER', 'CLIENT') NOT NULL DEFAULT 'REVIEWER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_members_project_id_idx`(`project_id`),
    INDEX `project_members_user_id_idx`(`user_id`),
    INDEX `project_members_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_items` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('WEBSITE', 'IMAGE', 'PDF', 'VIDEO') NOT NULL,
    `source_url` VARCHAR(191) NULL,
    `uploaded_file_path` VARCHAR(191) NULL,
    `thumbnail_path` VARCHAR(191) NULL,
    `original_file_name` VARCHAR(191) NULL,
    `mime_type` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration_seconds` INTEGER NULL,
    `review_mode` ENUM('LIVE_URL', 'IFRAME_EMBED', 'SCREENSHOT_CAPTURE', 'UPLOADED_ASSET') NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `current_revision_id` VARCHAR(191) NULL,
    `is_public_share_enabled` BOOLEAN NOT NULL DEFAULT false,
    `public_share_token` VARCHAR(191) NULL,
    `guest_commenting_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `review_items_public_share_token_key`(`public_share_token`),
    INDEX `review_items_project_id_idx`(`project_id`),
    INDEX `review_items_type_idx`(`type`),
    INDEX `review_items_public_share_token_idx`(`public_share_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_revisions` (
    `id` VARCHAR(191) NOT NULL,
    `review_item_id` VARCHAR(191) NOT NULL,
    `revision_label` VARCHAR(191) NULL,
    `revision_date` DATETIME(3) NOT NULL,
    `uploaded_file_path` VARCHAR(191) NULL,
    `source_url` VARCHAR(191) NULL,
    `snapshot_path` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_revisions_review_item_id_idx`(`review_item_id`),
    INDEX `review_revisions_revision_date_idx`(`revision_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `annotations` (
    `id` VARCHAR(191) NOT NULL,
    `review_item_id` VARCHAR(191) NOT NULL,
    `review_revision_id` VARCHAR(191) NULL,
    `comment_thread_id` VARCHAR(191) NULL,
    `annotation_type` ENUM('PIN', 'RECTANGLE', 'ARROW', 'FREEHAND', 'TEXT') NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,
    `x_percent` DOUBLE NOT NULL,
    `y_percent` DOUBLE NOT NULL,
    `width` DOUBLE NULL,
    `height` DOUBLE NULL,
    `width_percent` DOUBLE NULL,
    `height_percent` DOUBLE NULL,
    `points_json` VARCHAR(191) NULL,
    `target_frame` INTEGER NULL,
    `target_timestamp_ms` INTEGER NULL,
    `viewport_meta_json` VARCHAR(191) NULL,
    `screenshot_context_path` VARCHAR(191) NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#3b82f6',
    `created_by_user_id` VARCHAR(191) NULL,
    `created_by_guest_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `annotations_review_item_id_idx`(`review_item_id`),
    INDEX `annotations_review_revision_id_idx`(`review_revision_id`),
    INDEX `annotations_comment_thread_id_idx`(`comment_thread_id`),
    INDEX `annotations_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `annotations_created_by_guest_id_idx`(`created_by_guest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_threads` (
    `id` VARCHAR(191) NOT NULL,
    `review_item_id` VARCHAR(191) NOT NULL,
    `review_revision_id` VARCHAR(191) NULL,
    `root_annotation_id` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'IGNORED') NOT NULL DEFAULT 'OPEN',
    `created_by_user_id` VARCHAR(191) NULL,
    `created_by_guest_id` VARCHAR(191) NULL,
    `assigned_to_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `comment_threads_root_annotation_id_key`(`root_annotation_id`),
    INDEX `comment_threads_review_item_id_idx`(`review_item_id`),
    INDEX `comment_threads_review_revision_id_idx`(`review_revision_id`),
    INDEX `comment_threads_status_idx`(`status`),
    INDEX `comment_threads_assigned_to_user_id_idx`(`assigned_to_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_messages` (
    `id` VARCHAR(191) NOT NULL,
    `thread_id` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `attachments` JSON NULL,
    `created_by_user_id` VARCHAR(191) NULL,
    `created_by_guest_id` VARCHAR(191) NULL,
    `is_system_message` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `comment_messages_thread_id_idx`(`thread_id`),
    INDEX `comment_messages_created_by_user_id_idx`(`created_by_user_id`),
    INDEX `comment_messages_created_by_guest_id_idx`(`created_by_guest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_identities` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `access_token` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `guest_identities_access_token_key`(`access_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `share_links` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `review_item_id` VARCHAR(191) NULL,
    `token` VARCHAR(191) NOT NULL,
    `allow_guest_comments` BOOLEAN NOT NULL DEFAULT true,
    `allow_guest_view` BOOLEAN NOT NULL DEFAULT true,
    `expires_at` DATETIME(3) NULL,
    `password_protected` BOOLEAN NOT NULL DEFAULT false,
    `password_hash` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `share_links_token_key`(`token`),
    INDEX `share_links_project_id_idx`(`project_id`),
    INDEX `share_links_review_item_id_idx`(`review_item_id`),
    INDEX `share_links_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `action_type` ENUM('CLIENT_CREATED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'REVIEW_ITEM_CREATED', 'REVIEW_ITEM_UPDATED', 'REVIEW_ITEM_ARCHIVED', 'REVIEW_REVISION_CREATED', 'COMMENT_THREAD_CREATED', 'COMMENT_REPLY_ADDED', 'STATUS_CHANGED', 'ANNOTATION_CREATED', 'ANNOTATION_UPDATED', 'ANNOTATION_DELETED', 'SHARE_LINK_CREATED', 'SHARE_LINK_REVOKED', 'GUEST_COMMENT_SUBMITTED', 'MEMBER_ASSIGNED', 'GUEST_COMMENTING_CHANGED', 'PASSWORD_RESET_REQUESTED') NOT NULL,
    `actor_user_id` VARCHAR(191) NULL,
    `actor_guest_id` VARCHAR(191) NULL,
    `meta_json` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `activity_logs_action_type_idx`(`action_type`),
    INDEX `activity_logs_actor_user_id_idx`(`actor_user_id`),
    INDEX `activity_logs_actor_guest_id_idx`(`actor_guest_id`),
    INDEX `activity_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `recipient_email` VARCHAR(191) NOT NULL,
    `recipient_user_id` VARCHAR(191) NULL,
    `type` ENUM('NEW_COMMENT', 'NEW_REPLY', 'STATUS_CHANGED', 'GUEST_COMMENT', 'REVIEW_ITEM_SHARED', 'CLIENT_INVITED', 'PASSWORD_RESET', 'ACCOUNT_SETUP') NOT NULL,
    `payload_json` VARCHAR(191) NOT NULL,
    `sent_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_notifications_recipient_user_id_idx`(`recipient_user_id`),
    INDEX `email_notifications_status_idx`(`status`),
    INDEX `email_notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_token_idx`(`token`),
    INDEX `password_reset_tokens_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_items` ADD CONSTRAINT `review_items_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_items` ADD CONSTRAINT `review_items_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_items` ADD CONSTRAINT `review_items_current_revision_id_fkey` FOREIGN KEY (`current_revision_id`) REFERENCES `review_revisions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `review_revisions` ADD CONSTRAINT `review_revisions_review_item_id_fkey` FOREIGN KEY (`review_item_id`) REFERENCES `review_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_revisions` ADD CONSTRAINT `review_revisions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_review_item_id_fkey` FOREIGN KEY (`review_item_id`) REFERENCES `review_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_review_revision_id_fkey` FOREIGN KEY (`review_revision_id`) REFERENCES `review_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annotations` ADD CONSTRAINT `annotations_created_by_guest_id_fkey` FOREIGN KEY (`created_by_guest_id`) REFERENCES `guest_identities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_review_item_id_fkey` FOREIGN KEY (`review_item_id`) REFERENCES `review_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_review_revision_id_fkey` FOREIGN KEY (`review_revision_id`) REFERENCES `review_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_root_annotation_id_fkey` FOREIGN KEY (`root_annotation_id`) REFERENCES `annotations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_created_by_guest_id_fkey` FOREIGN KEY (`created_by_guest_id`) REFERENCES `guest_identities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_threads` ADD CONSTRAINT `comment_threads_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_messages` ADD CONSTRAINT `comment_messages_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `comment_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_messages` ADD CONSTRAINT `comment_messages_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_messages` ADD CONSTRAINT `comment_messages_created_by_guest_id_fkey` FOREIGN KEY (`created_by_guest_id`) REFERENCES `guest_identities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_links` ADD CONSTRAINT `share_links_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_links` ADD CONSTRAINT `share_links_review_item_id_fkey` FOREIGN KEY (`review_item_id`) REFERENCES `review_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_links` ADD CONSTRAINT `share_links_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_guest_id_fkey` FOREIGN KEY (`actor_guest_id`) REFERENCES `guest_identities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_notifications` ADD CONSTRAINT `email_notifications_recipient_user_id_fkey` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


