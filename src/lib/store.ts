import { create } from "zustand";

export interface ServicioSeleccionado {
  catalogoId: string;
  nombre: string;
  fase: number;
  tipoPago: string;
  precio: number;
  tiempoEntrega: string;
  entregables: string[];
  notas?: string;
}

export interface CotizacionDraft {
  clienteNombre: string;
  clienteEmpresa: string;
  clienteEmail: string;
  clienteTelefono: string;
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
  planBucefaloNivel: string | null;
  servicios: ServicioSeleccionado[];
  observaciones: string;
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
  resetDraft: () => void;
}

const initialDraft: CotizacionDraft = {
  clienteNombre: "",
  clienteEmpresa: "",
  clienteEmail: "",
  clienteTelefono: "",
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
  planBucefaloNivel: null,
  servicios: [],
  observaciones: "",
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

  resetDraft: () => set({ draft: { ...initialDraft } }),
}));
