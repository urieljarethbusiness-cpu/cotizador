"use client";

import { useMemo, useRef, useState } from "react";
import { Clock, Plus, Trash2, Pencil, Printer, Eye, X } from "lucide-react";
import {
  formatCurrency,
  formatFechaRegistro,
  periodoAgrupacion,
  calcularHorasRango,
  MODOS_AGRUPACION,
  IVA_RATE,
  type ModoAgrupacion,
} from "@/lib/calculators";

interface Registro {
  id: string;
  fecha: string; // ISO (12:00 UTC)
  horaInicio: string;
  horaFin: string;
  horas: number;
  tarifaHora: number;
  descripcion: string;
}

interface Branding {
  colorPrimario?: string;
  colorSecundario?: string;
  logoBase64?: string;
  logoMime?: string;
}

interface RegistroHorasPanelProps {
  cotizacionId: string;
  numero: string;
  clienteNombre: string;
  clienteEmpresa: string | null;
  proyecto: string;
  tarifaSugerida: number;
  incluirIva: boolean;
  branding: Branding;
  registrosIniciales: Registro[];
}

function hoyISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

const formVacio = (tarifa: number) => ({
  fecha: hoyISO(),
  horaInicio: "09:00",
  horaFin: "13:00",
  descripcion: "",
  tarifaHora: tarifa,
});

const INPUT = "px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary";

