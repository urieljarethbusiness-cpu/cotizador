"use client";

import { useEffect, useMemo, useState } from "react";
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
  Clock,
  Plus,
  Trash2,
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
  calcularPrecioHoras,
  describirRetainer,
  calcularTotalesOpcion,
  TARIFA_HORA_DEFAULT,
} from "@/lib/calculators";
import type { MetaOpcion } from "@/lib/calculators";
import {
  useCotizacionStore,
  ServicioSeleccionado,
} from "@/lib/store";
import {
  ExportPDFButtonDraft,
  ExportExcelButtonDraft,
  PreviewPDFButtonDraft,
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
  esDoble?: boolean;
  opciones?: { "1"?: MetaOpcion; "2"?: MetaOpcion };
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
      store.setField("esDoble", existingData.esDoble ?? false);
      store.setField("opciones", existingData.opciones ?? {});
      store.setServicios(existingData.servicios);
    }
  }, [mode, existingData]);

  const esDoble = store.draft.esDoble;

  const selectedIds = useMemo(
    () => new Set(store.draft.servicios.map((s) => s.catalogoId)),
    [store.draft.servicios]
  );

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

  const handleAddCustom = () => {
    const id = `custom-${crypto.randomUUID()}`;
    store.toggleServicio({
      catalogoId: id,
      nombre: "",
      fase: 1,
      tipoPago: "unico",
      precio: calcularPrecioHoras(1, TARIFA_HORA_DEFAULT),
      tiempoEntrega: "A convenir",
      entregables: [],
      esPersonalizado: true,
      horas: 1,
      tarifaHora: TARIFA_HORA_DEFAULT,
    });
  };

  const handleCustomHoras = (catalogoId: string, horas: number) => {
    const s = store.draft.servicios.find((x) => x.catalogoId === catalogoId);
    store.updateServicio(catalogoId, {
      horas,
      precio: calcularPrecioHoras(horas, s?.tarifaHora ?? TARIFA_HORA_DEFAULT),
    });
  };

  const handleCustomTarifa = (catalogoId: string, tarifaHora: number) => {
    const s = store.draft.servicios.find((x) => x.catalogoId === catalogoId);
    store.updateServicio(catalogoId, {
      tarifaHora,
      precio: calcularPrecioHoras(s?.horas ?? 0, tarifaHora),
    });
  };

  const handleAddRetainer = () => {
    const id = `custom-${crypto.randomUUID()}`;
    store.toggleServicio({
      catalogoId: id,
      nombre: "",
      fase: 1,
      tipoPago: "mensual",
      precio: 0,
      tiempoEntrega: "Mensual",
      entregables: [],
      esPersonalizado: true,
      modeloCobro: "retainer",
      montoMinimo: 0,
      horasIncluidas: 40,
      tarifaHora: TARIFA_HORA_DEFAULT,
    });
  };

  // Cambia el modelo de cobro de una partida y recalcula su precio.
  const handleModeloChange = (catalogoId: string, modelo: string) => {
    const s = store.draft.servicios.find((x) => x.catalogoId === catalogoId);
    if (!s) return;
    if (modelo === "retainer") {
      store.updateServicio(catalogoId, {
        modeloCobro: "retainer",
        tipoPago: "mensual",
        montoMinimo: s.montoMinimo ?? 0,
        horasIncluidas: s.horasIncluidas ?? 40,
        tarifaHora: s.tarifaHora ?? TARIFA_HORA_DEFAULT,
        precio: s.montoMinimo ?? 0,
      });
    } else {
      store.updateServicio(catalogoId, {
        modeloCobro: "horas",
        precio: calcularPrecioHoras(s.horas ?? 1, s.tarifaHora ?? TARIFA_HORA_DEFAULT),
      });
    }
  };

  // Retainer: el precio cotizado es el monto minimo mensual. La tarifa/hora y las
  // horas incluidas son informativas (las horas adicionales se facturan aparte).
  const handleRetainerMonto = (catalogoId: string, montoMinimo: number) => {
    store.updateServicio(catalogoId, { montoMinimo, precio: montoMinimo });
  };

  const customServicios = store.draft.servicios.filter((s) => s.esPersonalizado);

  // Selector de opcion (1 / 2 / ambas) para una partida en modo doble propuesta.
  const opcionSelect = (catalogoId: string, value?: string) => (
    <select
      value={value ?? "ambas"}
      onChange={(e) => store.updateServicio(catalogoId, { opcion: e.target.value })}
      className="px-2 py-1 border border-primary/40 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
      title="Opcion a la que pertenece esta partida"
    >
      <option value="1">Opcion 1</option>
      <option value="2">Opcion 2</option>
      <option value="ambas">Ambas</option>
    </select>
  );

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
    esDoble: store.draft.esDoble,
    opciones: store.draft.esDoble ? store.draft.opciones : undefined,
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

  // Totales por opcion (doble propuesta). "ambas" suma en las dos.
  const totalesOpcion = useMemo(
    () => ({
      "1": calcularTotalesOpcion(store.draft.servicios, "1"),
      "2": calcularTotalesOpcion(store.draft.servicios, "2"),
    }),
    [store.draft.servicios]
  );

  const fases = [0, 1, 2, 3];
  const serviciosPorFase = useMemo(
    () =>
      [0, 1, 2, 3].reduce(
        (acc, fase) => {
          acc[fase] = servicios.filter((s) => s.fase === fase);
          return acc;
        },
        {} as Record<number, ServicioCatalogo[]>
      ),
    [servicios]
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
            <PreviewPDFButtonDraft draft={store.draft} />
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

        <div className="bg-card-bg rounded-xl border border-border p-5 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={esDoble}
              onChange={(e) => store.setField("esDoble", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="font-semibold text-lg">Doble propuesta</span>
            <span className="text-xs text-muted ml-2">
              Presenta dos opciones comparables; el cliente elige una.
            </span>
          </label>

          {esDoble && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {(["1", "2"] as const).map((op) => (
                <div
                  key={op}
                  className="border border-primary/30 rounded-lg p-4 bg-primary-light/10"
                >
                  <h3 className="font-semibold text-sm mb-2 text-primary">
                    Opcion {op}
                  </h3>
                  <label className="block text-xs font-medium text-muted mb-1">
                    Titulo
                  </label>
                  <input
                    type="text"
                    value={store.draft.opciones[op]?.titulo ?? ""}
                    onChange={(e) =>
                      store.updateOpcionMeta(op, { titulo: e.target.value })
                    }
                    placeholder={op === "1" ? "Ej. Capacitacion y revision" : "Ej. Arquitectura completa"}
                    className={INPUT_CLS}
                  />
                  <label className="block text-xs font-medium text-muted mb-1 mt-3">
                    Descripcion / scope
                  </label>
                  <textarea
                    value={store.draft.opciones[op]?.descripcion ?? ""}
                    onChange={(e) =>
                      store.updateOpcionMeta(op, { descripcion: e.target.value })
                    }
                    rows={3}
                    placeholder="Que incluye esta opcion..."
                    className={INPUT_CLS}
                  />
                  <label className="block text-xs font-medium text-muted mb-1 mt-3">
                    Lo que NO incluye
                  </label>
                  <textarea
                    value={store.draft.opciones[op]?.noIncluye ?? ""}
                    onChange={(e) =>
                      store.updateOpcionMeta(op, { noIncluye: e.target.value })
                    }
                    rows={2}
                    placeholder="Exclusiones de esta opcion..."
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          )}
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
                            {isSelected && esDoble &&
                              opcionSelect(serv.id, servicioData?.opcion)}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Servicios por tiempo (horas / retainer)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCustom}
                className="flex items-center gap-1 px-3 py-1.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary-light/30"
              >
                <Plus className="w-4 h-4" />
                Por horas
              </button>
              <button
                onClick={handleAddRetainer}
                className="flex items-center gap-1 px-3 py-1.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary-light/30"
              >
                <Plus className="w-4 h-4" />
                Retainer
              </button>
            </div>
          </div>
          {customServicios.length === 0 ? (
            <p className="text-xs text-muted">
              Agrega partidas cobradas por tiempo: <b>por horas</b> (horas x tarifa) o{" "}
              <b>retainer</b> (importe minimo mensual + horas adicionales que se facturan
              aparte). Aparecen en el resumen y en la cotizacion junto al resto de servicios.
            </p>
          ) : (
            <div className="space-y-3">
              {customServicios.map((s) => (
                <div
                  key={s.catalogoId}
                  className="border border-primary/40 bg-primary-light/10 rounded-lg p-3"
                >
                  <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                    <div className="col-span-2 md:col-span-4">
                      <label className="block text-xs font-medium text-muted mb-1">
                        Concepto
                      </label>
                      <input
                        type="text"
                        value={s.nombre}
                        onChange={(e) =>
                          store.updateServicio(s.catalogoId, {
                            nombre: e.target.value,
                          })
                        }
                        placeholder={
                          s.modeloCobro === "retainer"
                            ? "Ej. Acompanamiento mensual"
                            : "Ej. Horas de consultoria"
                        }
                        className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-muted mb-1">
                        Modelo
                      </label>
                      <select
                        value={s.modeloCobro === "retainer" ? "retainer" : "horas"}
                        onChange={(e) =>
                          handleModeloChange(s.catalogoId, e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      >
                        <option value="horas">Por horas</option>
                        <option value="retainer">Retainer</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-muted mb-1">
                        Fase
                      </label>
                      <select
                        value={s.fase}
                        onChange={(e) =>
                          store.updateServicio(s.catalogoId, {
                            fase: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      >
                        {[0, 1, 2, 3].map((f) => (
                          <option key={f} value={f}>
                            Fase {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-muted mb-1">
                        Tipo
                      </label>
                      {s.modeloCobro === "retainer" ? (
                        <div className="w-full px-2 py-1.5 border border-border rounded text-sm bg-gray-50 text-muted">
                          Mensual
                        </div>
                      ) : (
                        <select
                          value={s.tipoPago}
                          onChange={(e) =>
                            store.updateServicio(s.catalogoId, {
                              tipoPago: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        >
                          <option value="unico">Pago Unico</option>
                          <option value="mensual">Mensual</option>
                        </select>
                      )}
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <button
                        onClick={() => store.removeServicio(s.catalogoId)}
                        className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar partida"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {s.modeloCobro === "retainer" ? (
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-2 mt-2">
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-muted mb-1">
                          Monto minimo mensual
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={s.montoMinimo ?? 0}
                          onChange={(e) =>
                            handleRetainerMonto(
                              s.catalogoId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-muted mb-1">
                          Horas incluidas
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={s.horasIncluidas ?? 0}
                          onChange={(e) =>
                            store.updateServicio(s.catalogoId, {
                              horasIncluidas: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-muted mb-1">
                          Tarifa hora adicional
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={s.tarifaHora ?? 0}
                          onChange={(e) =>
                            store.updateServicio(s.catalogoId, {
                              tarifaHora: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-2 mt-2">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-muted mb-1">
                          Horas
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={s.horas ?? 0}
                          onChange={(e) =>
                            handleCustomHoras(
                              s.catalogoId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-muted mb-1">
                          Tarifa/hora
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={s.tarifaHora ?? 0}
                          onChange={(e) =>
                            handleCustomTarifa(
                              s.catalogoId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1.5 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Entrega:</span>
                      <input
                        type="text"
                        value={s.tiempoEntrega}
                        onChange={(e) =>
                          store.updateServicio(s.catalogoId, {
                            tiempoEntrega: e.target.value,
                          })
                        }
                        className="w-40 px-2 py-1 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {esDoble && (
                        <>
                          <span className="text-xs text-muted ml-2">Opcion:</span>
                          {opcionSelect(s.catalogoId, s.opcion)}
                        </>
                      )}
                    </div>
                    <span className="font-semibold">
                      {s.modeloCobro === "retainer" ? (
                        <span className="text-primary">
                          {describirRetainer(
                            s.montoMinimo ?? 0,
                            s.horasIncluidas ?? 0,
                            s.tarifaHora ?? 0
                          )}
                        </span>
                      ) : (
                        <>
                          {(s.horas ?? 0)} h x {formatCurrency(s.tarifaHora ?? 0)} ={" "}
                          <span className="text-primary">
                            {formatCurrency(s.precio)}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
            {esDoble && (
              <div className="p-5 space-y-4 border-b border-border">
                {(["1", "2"] as const).map((op) => {
                  const t = totalesOpcion[op];
                  const meta = store.draft.opciones[op];
                  return (
                    <div key={op} className="border border-primary/30 rounded-lg p-3 bg-primary-light/10">
                      <h4 className="text-sm font-semibold text-primary">
                        Opcion {op}
                        {meta?.titulo ? `: ${meta.titulo}` : ""}
                      </h4>
                      <div className="flex justify-between text-xs mt-2">
                        <span>Total unico (c/IVA)</span>
                        <span className="font-medium">
                          {formatCurrency(t.totalUnico * (1 + IVA_RATE))}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span>Total mensual (c/IVA)</span>
                        <span className="font-medium">
                          {formatCurrency(t.totalMensual * (1 + IVA_RATE))}
                        </span>
                      </div>
                      {t.horas > 0 && (
                        <div className="flex justify-between text-xs mt-1 text-muted">
                          <span>Horas estimadas</span>
                          <span>{t.horas} h</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted">
                  Las partidas marcadas <b>Ambas</b> suman en las dos opciones.
                </p>
              </div>
            )}
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
