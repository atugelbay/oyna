-- Таблица для RoleCustomLabel (раньше не попала в миграцию crm_extra_roles)
CREATE TABLE "role_custom_labels" (
    "role" "Role" NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_custom_labels_pkey" PRIMARY KEY ("role")
);
