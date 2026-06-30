"use client";

import { useState } from "react";
import { formatCurrency, precioDisplay, IVA_RATE } from "@/lib/calculators";

interface ServicioItem {
  id: string;
  nombre: string;
  precio: number;
  modeloCobro?: string | null;
  tarifaHora?: number | null;
}

interface PreciosEditablesProps {
  cotizacionId: string;
  serviciosUnicos: ServicioItem[];
  serviciosMensuales: ServicioItem[];
}

const INPUT_CLS =
  "w-28 px-2 py-1 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary";

export function PreciosEditables({
  cotizacionId,
  serviciosUnicos,
  serviciosMensuales,
}: PreciosEditablesProps) {
  const [unicos, setUnicos] = useState(serviciosUnicos);
  const [mensuales, setMensuales] = useState(serviciosMensuales);
  const [saving, setSaving] = useState<string | null>(null);

  const totalUnico = unicos.reduce((s, x) => s + x.precio, 0);
  const totalMensual = mensuales.reduce((s, x) => s + x.precio, 0);

  const handlePrecioChange = async (
    servicioId: string,
    nuevoPrecio: number,
    tipo: "unico" | "mensual"
  ) => {
    const lista = tipo === "unico" ? unicos : mensuales;
    const setter = tipo === "unico" ? setUnicos : setMensuales;
    const prev = lista;

    setter(lista.map((s) => (s.id === servicioId ? { ...s, precio: nuevoPrecio } : s)));

    setSaving(servicioId);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/precio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicioId, precio: nuevoPrecio }),
      });
      if (!res.ok) setter(prev);
    } catch {
      setter(prev);
    } finally {
      setSaving(null);
    }
  };

  // Las partidas "bajo demanda" no tienen un precio fijo (se facturan por consumo):
  // su monto guardado es 0 y lo relevante es la tarifa por hora cotizada, que se
  // muestra como texto en vez de un input editable de precio.
  const renderFila = (s: ServicioItem, tipo: "unico" | "mensual") => (
    <div key={s.id} className="flex items-center justify-between text-sm gap-2">
      <span className="flex-1 truncate">{s.nombre}</span>
      <div className="flex items-center gap-1 shrink-0">
        {s.modeloCobro === "demanda" ? (
          <span className="text-muted">{precioDisplay(s)}</span>
        ) : (
          <>
            <span className="text-muted text-xs">$</span>
            <input
              type="number"
              value={s.precio}
              onChange={(e) =>
                handlePrecioChange(s.id, parseFloat(e.target.value) || 0, tipo)
              }
              className={INPUT_CLS}
            />
            {saving === s.id && <span className="text-xs text-muted">...</span>}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div className="bg-card-bg rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Pago Unico</h3>
        </div>
        <div className="p-5">
          {unicos.length === 0 ? (
            <p className="text-muted text-sm">Sin servicios</p>
          ) : (
            <div className="space-y-2">
              {unicos.map((s) => renderFila(s, "unico"))}
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(totalUnico)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted">
              <span>IVA (16%)</span>
              <span>{formatCurrency(totalUnico * IVA_RATE)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">
                {formatCurrency(totalUnico * (1 + IVA_RATE))}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-card-bg rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Pago Mensual</h3>
        </div>
        <div className="p-5">
          {mensuales.length === 0 ? (
            <p className="text-muted text-sm">Sin servicios</p>
          ) : (
            <div className="space-y-2">
              {mensuales.map((s) => renderFila(s, "mensual"))}
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(totalMensual)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted">
              <span>IVA (16%)</span>
              <span>{formatCurrency(totalMensual * IVA_RATE)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">
                {formatCurrency(totalMensual * (1 + IVA_RATE))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
