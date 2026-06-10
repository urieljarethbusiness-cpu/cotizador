"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  ChevronDown,
  ChevronRight,
  Check,
  Gift,
  DollarSign,
  User,
  Building,
  Mail,
  Phone,
  Package,
} from "lucide-react";
import clsx from "clsx";
import {
  formatCurrency,
  IVA_RATE,
  PLANES_BUCEFALO as PLANES,
  FASES as FASES_LABELS,
  calcularVigencia,
  generarNumeroCotizacion,
  bucefaloPrecio,
} from "@/lib/calculators";
import {
  useCotizacionStore,
  ServicioSeleccionado,
} from "@/lib/store";
import {
  ExportPDFButtonDraft,
  ExportExcelButtonDraft,
} from "@/components/ExportButtons";

export interface ServicioCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  fase: number;
  tipoPago: string;
  precioBase: number;
  tiempoEntrega: string;
  entregablesDefault: string[];
  categoriaNombre: string;
  variante: string | null;
  orden: number;
}

export interface Asesor {
  id: string;
  name: string;
  email: string;
}

export interface ExistingData {
  id: string;
  numero: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteEmail: string;
  clienteTelefono: string;
  asesorId: string;
  asesorNombre: string;
  fecha: Date;
  vigencia: Date;
  moneda: string;
  tipoCambio: string;
  proyecto: string;
  esquemaPago: string;
  incluirBonos: boolean;
  incluirFinanciamiento: boolean;
  observaciones: string;
  planBucefaloNivel: string | null;
  estado: string;
  servicios: ServicioSeleccionado[];
}

export interface PaqueteServicio {
  id: string;
  nombre: string;
  fase: number;
  tipoPago: string;
  precioBase: number;
  tiempoEntrega: string;
  entregablesDefault: string[];
}

export interface PaqueteFase {
  nombre: string;
  orden: number;
  servicios: PaqueteServicio[];
}

export interface PaquetePreview {
  id: string;
  nombre: string;
  fases: PaqueteFase[];
}

export interface CotizacionFormProps {
  mode: "new" | "edit";
  servicios: ServicioCatalogo[];
  asesores: Asesor[];
  nextSeq?: number;
  existingData?: ExistingData;
  paquetes?: PaquetePreview[];
}

const FASES = FASES_LABELS;

