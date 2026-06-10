-- CreateIndex
CREATE INDEX "Cliente_nombre_empresa_idx" ON "Cliente"("nombre", "empresa");

-- CreateIndex
CREATE INDEX "Cotizacion_clienteId_idx" ON "Cotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "Cotizacion_asesorId_idx" ON "Cotizacion"("asesorId");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_createdAt_idx" ON "Cotizacion"("createdAt");

-- CreateIndex
CREATE INDEX "FasePaquete_paqueteId_idx" ON "FasePaquete"("paqueteId");

-- CreateIndex
CREATE INDEX "ServicioCatalogo_categoriaId_idx" ON "ServicioCatalogo"("categoriaId");

-- CreateIndex
CREATE INDEX "ServicioCatalogo_activo_fase_orden_idx" ON "ServicioCatalogo"("activo", "fase", "orden");

-- CreateIndex
CREATE INDEX "ServicioCotizado_cotizacionId_idx" ON "ServicioCotizado"("cotizacionId");

-- CreateIndex
CREATE INDEX "ServicioCotizado_servicioCatalogoId_idx" ON "ServicioCotizado"("servicioCatalogoId");

-- CreateIndex
CREATE INDEX "ServicioPaquete_fasePaqueteId_idx" ON "ServicioPaquete"("fasePaqueteId");
