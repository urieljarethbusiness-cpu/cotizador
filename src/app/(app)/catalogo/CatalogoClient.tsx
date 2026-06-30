"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Package,
  LayoutGrid,
  Settings,
  Save,
  FileDown,
  Upload,
} from "lucide-react";
import { formatCurrency, FASES as FASES_LABELS } from "@/lib/calculators";
import clsx from "clsx";

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  fase: number;
  tipoPago: string;
  precioBase: number;
  tiempoEntrega: string;
  entregablesDefault: string[];
  categoriaId: string | null;
  categoriaNombre: string;
  categoriaColor: string;
  variante: string | null;
  nivel: string | null;
  activo: boolean;
  orden: number;
}

interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  activo: boolean;
  orden: number;
}

interface FasePaqueteUI {
  id: string;
  nombre: string;
  orden: number;
  servicios: { id: string; nombre: string; precioBase: number; tipoPago: string; nivel: string | null }[];
}

interface PaqueteUI {
  id: string;
  nombre: string;
  descripcion: string | null;
  fases: FasePaqueteUI[];
}

interface Props {
  initialServicios: Servicio[];
  initialCategorias: Categoria[];
  initialPaquetes: PaqueteUI[];
}

type Tab = "categorias" | "paquetes" | "servicios";

const FASES = FASES_LABELS;

