-- AlterTable: permitir servicios sin catalogo (partidas personalizadas) y campos de cobro por horas
ALTER TABLE "ServicioCotizado" ALTER COLUMN "servicioCatalogoId" DROP NOT NULL;
ALTER TABLE "ServicioCotizado" ADD COLUMN "nombre" TEXT;
ALTER TABLE "ServicioCotizado" ADD COLUMN "esPersonalizado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServicioCotizado" ADD COLUMN "horas" DOUBLE PRECISION;
ALTER TABLE "ServicioCotizado" ADD COLUMN "tarifaHora" DOUBLE PRECISION;
