-- AlterEnum: дополнительные слоты CRM-ролей
ALTER TYPE "Role" ADD VALUE 'CRM_EXTRA_1';
ALTER TYPE "Role" ADD VALUE 'CRM_EXTRA_2';
ALTER TYPE "Role" ADD VALUE 'CRM_EXTRA_3';
ALTER TYPE "Role" ADD VALUE 'CRM_EXTRA_4';
ALTER TYPE "Role" ADD VALUE 'CRM_EXTRA_5';

-- CreateTable
CREATE TABLE "crm_provisioned_roles" (
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_provisioned_roles_pkey" PRIMARY KEY ("role")
);
