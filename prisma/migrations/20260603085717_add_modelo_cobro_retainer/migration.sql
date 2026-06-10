-- DropForeignKey
ALTER TABLE "ServicioCotizado" DROP CONSTRAINT "ServicioCotizado_servicioCatalogoId_fkey";

-- AlterTable
ALTER TABLE "ServicioCotizado" ADD COLUMN     "horasIncluidas" DOUBLE PRECISION,
ADD COLUMN     "modeloCobro" TEXT NOT NULL DEFAULT 'fijo',
ADD COLUMN     "montoMinimo" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "ServicioCotizado" ADD CONSTRAINT "ServicioCotizado_servicioCatalogoId_fkey" FOREIGN KEY ("servicioCatalogoId") REFERENCES "ServicioCatalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
