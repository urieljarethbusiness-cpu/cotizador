-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "esDoble" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "opcionesMetadata" JSONB;

-- AlterTable
ALTER TABLE "ServicioCotizado" ADD COLUMN     "opcion" TEXT;