const INPUT_CLS =
  "w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const BTN_PRIMARY =
  "flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export function CotizacionForm({
  mode,
  servicios,
  asesores,
  nextSeq,
  existingData,
  paquetes,
}: CotizacionFormProps) {
  const router = useRouter();
  const store = useCotizacionStore();

  const [expandedFases, setExpandedFases] = useState<Set<number>>(
    new Set([0, 1, 2, 3])
  );
  const [expandedServicios, setExpandedServicios] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);
  const [selectedPaquete, setSelectedPaquete] = useState<string>("");

  useEffect(() => {
    if (mode === "edit" && existingData) {
      store.setField("clienteNombre", existingData.clienteNombre);
      store.setField("clienteEmpresa", existingData.clienteEmpresa);
      store.setField("clienteEmail", existingData.clienteEmail);
      store.setField("clienteTelefono", existingData.clienteTelefono);
      store.setField("asesorId", existingData.asesorId);
      store.setField("asesorNombre", existingData.asesorNombre);
      store.setField("fecha", new Date(existingData.fecha));
      store.setField("vigencia", new Date(existingData.vigencia));
      store.setField("moneda", existingData.moneda);
      store.setField("tipoCambio", existingData.tipoCambio);
      store.setField("proyecto", existingData.proyecto);
      store.setField("esquemaPago", existingData.esquemaPago);
      store.setField("incluirBonos", existingData.incluirBonos);
      store.setField("incluirFinanciamiento", existingData.incluirFinanciamiento);
      store.setField("observaciones", existingData.observaciones);
      store.setField("planBucefaloNivel", existingData.planBucefaloNivel);
      store.setServicios(existingData.servicios);
    }
  }, [mode, existingData]);

  const selectedIds = new Set(store.draft.servicios.map((s) => s.catalogoId));

  const toggleFase = (fase: number) => {
    setExpandedFases((prev) => {
      const next = new Set(prev);
      if (next.has(fase)) next.delete(fase);
      else next.add(fase);
      return next;
    });
  };

  const toggleServicioExpand = (id: string) => {
    setExpandedServicios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleServicio = (serv: ServicioCatalogo) => {
    if (selectedIds.has(serv.id)) {
      store.removeServicio(serv.id);
    } else {
      store.toggleServicio({
        catalogoId: serv.id,
        nombre: serv.nombre,
        fase: serv.fase,
        tipoPago: serv.tipoPago,
        precio: serv.precioBase,
        tiempoEntrega: serv.tiempoEntrega,
        entregables: serv.entregablesDefault,
      });
    }
  };

  const handlePrecioChange = (catalogoId: string, precio: number) => {
    store.updateServicio(catalogoId, { precio });
  };

  const buildRequestBody = () => ({
    ...(mode === "new" && {
      numero: generarNumeroCotizacion(
        (asesores.find((a) => a.id === store.draft.asesorId)?.name || "XX")
          .substring(0, 2)
          .toUpperCase(),
        nextSeq || 1
      ),
      asesorId: store.draft.asesorId,
    }),
    fecha: store.draft.fecha,
    vigencia:
      store.draft.vigencia ||
      calcularVigencia(new Date(store.draft.fecha)),
    moneda: store.draft.moneda,
    tipoCambio: store.draft.tipoCambio,
    proyecto: store.draft.proyecto,
    esquemaPago: store.draft.esquemaPago,
    incluirBonos: store.draft.incluirBonos,
    incluirFinanciamiento: store.draft.incluirFinanciamiento,
    observaciones: store.draft.observaciones,
    cliente: {
      nombre: store.draft.clienteNombre,
      empresa: store.draft.clienteEmpresa,
      email: store.draft.clienteEmail,
      telefono: store.draft.clienteTelefono,
    },
    servicios: store.draft.servicios,
    planBucefalo: store.draft.planBucefaloNivel
      ? {
          nivel: store.draft.planBucefaloNivel,
          precio: bucefaloPrecio(store.draft.planBucefaloNivel),
        }
      : null,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const url =
        mode === "edit" && existingData
          ? `/api/cotizaciones/${existingData.id}`
          : "/api/cotizaciones";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody()),
      });

      if (res.ok) {
        if (mode === "new") {
          const data = await res.json();
          router.push(`/cotizaciones/${data.id}`);
        } else {
          router.push(`/cotizaciones/${existingData!.id}`);
        }
      } else {
        const err = await res.json();
        alert("Error: " + (err.error || "No se pudo guardar"));
      }
    } catch {
      alert("Error al guardar la cotizacion");
    } finally {
      setSaving(false);
    }
  };

  const totalUnico = store.draft.servicios
    .filter((s) => s.tipoPago === "unico")
    .reduce((sum, s) => sum + s.precio, 0);
  const totalMensual = store.draft.servicios
    .filter((s) => s.tipoPago === "mensual")
    .reduce((sum, s) => sum + s.precio, 0);
  const ivaUnico = totalUnico * IVA_RATE;
  const ivaMensual = totalMensual * IVA_RATE;

  const fases = [0, 1, 2, 3];
  const serviciosPorFase = fases.reduce(
    (acc, fase) => {
      acc[fase] = servicios.filter((s) => s.fase === fase);
      return acc;
    },
    {} as Record<number, ServicioCatalogo[]>
  );

  const title =
    mode === "edit" && existingData
      ? `Editar ${existingData.numero}`
      : "Nueva Cotizacion";
  const canSave =
    !saving &&
    !!store.draft.clienteNombre &&
    (mode === "edit" || !!store.draft.asesorId);

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {mode === "edit" && (
              <p className="text-muted text-sm mt-1">
                Modifica los servicios y datos
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportPDFButtonDraft draft={store.draft} />
            <ExportExcelButtonDraft draft={store.draft} />
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={BTN_PRIMARY}
            >
              <Save className="w-4 h-4" />
              {saving
                ? "Guardando..."
                : mode === "edit"
                  ? "Guardar Cambios"
                  : "Guardar"}
            </button>
          </div>
        </div>

        <div className="bg-card-bg rounded-xl border border-border p-5 mb-6">
          <h2 className="font-semibold text-lg mb-4">Datos Generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Cliente *
              </label>
              <input
                type="text"
                value={store.draft.clienteNombre}
                onChange={(e) =>
                  store.setField("clienteNombre", e.target.value)
                }
                placeholder="Nombre del cliente"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                <Building className="w-3.5 h-3.5 inline mr-1" />
                Empresa
              </label>
              <input
                type="text"
                value={store.draft.clienteEmpresa}
                onChange={(e) =>
                  store.setField("clienteEmpresa", e.target.value)
                }
                placeholder="Nombre de la empresa"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={store.draft.clienteEmail}
                onChange={(e) =>
                  store.setField("clienteEmail", e.target.value)
                }
                placeholder="correo@ejemplo.com"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Telefono
              </label>
              <input
                type="tel"
                value={store.draft.clienteTelefono}
                onChange={(e) =>
                  store.setField("clienteTelefono", e.target.value)
                }
                placeholder="+52 614 123 4567"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Asesor Comercial *
              </label>
              <select
                value={store.draft.asesorId}
                onChange={(e) => {
                  const a = asesores.find((x) => x.id === e.target.value);
                  store.setField("asesorId", e.target.value);
                  if (a) store.setField("asesorNombre", a.name);
                }}
                className={INPUT_CLS}
              >
                <option value="">Seleccionar asesor</option>
                {asesores.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Moneda
              </label>
              <select
                value={store.draft.moneda}
                onChange={(e) => store.setField("moneda", e.target.value)}
                className={INPUT_CLS}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Tipo de Cambio
              </label>
              <input
                type="text"
                value={store.draft.tipoCambio}
                onChange={(e) =>
                  store.setField("tipoCambio", e.target.value)
                }
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Esquema de Pagos
              </label>
              <select
                value={store.draft.esquemaPago}
                onChange={(e) =>
                  store.setField("esquemaPago", e.target.value)
                }
                className={INPUT_CLS}
              >
                <option value="Pago Unico">Pago Unico</option>
                <option value="Mensual">Mensual</option>
                <option value="Pago Unico/Mensual">Pago Unico/Mensual</option>
              </select>
            </div>
          </div>
        </div>

        {mode === "new" && paquetes && paquetes.length > 0 && (
          <div className="bg-card-bg rounded-xl border border-border p-5 mb-6">
            <h2 className="font-semibold text-lg mb-3">
              Iniciar desde Paquete
            </h2>
            <div className="flex items-center gap-3">
              <select
                value={selectedPaquete}
                onChange={(e) => setSelectedPaquete(e.target.value)}
                className={`flex-1 ${INPUT_CLS} bg-white`}
              >
                <option value="">Seleccionar paquete...</option>
                {paquetes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (
                    {p.fases.reduce(
                      (sum, f) => sum + f.servicios.length,
                      0
                    )}{" "}
                    servicios)
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const pk = paquetes.find(
                    (p) => p.id === selectedPaquete
                  );
                  if (!pk) return;
                  const allServs: ServicioSeleccionado[] = [];
                  for (const fase of pk.fases) {
                    for (const s of fase.servicios) {
                      if (!allServs.find((x) => x.catalogoId === s.id)) {
                        allServs.push({
                          catalogoId: s.id,
                          nombre: s.nombre,
                          fase: s.fase,
                          tipoPago: s.tipoPago,
                          precio: s.precioBase,
                          tiempoEntrega: s.tiempoEntrega,
                          entregables: s.entregablesDefault,
                        });
                      }
                    }
                  }
                  store.setServicios(allServs);
                }}
                disabled={!selectedPaquete}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Package className="w-4 h-4" />
                Cargar servicios
              </button>
              {store.draft.servicios.length > 0 && (
                <button
                  onClick={() => {
                    store.setServicios([]);
                    setSelectedPaquete("");
                  }}
                  className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 text-muted"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}

        {fases.map((fase) => {
          const serviciosFase = serviciosPorFase[fase];
          if (!serviciosFase?.length) return null;
          const isExpanded = expandedFases.has(fase);
          return (
            <div
              key={fase}
              className="bg-card-bg rounded-xl border border-border mb-4"
            >
              <button
                onClick={() => toggleFase(fase)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted" />
                )}
                <h3 className="font-semibold">{FASES[fase]}</h3>
                <span className="text-xs text-muted ml-auto">
                  {
                    serviciosFase.filter((s) => selectedIds.has(s.id))
                      .length
                  }
                  /{serviciosFase.length} seleccionados
                </span>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 space-y-2">
                  {serviciosFase.map((serv) => {
                    const isSelected = selectedIds.has(serv.id);
                    const isExpandedServ = expandedServicios.has(
                      serv.id
                    );
                    const servicioData = store.draft.servicios.find(
                      (s) => s.catalogoId === serv.id
                    );
                    return (
                      <div
                        key={serv.id}
                        className={clsx(
                          "border rounded-lg transition-colors",
                          isSelected
                            ? "border-primary bg-primary-light/30"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            onClick={() => handleToggleServicio(serv)}
                            className={clsx(
                              "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "bg-primary border-primary text-white"
                                : "border-gray-300 hover:border-primary"
                            )}
                          >
                            {isSelected && (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {serv.nombre}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-muted">
                                {serv.categoriaNombre}
                              </span>
                              {serv.variante && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 rounded text-purple-700">
                                  {serv.variante}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                              <span>
                                {serv.tipoPago === "unico"
                                  ? "Pago Unico"
                                  : "Mensual"}
                              </span>
                              <span>{serv.tiempoEntrega}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-3.5 h-3.5 text-muted" />
                                <input
                                  type="number"
                                  value={
                                    servicioData?.precio ||
                                    serv.precioBase
                                  }
                                  onChange={(e) =>
                                    handlePrecioChange(
                                      serv.id,
                                      parseFloat(e.target.value) ||
                                        0
                                    )
                                  }
                                  className="w-24 px-2 py-1 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            )}
                            <button
                              onClick={() =>
                                toggleServicioExpand(serv.id)
                              }
                              className="text-xs text-muted hover:text-primary px-2 py-1"
                            >
                              {isExpandedServ ? "Ocultar" : "Ver"}
                            </button>
                          </div>
                          <span className="font-semibold text-sm w-24 text-right shrink-0">
                            {formatCurrency(
                              servicioData?.precio || serv.precioBase
                            )}
                          </span>
                        </div>
                        {isExpandedServ && (
                          <div className="px-4 pb-3 border-t border-border/50 mt-1 pt-3">
                            <p className="text-xs text-muted mb-2">
                              Entregables:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {(
                                servicioData?.entregables ||
                                serv.entregablesDefault
                              ).map((ent, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
                                  <span>{ent}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="bg-card-bg rounded-xl border border-border p-5 mb-4">
          <h3 className="font-semibold mb-3">
            Plan Bucefalo CRM (Opcional)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PLANES.map((plan) => (
              <button
                key={plan.nivel}
                onClick={() => {
                  if (
                    store.draft.planBucefaloNivel === plan.nivel
                  ) {
                    store.removeServicio(
                      "bucefalo-" + plan.nivel
                    );
                    store.setField("planBucefaloNivel", null);
                  } else {
                    store.setField(
                      "planBucefaloNivel",
                      plan.nivel
                    );
                    store.removeServicio(
                      "bucefalo-" + plan.nivel
                    );
                    store.toggleServicio({
                      catalogoId: "bucefalo-" + plan.nivel,
                      nombre: `Plan Bucefalo ${plan.label}`,
                      fase: 2,
                      tipoPago: "mensual",
                      precio: plan.precio,
                      tiempoEntrega: "Mensual",
                      entregables: [
                        "CRM completo segun plan contratado",
                      ],
                    });
                  }
                }}
                className={clsx(
                  "border rounded-lg p-3 text-center transition-colors",
                  store.draft.planBucefaloNivel === plan.nivel
                    ? "border-primary bg-primary-light/30"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="font-medium text-sm">
                  {plan.label}
                </div>
                <div className="text-lg font-bold mt-1">
                  {formatCurrency(plan.precio)}
                </div>
                <div className="text-xs text-muted">/mes</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card-bg rounded-xl border border-border p-5 mb-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={store.draft.incluirBonos}
                onChange={(e) =>
                  store.setField("incluirBonos", e.target.checked)
                }
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Gift className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium">
                Incluir Bonos (pago en exhibicion)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={store.draft.incluirFinanciamiento}
                onChange={(e) =>
                  store.setField(
                    "incluirFinanciamiento",
                    e.target.checked
                  )
                }
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">
                Incluir financiamiento Openpay
              </span>
            </label>
          </div>
        </div>

        <div className="bg-card-bg rounded-xl border border-border p-5">
          <label className="block text-sm font-medium text-muted mb-1">
            Observaciones
          </label>
          <textarea
            value={store.draft.observaciones}
            onChange={(e) =>
              store.setField("observaciones", e.target.value)
            }
            rows={3}
            placeholder="Notas adicionales para la cotizacion..."
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-8">
          <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-gray-50">
              <h3 className="font-semibold">Resumen</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Pago Unico
                </h4>
                {store.draft.servicios.filter(
                  (s) => s.tipoPago === "unico"
                ).length === 0 ? (
                  <p className="text-xs text-muted">Sin servicios</p>
                ) : (
                  <div className="space-y-1">
                    {store.draft.servicios
                      .filter((s) => s.tipoPago === "unico")
                      .map((s) => (
                        <div
                          key={s.catalogoId}
                          className="flex justify-between text-xs"
                        >
                          <span className="truncate mr-2">
                            {s.nombre}
                          </span>
                          <span className="shrink-0 font-medium">
                            {formatCurrency(s.precio)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal unico</span>
                  <span className="font-medium">
                    {formatCurrency(totalUnico)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>IVA (16%)</span>
                  <span>{formatCurrency(ivaUnico)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-border">
                  <span>Total Unico</span>
                  <span className="text-primary">
                    {formatCurrency(totalUnico + ivaUnico)}
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Pago Mensual
                </h4>
                {store.draft.servicios.filter(
                  (s) => s.tipoPago === "mensual"
                ).length === 0 ? (
                  <p className="text-xs text-muted">Sin servicios</p>
                ) : (
                  <div className="space-y-1">
                    {store.draft.servicios
                      .filter((s) => s.tipoPago === "mensual")
                      .map((s) => (
                        <div
                          key={s.catalogoId}
                          className="flex justify-between text-xs"
                        >
                          <span className="truncate mr-2">
                            {s.nombre}
                          </span>
                          <span className="shrink-0 font-medium">
                            {formatCurrency(s.precio)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal mensual</span>
                  <span className="font-medium">
                    {formatCurrency(totalMensual)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>IVA (16%)</span>
                  <span>{formatCurrency(ivaMensual)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-border">
                  <span>Total Mensual</span>
                  <span className="text-primary">
                    {formatCurrency(totalMensual + ivaMensual)}
                  </span>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted">
                  Todos los precios son en Moneda Nacional (MX), los
                  precios no incluyen IVA
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