export function CatalogoClient({ initialServicios, initialCategorias, initialPaquetes }: Props) {
  const [tab, setTab] = useState<Tab>("servicios");
  const [servicios, setServicios] = useState<Servicio[]>(initialServicios);
  const [categorias, setCategorias] = useState<Categoria[]>(initialCategorias);
  const [paquetes, setPaquetes] = useState<PaqueteUI[]>(initialPaquetes);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, pRes] = await Promise.all([
        fetch("/api/catalogo"),
        fetch("/api/categorias"),
        fetch("/api/paquetes"),
      ]);
      if (sRes.ok) setServicios(await sRes.json());
      if (cRes.ok) setCategorias(await cRes.json());
      if (pRes.ok) setPaquetes(await pRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/catalogo", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        let msg = `${data.creados} servicio(s) importado(s).`;
        if (data.omitidos > 0) msg += ` ${data.omitidos} omitido(s).`;
        if (data.errores?.length) msg += `\n\nErrores:\n${data.errores.join("\n")}`;
        alert(msg);
        await refresh();
      } else {
        alert(data.error || "Error al importar");
      }
    } catch {
      alert("Error al importar CSV");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const deleteCategoria = async (id: string) => {
    const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    if (res.ok) setCategorias((p) => p.filter((c) => c.id !== id));
    else { const e = await res.json(); alert(e.error); }
  };

  const toggleCategoriaActivo = async (cat: Categoria) => {
    const res = await fetch(`/api/categorias/${cat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cat, activo: !cat.activo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCategorias((p) => p.map((c) => (c.id === cat.id ? updated : c)));
    }
  };

  const deletePaquete = async (id: string) => {
    if (!confirm("Eliminar este paquete y todas sus fases?")) return;
    const res = await fetch(`/api/paquetes/${id}`, { method: "DELETE" });
    if (res.ok) setPaquetes((p) => p.filter((pk) => pk.id !== id));
  };

  const handleCreatePaquete = async () => {
    const nombre = prompt("Nombre del paquete:");
    if (!nombre) return;
    const res = await fetch("/api/paquetes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, fases: [] }),
    });
    if (res.ok) {
      const created = await res.json();
      setPaquetes((p) => [...p, { ...created, fases: [] }]);
    }
  };

  const addFaseToPaquete = async (paqueteId: string) => {
    const nombre = prompt("Nombre de la fase:");
    if (!nombre) return;
    const pk = paquetes.find((p) => p.id === paqueteId);
    const orden = pk ? pk.fases.length : 0;
    const res = await fetch(`/api/paquetes/${paqueteId}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addFase", nombre, orden }),
    });
    if (res.ok) {
      const fase = await res.json();
      setPaquetes((p) =>
        p.map((pk) =>
          pk.id === paqueteId ? { ...pk, fases: [...pk.fases, { ...fase, servicios: [] }] } : pk
        )
      );
    }
  };

  const deleteFase = async (paqueteId: string, faseId: string) => {
    if (!confirm("Eliminar esta fase?")) return;
    const res = await fetch(`/api/paquetes/${paqueteId}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteFase", faseId }),
    });
    if (res.ok) {
      setPaquetes((p) =>
        p.map((pk) =>
          pk.id === paqueteId ? { ...pk, fases: pk.fases.filter((f) => f.id !== faseId) } : pk
        )
      );
    }
  };

  const removeServFromFase = async (paqueteId: string, faseId: string, servicioId: string) => {
    const res = await fetch(`/api/paquetes/${paqueteId}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeServicio", servicioCatalogoId: servicioId, fasePaqueteId: faseId }),
    });
    if (res.ok) {
      setPaquetes((p) =>
        p.map((pk) =>
          pk.id === paqueteId
            ? {
                ...pk,
                fases: pk.fases.map((f) =>
                  f.id === faseId
                    ? { ...f, servicios: f.servicios.filter((s) => s.id !== servicioId) }
                    : f
                ),
              }
            : pk
        )
      );
    }
  };

  const addServToFase = async (paqueteId: string, faseId: string, servicioId: string) => {
    const res = await fetch(`/api/paquetes/${paqueteId}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addServicio", servicioCatalogoId: servicioId, fasePaqueteId: faseId }),
    });
    if (res.ok) await refresh();
  };

  const [addModal, setAddModal] = useState<{ paqueteId: string; faseId: string } | null>(null);
  const [servicioModal, setServicioModal] = useState<Servicio | null>(null);
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [expandedPk, setExpandedPk] = useState<Set<string>>(new Set(paquetes.map((p) => p.id)));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "servicios", label: "Servicios", icon: <LayoutGrid className="w-4 h-4" /> },
    { key: "categorias", label: "Categorias", icon: <Settings className="w-4 h-4" /> },
    { key: "paquetes", label: "Paquetes", icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catalogo de Servicios</h1>
        <div className="flex items-center gap-3">
          <a
            href="/api/export/catalogo/plantilla"
            download
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Plantilla CSV
          </a>
          <label className={`flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4" />
            {importing ? "Importando..." : "Importar CSV"}
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <a
            href="/api/export/catalogo"
            download
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Exportar CSV
          </a>
          <button onClick={refresh} disabled={loading} className="text-xs text-muted hover:text-dark">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === t.key ? "bg-white shadow text-dark" : "text-muted hover:text-dark"
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: SERVICIOS (por categoria) ── */}
      {tab === "servicios" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{servicios.filter((s) => s.activo).length} servicios activos</p>
            <button
              onClick={() => setShowNewServicio(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
            >
              <Plus className="w-4 h-4" /> Nuevo Servicio
            </button>
          </div>
          {categorias.filter((c) => c.activo).map((cat) => {
            const catServs = servicios.filter((s) => s.categoriaNombre === cat.nombre);
            if (!catServs.length) return null;
            return (
              <div key={cat.id} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <h2 className="font-semibold text-lg">{cat.nombre}</h2>
                  <span className="text-xs text-muted">({catServs.length})</span>
                </div>
                <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-muted">Servicio</th>
                        <th className="text-left px-4 py-3 font-medium text-muted w-28">Tipo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted w-32">Tiempo</th>
                        <th className="text-right px-4 py-3 font-medium text-muted w-32">Precio</th>
                        <th className="text-center px-4 py-3 font-medium text-muted w-28">Entregables</th>
                        <th className="text-center px-4 py-3 font-medium text-muted w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catServs.map((s) => (
                        <tr key={s.id} className={clsx("border-b border-border hover:bg-gray-50", !s.activo && "opacity-50")}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium flex flex-wrap items-center gap-2 min-w-0">
                              <span className="break-words">{s.nombre}</span>
                              {s.nivel && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{s.nivel}</span>}
                            </div>
                            {s.descripcion && <div className="text-xs text-muted mt-0.5 break-words">{s.descripcion}</div>}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className={clsx("inline-block px-2 py-0.5 rounded text-xs font-medium", s.tipoPago === "unico" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                              {s.tipoPago === "unico" ? "Unico" : "Mensual"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted text-xs align-top">{s.tiempoEntrega}</td>
                          <td className="px-4 py-3 text-right font-medium align-top">{formatCurrency(s.precioBase)}</td>
                          <td className="px-4 py-3 text-center text-muted align-top">{s.entregablesDefault.length}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setServicioModal(s)} className="p-1.5 text-muted hover:text-primary rounded" title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`Eliminar "${s.nombre}"?`)) return;
                                const res = await fetch(`/api/catalogo/${s.id}`, { method: "DELETE" });
                                if (res.ok) { const d = await res.json(); if (d.archived) { setServicios((p) => p.map((x) => x.id === s.id ? { ...x, activo: false } : x)); } else { setServicios((p) => p.filter((x) => x.id !== s.id)); } }
                              }} className="p-1.5 text-muted hover:text-red-500 rounded" title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: CATEGORIAS ── */}
      {tab === "categorias" && (
        <div className="space-y-3">
          {categorias.map((cat) => (
            <div key={cat.id} className="bg-card-bg rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{cat.nombre}</div>
                {cat.descripcion && <div className="text-xs text-muted">{cat.descripcion}</div>}
              </div>
              <span className="text-xs text-muted">
                {servicios.filter((s) => s.categoriaNombre === cat.nombre).length} servicios
              </span>
              <button
                onClick={() => toggleCategoriaActivo(cat)}
                className={clsx("px-3 py-1 rounded text-xs font-medium", cat.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}
              >
                {cat.activo ? "Activa" : "Inactiva"}
              </button>
              <button onClick={() => deleteCategoria(cat.id)} className="p-1.5 text-muted hover:text-red-500 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <CreateCategoriaInline onCreated={refresh} />
        </div>
      )}

      {/* ── TAB: PAQUETES ── */}
      {tab === "paquetes" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={handleCreatePaquete} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
              <Plus className="w-4 h-4" /> Nuevo Paquete
            </button>
          </div>

          {paquetes.map((pk) => {
            const isOpen = expandedPk.has(pk.id);
            return (
              <div key={pk.id} className="bg-card-bg rounded-xl border border-border overflow-hidden">
                <div
                  onClick={() => setExpandedPk((prev) => { const n = new Set(prev); if (n.has(pk.id)) n.delete(pk.id); else n.add(pk.id); return n; })}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 cursor-pointer"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{pk.nombre}</div>
                    {pk.descripcion && <div className="text-xs text-muted">{pk.descripcion}</div>}
                  </div>
                  <span className="text-xs text-muted">{pk.fases.length} fases</span>
                  <button onClick={(e) => { e.stopPropagation(); deletePaquete(pk.id); }} className="p-1.5 text-muted hover:text-red-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-4">
                    {pk.fases.map((fase) => (
                      <div key={fase.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                          <span className="font-medium text-sm">{fase.nombre}</span>
                          <span className="text-xs text-muted">({fase.servicios.length} servicios)</span>
                          <div className="ml-auto">
                            <button onClick={() => setAddModal({ paqueteId: pk.id, faseId: fase.id })} className="text-xs text-primary hover:underline mr-3">
                              + Agregar servicio
                            </button>
                            <button onClick={() => deleteFase(pk.id, fase.id)} className="text-xs text-red-500 hover:underline">
                              Eliminar fase
                            </button>
                          </div>
                        </div>
                        {fase.servicios.length > 0 ? (
                          <table className="w-full text-sm table-fixed">
                            <tbody>
                              {fase.servicios.map((s) => (
                                <tr key={s.id} className="border-t border-border">
                                  <td className="px-4 py-2 align-top">
                                    <div className="font-medium flex flex-wrap items-center gap-2 min-w-0">
                                      <span className="break-words">{s.nombre}</span>
                                      {s.nivel && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{s.nivel}</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 align-top w-28">
                                    <span className={clsx("text-xs px-2 py-0.5 rounded", s.tipoPago === "unico" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                                      {s.tipoPago === "unico" ? "Unico" : "Mensual"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium text-sm align-top w-32">{formatCurrency(s.precioBase)}</td>
                                  <td className="px-4 py-2 w-10 align-top">
                                    <button onClick={() => removeServFromFase(pk.id, fase.id, s.id)} className="text-muted hover:text-red-500">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="px-4 py-3 text-xs text-muted">Sin servicios asignados</p>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addFaseToPaquete(pk.id)} className="text-sm text-primary hover:underline flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Agregar fase
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Add service to phase ── */}
      {addModal && (
        <AddServicioModal
          servicios={servicios.filter((s) => s.activo)}
          onAdd={(servicioId) => {
            addServToFase(addModal.paqueteId, addModal.faseId, servicioId);
            setAddModal(null);
          }}
          onClose={() => setAddModal(null)}
        />
      )}

      {(servicioModal || showNewServicio) && (
        <ServicioFormModal
          servicio={servicioModal}
          categorias={categorias}
          onSave={async (data) => {
            if (servicioModal) {
              const res = await fetch(`/api/catalogo/${servicioModal.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                const updated = await res.json();
                setServicios((p) => p.map((s) => (s.id === servicioModal.id ? { ...s, ...updated, categoriaNombre: categorias.find((c) => c.id === data.categoriaId)?.nombre || s.categoriaNombre, categoriaColor: categorias.find((c) => c.id === data.categoriaId)?.color || s.categoriaColor } : s)));
              }
            } else {
              const res = await fetch("/api/catalogo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              if (res.ok) {
                const created = await res.json();
                const cat = categorias.find((c) => c.id === data.categoriaId);
                setServicios((p) => [...p, { ...created, categoriaNombre: cat?.nombre || "Sin categoria", categoriaColor: cat?.color || "#6b7280" }]);
              }
            }
            setServicioModal(null);
            setShowNewServicio(false);
          }}
          onClose={() => { setServicioModal(null); setShowNewServicio(false); }}
        />
      )}
    </div>
  );
}

function CreateCategoriaInline({ onCreated }: { onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), color }),
      });
      if (res.ok) { setNombre(""); onCreated(); }
      else { const e = await res.json(); alert(e.error); }
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-3 bg-card-bg rounded-xl border border-dashed border-border p-4">
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer p-0 border-0" />
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder="Nueva categoria..."
        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <button onClick={handleSave} disabled={saving || !nombre.trim()} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Crear
      </button>
    </div>
  );
}

function AddServicioModal({
  servicios,
  onAdd,
  onClose,
}: {
  servicios: Servicio[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = servicios.filter(
    (s) =>
      s.nombre.toLowerCase().includes(search.toLowerCase()) ||
      s.categoriaNombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Agregar servicio a la fase</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted" /></button>
        </div>
        <div className="px-5 py-3 border-b border-border">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o categoria..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.id)}
              className="w-full text-left px-5 py-3 hover:bg-gray-50 border-b border-border/50 flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.categoriaColor }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{s.nombre}</div>
                <div className="text-xs text-muted">{s.categoriaNombre} · {s.tipoPago === "unico" ? "Unico" : "Mensual"}</div>
              </div>
              <span className="text-sm font-medium">{formatCurrency(s.precioBase)}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted text-sm py-8">Sin resultados</p>}
        </div>
      </div>
    </div>
  );
}

function ServicioFormModal({
  servicio,
  categorias,
  onSave,
  onClose,
}: {
  servicio: Servicio | null;
  categorias: Categoria[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nombre: servicio?.nombre || "",
    descripcion: servicio?.descripcion || "",
    categoriaId: servicio?.categoriaId || "",
    tipoPago: servicio?.tipoPago || "unico",
    precioBase: servicio?.precioBase ?? 0,
    tiempoEntrega: servicio?.tiempoEntrega || "4 - 10 dias",
    entregablesDefault: servicio?.entregablesDefault?.join("\n") || "",
    variante: servicio?.variante || "",
    nivel: servicio?.nivel || "",
    fase: servicio?.fase ?? 1,
    orden: servicio?.orden ?? 0,
    activo: servicio?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const entregables = form.entregablesDefault
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean);
      await onSave({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        categoriaId: form.categoriaId || null,
        tipoPago: form.tipoPago,
        precioBase: Number(form.precioBase),
        tiempoEntrega: form.tiempoEntrega,
        entregablesDefault: entregables,
        variante: form.variante.trim() || null,
        nivel: form.nivel.trim() || null,
        fase: form.fase,
        orden: form.orden,
        activo: form.activo,
      });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">{servicio ? "Editar Servicio" : "Nuevo Servicio"}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={(e) => update("nombre", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripcion</label>
            <textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={form.categoriaId} onChange={(e) => update("categoriaId", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Sin categoria</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Pago</label>
              <select value={form.tipoPago} onChange={(e) => update("tipoPago", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="unico">Unico</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Precio Base</label>
              <input type="number" value={form.precioBase} onChange={(e) => update("precioBase", Number(e.target.value))} min={0} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fase</label>
              <select value={form.fase} onChange={(e) => update("fase", Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                {Object.entries(FASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiempo Entrega</label>
              <input type="text" value={form.tiempoEntrega} onChange={(e) => update("tiempoEntrega", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Entregables (uno por linea)</label>
            <textarea value={form.entregablesDefault} onChange={(e) => update("entregablesDefault", e.target.value)} rows={4} placeholder="Entregable 1&#10;Entregable 2&#10;..." className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nivel</label>
              <select value={form.nivel} onChange={(e) => update("nivel", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Sin nivel</option>
                <option value="Emprendedor">Emprendedor</option>
                <option value="PYME">PYME</option>
                <option value="Empresario">Empresario</option>
                <option value="Corporativo">Corporativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Variante</label>
              <input type="text" value={form.variante} onChange={(e) => update("variante", e.target.value)} placeholder="Ej: WooCommerce, Shopify..." className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Orden</label>
              <input type="number" value={form.orden} onChange={(e) => update("orden", Number(e.target.value))} min={0} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={(e) => update("activo", e.target.checked)} className="rounded border-border" />
            Activo
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nombre.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-dark">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {servicio ? "Guardar Cambios" : "Crear Servicio"}
          </button>
        </div>
      </div>
    </div>
  );
}
