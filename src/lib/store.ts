import { create } from "zustand";
import type { MetaOpcion } from "./calculators";

export interface ServicioSeleccionado {
  catalogoId: string;
  nombre: string;
  fase: number;
  tipoPago: string;
  precio: number;
  tiempoEntrega: string;
  entregables: string[];
  // Beneficios destacados de la partida (distintos de entregables). Usados sobre todo en
  // partidas "demanda" para denotar valor cuando no hay precio comprometido.
  beneficios?: string[];
  notas?: string;
  // Doble propuesta: "1" | "2" | "ambas". undefined = cotizacion normal.
  opcion?: string;
  // Partidas personalizadas (sin catalogo). modeloCobro define como se calcula el precio:
  //  - "fijo": precio editable / precioBase (servicios de catalogo)
  //  - "horas": precio = horas * tarifaHora
  //  - "retainer": precio = montoMinimo (mensual); tarifaHora y horasIncluidas son informativos
  //  - "demanda": tarifa por hora sin horas comprometidas; precio=0, no suma al total
  esPersonalizado?: boolean;
  horas?: number;
  tarifaHora?: number;
  modeloCobro?: string;
  montoMinimo?: number;
  horasIncluidas?: number;
}

export interface CotizacionDraft {
  clienteNombre: string;
  clienteEmpresa: string;
  clienteEmail: string;
  clienteTelefono: string;
  clienteRfc: string;
  asesorId: string;
  asesorNombre: string;
  fecha: Date;
  vigencia: Date | null;
  moneda: string;
  tipoCambio: string;
  proyecto: string;
  esquemaPago: string;
  incluirBonos: boolean;
  incluirFinanciamiento: boolean;
  // Aplica IVA (se emite factura). false = proyecto sin factura, precios finales sin IVA.
  incluirIva: boolean;
  planBucefaloNivel: string | null;
  servicios: ServicioSeleccionado[];
  observaciones: string;
  // Doble propuesta: dos opciones comparables dentro de una misma cotizacion.
  esDoble: boolean;
  opciones: { "1"?: MetaOpcion; "2"?: MetaOpcion };
}

interface CotizacionStore {
  draft: CotizacionDraft;
  setField: <K extends keyof CotizacionDraft>(
    field: K,
    value: CotizacionDraft[K]
  ) => void;
  toggleServicio: (servicio: ServicioSeleccionado) => void;
  updateServicio: (catalogoId: string, updates: Partial<ServicioSeleccionado>) => void;
  removeServicio: (catalogoId: string) => void;
  setServicios: (servicios: ServicioSeleccionado[]) => void;
  updateOpcionMeta: (opcion: "1" | "2", parcial: Partial<MetaOpcion>) => void;
  resetDraft: () => void;
}

const initialDraft: CotizacionDraft = {
  clienteNombre: "",
  clienteEmpresa: "",
  clienteEmail: "",
  clienteTelefono: "",
  clienteRfc: "",
  asesorId: "",
  asesorNombre: "",
  fecha: new Date(),
  vigencia: null,
  moneda: "MXN",
  tipoCambio: "NA",
  proyecto: "MKT Digital",
  esquemaPago: "Pago Unico/Mensual",
  incluirBonos: false,
  incluirFinanciamiento: false,
  incluirIva: true,
  planBucefaloNivel: null,
  servicios: [],
  observaciones: "",
  esDoble: false,
  opciones: {},
};

export const useCotizacionStore = create<CotizacionStore>((set) => ({
  draft: { ...initialDraft },

  setField: (field, value) =>
    set((state) => ({ draft: { ...state.draft, [field]: value } })),

  toggleServicio: (servicio) =>
    set((state) => {
      const exists = state.draft.servicios.find(
        (s) => s.catalogoId === servicio.catalogoId
      );
      if (exists) {
        return {
          draft: {
            ...state.draft,
            servicios: state.draft.servicios.filter(
              (s) => s.catalogoId !== servicio.catalogoId
            ),
          },
        };
      }
      return {
        draft: {
          ...state.draft,
          servicios: [...state.draft.servicios, servicio],
        },
      };
    }),

  updateServicio: (catalogoId, updates) =>
    set((state) => ({
      draft: {
        ...state.draft,
        servicios: state.draft.servicios.map((s) =>
          s.catalogoId === catalogoId ? { ...s, ...updates } : s
        ),
      },
    })),

  removeServicio: (catalogoId) =>
    set((state) => ({
      draft: {
        ...state.draft,
        servicios: state.draft.servicios.filter(
          (s) => s.catalogoId !== catalogoId
        ),
      },
    })),

  setServicios: (servicios) =>
    set((state) => ({ draft: { ...state.draft, servicios } })),

  updateOpcionMeta: (opcion, parcial) =>
    set((state) => ({
      draft: {
        ...state.draft,
        opciones: {
          ...state.draft.opciones,
          [opcion]: { ...state.draft.opciones[opcion], ...parcial },
        },
      },
    })),

  resetDraft: () => set({ draft: { ...initialDraft } }),
}));
