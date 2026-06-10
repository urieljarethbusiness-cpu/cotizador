-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'asesor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigencia" TIMESTAMP(3) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "tipoCambio" TEXT NOT NULL DEFAULT 'NA',
    "proyecto" TEXT NOT NULL DEFAULT 'MKT Digital',
    "esquemaPago" TEXT NOT NULL DEFAULT 'Pago Unico/Mensual',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "incluirBonos" BOOLEAN NOT NULL DEFAULT false,
    "incluirFinanciamiento" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "clienteId" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioCatalogo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "fase" INTEGER NOT NULL DEFAULT 1,
    "tipoPago" TEXT NOT NULL DEFAULT 'unico',
    "precioBase" DOUBLE PRECISION NOT NULL,
    "tiempoEntrega" TEXT NOT NULL DEFAULT '4 - 10 dias',
    "entregablesDefault" JSONB NOT NULL DEFAULT '[]',
    "categoria" TEXT NOT NULL DEFAULT 'otros',
    "variante" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicioCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioCotizado" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "servicioCatalogoId" TEXT NOT NULL,
    "fase" INTEGER NOT NULL,
    "tipoPago" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "tiempoEntrega" TEXT NOT NULL,
    "entregables" JSONB NOT NULL DEFAULT '[]',
    "notas" TEXT,
    "seleccionado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicioCotizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanBucefaloCotizacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'basico',
    "precio" DOUBLE PRECISION NOT NULL,
    "seleccionado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanBucefaloCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bono" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bono_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanciamientoPlan" (
    "id" TEXT NOT NULL,
    "meses" INTEGER NOT NULL,
    "tasa" DOUBLE PRECISION NOT NULL,
    "comision" DOUBLE PRECISION NOT NULL,
    "montoMinimo" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0.16,

    CONSTRAINT "FinanciamientoPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_numero_key" ON "Cotizacion"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "PlanBucefaloCotizacion_cotizacionId_key" ON "PlanBucefaloCotizacion"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "Configuracion"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "FinanciamientoPlan_meses_key" ON "FinanciamientoPlan"("meses");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioCotizado" ADD CONSTRAINT "ServicioCotizado_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioCotizado" ADD CONSTRAINT "ServicioCotizado_servicioCatalogoId_fkey" FOREIGN KEY ("servicioCatalogoId") REFERENCES "ServicioCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanBucefaloCotizacion" ADD CONSTRAINT "PlanBucefaloCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