export function RegistroHorasPanel({
  cotizacionId,
  numero,
  clienteNombre,
  clienteEmpresa,
  proyecto,
  tarifaSugerida,
  incluirIva,
  branding,
  registrosIniciales,
}: RegistroHorasPanelProps) {
  const [registros, setRegistros] = useState<Registro[]>(registrosIniciales);
  const [form, setForm] = useState(formVacio(tarifaSugerida));
  const [editId, setEditId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoAgrupacion>("detalle");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // HTML de la nota congelado al abrir la previsualización (null = modal cerrado).
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Horas en vivo del rango actual del formulario (feedback al asesor).
  const horasPreview = calcularHorasRango(form.horaInicio, form.horaFin);

  const filtrados = useMemo(() => {
    return registros
      .filter((r) => {
        const d = r.fecha.slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) =>
        a.fecha === b.fecha
          ? a.horaInicio.localeCompare(b.horaInicio)
          : a.fecha.localeCompare(b.fecha)
      );
  }, [registros, from, to]);

  const grupos = useMemo(() => {
    if (modo === "detalle") return [];
    const map = new Map<string, { etiqueta: string; horas: number; importe: number; count: number }>();
    for (const r of filtrados) {
      const { clave, etiqueta } = periodoAgrupacion(new Date(r.fecha), modo);
      const g = map.get(clave) ?? { etiqueta, horas: 0, importe: 0, count: 0 };
      g.horas += r.horas;
      g.importe += r.horas * r.tarifaHora;
      g.count += 1;
      map.set(clave, g);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([clave, g]) => ({ clave, ...g }));
  }, [filtrados, modo]);

  const totalHoras = filtrados.reduce((a, r) => a + r.horas, 0);
  const subtotal = filtrados.reduce((a, r) => a + r.horas * r.tarifaHora, 0);
  const iva = incluirIva ? subtotal * IVA_RATE : 0;
  const total = subtotal + iva;

  const resetForm = () => {
    setForm(formVacio(tarifaSugerida));
    setEditId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (calcularHorasRango(form.horaInicio, form.horaFin) <= 0) {
      setError("El rango es invalido: la hora fin debe ser mayor a la de inicio.");
      return;
    }
    if (!form.descripcion.trim()) {
      setError("Agrega una descripcion breve de lo realizado.");
      return;
    }
    setSaving(true);
    try {
      const url = editId
        ? `/api/cotizaciones/${cotizacionId}/horas/${editId}`
        : `/api/cotizaciones/${cotizacionId}/horas`;
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar el registro");
        return;
      }
      setRegistros((prev) =>
        editId ? prev.map((r) => (r.id === editId ? data : r)) : [...prev, data]
      );
      resetForm();
    } catch {
      setError("Error de conexion al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: Registro) => {
    setEditId(r.id);
    setError(null);
    setForm({
      fecha: r.fecha.slice(0, 10),
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      descripcion: r.descripcion,
      tarifaHora: r.tarifaHora,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este registro de horas?")) return;
    const prev = registros;
    setRegistros((rs) => rs.filter((r) => r.id !== id));
    if (editId === id) resetForm();
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/horas/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) setRegistros(prev);
    } catch {
      setRegistros(prev);
    }
  };

  // Congela el HTML de la nota (con branding) y abre el modal de previsualización.
  const abrirPreview = () => setPreviewHtml(construirHTMLNota());

  // Imprime / guarda como PDF solo el contenido de la nota previsualizada.
  const imprimirDesdePreview = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  // ---- HTML autocontenido de la nota de pago (para imprimir / guardar como PDF) ----
  const construirHTMLNota = () => {
    const PRIMARY = branding.colorPrimario || "#2563eb";
    const DARK = branding.colorSecundario || "#111827";
    const logoSrc = branding.logoBase64
      ? `data:${branding.logoMime || "image/png"};base64,${branding.logoBase64}`
      : "";

    const periodoTexto =
      from || to
        ? `Periodo: ${from ? formatFechaRegistro(new Date(`${from}T12:00:00Z`)) : "inicio"} al ${
            to ? formatFechaRegistro(new Date(`${to}T12:00:00Z`)) : "hoy"
          }`
        : "Periodo: todos los registros";

    const modoLabel = MODOS_AGRUPACION.find((m) => m.value === modo)?.label ?? "";

    const cuerpo =
      modo === "detalle"
        ? `<thead><tr>
             <th>Fecha</th><th>Horario</th><th class="r">Horas</th>
             <th class="r">Tarifa</th><th class="r">Importe</th><th>Descripcion</th>
           </tr></thead>
           <tbody>${filtrados
             .map(
               (r) => `<tr>
                 <td>${formatFechaRegistro(new Date(r.fecha))}</td>
                 <td>${r.horaInicio}–${r.horaFin}</td>
                 <td class="r">${r.horas.toFixed(2)}</td>
                 <td class="r">${formatCurrency(r.tarifaHora)}</td>
                 <td class="r">${formatCurrency(r.horas * r.tarifaHora)}</td>
                 <td>${escapeHtml(r.descripcion)}</td>
               </tr>`
             )
             .join("")}</tbody>`
        : `<thead><tr>
             <th>${modoLabel}</th><th class="r">Registros</th>
             <th class="r">Horas</th><th class="r">Importe</th>
           </tr></thead>
           <tbody>${grupos
             .map(
               (g) => `<tr>
                 <td>${escapeHtml(g.etiqueta)}</td>
                 <td class="r">${g.count}</td>
                 <td class="r">${g.horas.toFixed(2)}</td>
                 <td class="r">${formatCurrency(g.importe)}</td>
               </tr>`
             )
             .join("")}</tbody>`;

    const totalesHTML = `
      <table class="tot">
        <tr><td>Total de horas</td><td class="r">${totalHoras.toFixed(2)} h</td></tr>
        <tr><td>Subtotal</td><td class="r">${formatCurrency(subtotal)}</td></tr>
        ${incluirIva ? `<tr><td>IVA (16%)</td><td class="r">${formatCurrency(iva)}</td></tr>` : ""}
        <tr class="grand"><td>Total a pagar</td><td class="r">${formatCurrency(total)}</td></tr>
      </table>`;

    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Nota de pago ${escapeHtml(numero)}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:40px;font-size:13px}
        h1{font-size:20px;margin:0 0 4px;color:${DARK}} .muted{color:#6b7280}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${PRIMARY};padding-bottom:12px;margin-bottom:16px}
        .brand{display:flex;align-items:center;gap:14px}
        .logo{height:52px;width:auto;max-width:220px;object-fit:contain}
        .meta{margin:12px 0;line-height:1.6}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
        .r{text-align:right;white-space:nowrap}
        .tot{width:auto;min-width:280px;margin-left:auto;margin-top:16px}
        .tot td{border:none;padding:4px 8px}
        .tot .grand td{border-top:2px solid ${PRIMARY};font-weight:bold;font-size:15px;padding-top:8px;color:${DARK}}
        .foot{margin-top:32px;color:#6b7280;font-size:11px;text-align:center}
        @media print{body{margin:16px}}
      </style></head><body>
      <div class="head">
        <div class="brand">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="logo">` : ""}
          <div>
            <h1>Nota de pago</h1>
            <div class="muted">Cotizacion ${escapeHtml(numero)} · ${escapeHtml(proyecto)}</div>
          </div>
        </div>
        <div class="muted" style="text-align:right">Emitida: ${formatFechaRegistro(new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z"))}</div>
      </div>
      <div class="meta">
        <div><b>Cliente:</b> ${escapeHtml(clienteEmpresa || clienteNombre)}</div>
        ${clienteEmpresa ? `<div><b>Contacto:</b> ${escapeHtml(clienteNombre)}</div>` : ""}
        <div class="muted">${periodoTexto} · Desglose ${modoLabel.toLowerCase()}</div>
      </div>
      <table>${cuerpo}</table>
      ${totalesHTML}
      <div class="foot">Documento generado desde el Cotizador. Conteo de horas trabajadas para cobro del proyecto.</div>
      </body></html>`;
  };

  return (
    <div className="bg-card-bg rounded-xl border border-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Registro de horas
        </h2>
        <button
          onClick={abrirPreview}
          disabled={filtrados.length === 0}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          <Eye className="w-4 h-4 text-blue-600" />
          Previsualizar nota
        </button>
      </div>

      {/* Formulario de alta / edicion */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-gray-50 rounded-lg p-3 mb-4"
      >
        <div className="md:col-span-2">
          <label className="block text-xs text-muted mb-1">Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className={`${INPUT} w-full`}
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-muted mb-1">Inicio</label>
          <input
            type="time"
            value={form.horaInicio}
            onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
            className={`${INPUT} w-full`}
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-muted mb-1">Fin</label>
          <input
            type="time"
            value={form.horaFin}
            onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
            className={`${INPUT} w-full`}
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-muted mb-1">Horas</label>
          <div className="px-2 py-1.5 text-sm font-medium text-center">
            {horasPreview > 0 ? horasPreview.toFixed(2) : "—"}
          </div>
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs text-muted mb-1">Descripcion</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Qué se hizo en este tramo"
            className={`${INPUT} w-full`}
            maxLength={500}
            required
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-muted mb-1">Tarifa/hr</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.tarifaHora}
            onChange={(e) => setForm({ ...form, tarifaHora: parseFloat(e.target.value) || 0 })}
            className={`${INPUT} w-full text-right`}
          />
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {editId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editId ? "Guardar" : "Agregar"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2 py-1.5 border border-border rounded-lg text-sm hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {error && <p className="md:col-span-12 text-sm text-red-600">{error}</p>}
      </form>

      {/* Filtros y agrupacion */}
      <div className="flex items-end gap-3 flex-wrap mb-3">
        <div>
          <label className="block text-xs text-muted mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="text-xs text-muted underline py-2"
          >
            Limpiar
          </button>
        )}
        <div className="ml-auto">
          <label className="block text-xs text-muted mb-1">Desglose</label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoAgrupacion)}
            className={INPUT}
          >
            {MODOS_AGRUPACION.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <p className="text-muted text-sm py-6 text-center">
          Aún no hay registros de horas{from || to ? " en este periodo" : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                {modo === "detalle" ? (
                  <>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Horario</th>
                    <th className="py-2 pr-3 font-medium text-right">Horas</th>
                    <th className="py-2 pr-3 font-medium text-right">Tarifa</th>
                    <th className="py-2 pr-3 font-medium text-right">Importe</th>
                    <th className="py-2 pr-3 font-medium">Descripcion</th>
                    <th className="py-2 font-medium"></th>
                  </>
                ) : (
                  <>
                    <th className="py-2 pr-3 font-medium">Periodo</th>
                    <th className="py-2 pr-3 font-medium text-right">Registros</th>
                    <th className="py-2 pr-3 font-medium text-right">Horas</th>
                    <th className="py-2 pr-3 font-medium text-right">Importe</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {modo === "detalle"
                ? filtrados.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatFechaRegistro(new Date(r.fecha))}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.horaInicio}–{r.horaFin}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.horas.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(r.tarifaHora)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(r.horas * r.tarifaHora)}</td>
                      <td className="py-2 pr-3">{r.descripcion}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1 text-muted hover:text-primary"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-muted hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                : grupos.map((g) => (
                    <tr key={g.clave} className="border-b border-border/60">
                      <td className="py-2 pr-3">{g.etiqueta}</td>
                      <td className="py-2 pr-3 text-right">{g.count}</td>
                      <td className="py-2 pr-3 text-right">{g.horas.toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(g.importe)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totales */}
      {filtrados.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Total de horas</span>
              <span className="font-medium">{totalHoras.toFixed(2)} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {incluirIva && (
              <div className="flex justify-between text-muted">
                <span>IVA (16%)</span>
                <span>{formatCurrency(iva)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t border-border">
              <span>Total a pagar</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Previsualizador de la nota de pago */}
      {previewHtml !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm truncate">Nota de pago — {numero}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={imprimirDesdePreview}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50"
              >
                <Printer className="w-4 h-4 text-primary" />
                Imprimir / Guardar PDF
              </button>
              <button
                onClick={() => setPreviewHtml(null)}
                aria-label="Cerrar previsualización"
                className="p-2 border border-border rounded-lg hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-4" onClick={(e) => e.stopPropagation()}>
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml}
              title="Previsualización de la nota de pago"
              className="w-full h-full rounded-lg bg-white border border-border"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
