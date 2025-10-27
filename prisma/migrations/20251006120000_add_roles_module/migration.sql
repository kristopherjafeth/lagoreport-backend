-- ALTER TABLE `User` ADD COLUMN `role` VARCHAR(191) NOT NULL; -- Comentado: columna ya existe

CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `permissions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_slug_key`(`slug`),
    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default roles required by existing users
INSERT INTO `Role` (`name`, `slug`, `description`)
VALUES
    ('Administrador', 'admin', 'Acceso completo al sistema'),
    ('Moderador', 'moderator', 'Puede gestionar recursos moderados'),
    ('Usuario', 'user', 'Acceso básico a la plataforma');

-- Ensure all users reference a known role slug
UPDATE `User`
SET `role` = 'user'
WHERE `role` IS NULL OR `role` NOT IN ('admin', 'moderator', 'user');

-- Add foreign key constraint linking users to roles
ALTER TABLE `User`
    ADD CONSTRAINT `User_role_fkey` FOREIGN KEY (`role`) REFERENCES `Role`(`slug`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional index to speed up role lookups
CREATE INDEX `User_role_idx` ON `User`(`role`);
