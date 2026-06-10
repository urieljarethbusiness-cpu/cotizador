-- AlterTable
ALTER TABLE "ServicioCatalogo" ADD COLUMN     "categoriaId" TEXT;

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FasePaquete" (
    "id" TEXT NOT NULL,
    "paqueteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FasePaquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioPaquete" (
    "id" TEXT NOT NULL,
    "servicioCatalogoId" TEXT NOT NULL,
    "fasePaqueteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicioPaquete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioPaquete_servicioCatalogoId_fasePaqueteId_key" ON "ServicioPaquete"("servicioCatalogoId", "fasePaqueteId");

-- AddForeignKey
ALTER TABLE "FasePaquete" ADD CONSTRAINT "FasePaquete_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioCatalogo" ADD CONSTRAINT "ServicioCatalogo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioPaquete" ADD CONSTRAINT "ServicioPaquete_servicioCatalogoId_fkey" FOREIGN KEY ("servicioCatalogoId") REFERENCES "ServicioCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioPaquete" ADD CONSTRAINT "ServicioPaquete_fasePaqueteId_fkey" FOREIGN KEY ("fasePaqueteId") REFERENCES "FasePaquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
