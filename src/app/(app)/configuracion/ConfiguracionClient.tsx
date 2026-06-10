"use client";

import { useState, useRef } from "react";
import { Save, Upload, Trash2, Loader2, Image } from "lucide-react";

const SECTIONS = [
  {
    title: "Branding",
    icon: "🎨",
    fields: [
      { key: "color_primario", label: "Color Primario", type: "color" },
      { key: "color_secundario", label: "Color Secundario", type: "color" },
    ],
    hasLogo: true,
  },
  {
    title: "Datos Fiscales",
    icon: "📋",
    fields: [
      { key: "razon_social", label: "Razon Social", type: "text" },
      { key: "rfc", label: "RFC", type: "text" },
      { key: "domicilio_fiscal", label: "Domicilio Fiscal", type: "text" },
    ],
  },
  {
    title: "Datos Bancarios Nacionales",
    icon: "🏦",
    fields: [
      { key: "cuenta_nacional", label: "Cuenta", type: "text" },
      { key: "clabe_interbancaria", label: "CLABE Interbancaria", type: "text" },
    ],
  },
  {
    title: "Datos Bancarios Internacionales",
    icon: "🌎",
    fields: [
      { key: "cuenta_internacional", label: "Transferencia Internacional (ABA)", type: "textarea" },
      { key: "cuenta_internacional_swift", label: "Transferencia Internacional (SWIFT)", type: "textarea" },
    ],
  },
  {
    title: "Configuracion del Sistema",
    icon: "⚙️",
    fields: [
      { key: "hora_centinela", label: "Precio Hora Centinela (MXN)", type: "text" },
      { key: "anualidad_hosting", label: "Anualidad Hosting (MXN)", type: "text" },
      { key: "iva", label: "IVA (decimal)", type: "text" },
    ],
  },
  {
    title: "Textos Legales",
    icon: "📜",
    fields: [
      { key: "terminos_condiciones", label: "Terminos y Condiciones", type: "textarea" },
      { key: "no_incluye", label: "Que No Incluye", type: "textarea" },
      { key: "notas_adicionales", label: "Notas Adicionales", type: "textarea" },
    ],
  },
];

export function ConfiguracionClient({ initial }: { initial: Record<string, string> }) {
  const [config, setConfig] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("El logo debe ser menor a 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      handleChange("logo_base64", `${file.type}:${base64}`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    handleChange("logo_base64", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert("Error al guardar");
      }
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Configuracion</h1>
          <p className="text-muted text-sm mt-1">Personaliza el branding y datos de tu empresa</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors font-medium text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : saved ? "Guardado!" : "Guardar Cambios"}
        </button>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-card-bg rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <span>{section.icon}</span>
              <h2 className="font-semibold">{section.title}</h2>
            </div>
            <div className="p-5 space-y-4">
              {section.hasLogo && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Logo de la Empresa</label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
                      {config.logo_base64 ? (
                        <img
                          src={config.logo_base64.includes(":") ? `data:${config.logo_base64.replace(":", ";base64,")}` : `data:image/png;base64,${config.logo_base64}`}
                          alt="Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Image className="w-8 h-8 text-muted" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Subir Logo
                        </button>
                        {config.logo_base64 && (
                          <button
                            onClick={handleRemoveLogo}
                            className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted">PNG, JPG, SVG o WebP. Maximo 500KB.</p>
                    </div>
                  </div>
                </div>
              )}
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-muted mb-1">{field.label}</label>
                  {field.type === "color" ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={config[field.key] || "#2563eb"}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={config[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-32 px-3 py-2 border border-border rounded-lg text-sm font-mono"
                      />
                      <div
                        className="w-8 h-8 rounded-full border border-border"
                        style={{ backgroundColor: config[field.key] || "#2563eb" }}
                      />
                    </div>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={config[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  ) : (
                    <input
                      type="text"
                      value={config[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
