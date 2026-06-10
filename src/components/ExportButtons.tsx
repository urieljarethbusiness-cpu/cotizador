"use client";

import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";

function getFilenameFromHeaders(headers: Headers, fallback: string): string {
  const cd = headers.get("Content-Disposition");
  if (cd) {
    const match = cd.match(/filename="?(.+?)"?$/);
    if (match) return match[1];
  }
  return fallback;
}

function useFileExport() {
  const [loading, setLoading] = useState(false);

  const download = async (url: string, fallback: string) => {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const filename = getFilenameFromHeaders(res.headers, fallback);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        alert("Error al exportar");
      }
    } catch {
      alert("Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  const downloadPost = async (url: string, body: unknown, fallback: string) => {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const filename = getFilenameFromHeaders(res.headers, fallback);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        alert("Error al exportar");
      }
    } catch {
      alert("Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  return { loading, download, downloadPost };
}

export function ExportExcelButtonSaved({ cotizacionId }: { cotizacionId: string }) {
  const { loading, download } = useFileExport();
  return (
    <button
      onClick={() => download(`/api/export/excel/${cotizacionId}`, "COTIZACION.xlsx")}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
      Excel
    </button>
  );
}

export function ExportPDFButtonSaved({ cotizacionId }: { cotizacionId: string }) {
  const { loading, download } = useFileExport();
  return (
    <button
      onClick={() => download(`/api/export/pdf/${cotizacionId}`, "COTIZACION.pdf")}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-red-600" />}
      PDF
    </button>
  );
}

export function ExportExcelButtonDraft({ draft }: { draft: unknown }) {
  const { loading, downloadPost } = useFileExport();
  return (
    <button
      onClick={() => downloadPost("/api/export/excel", { draft }, "COTIZACION.xlsx")}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
      Excel
    </button>
  );
}

export function ExportPDFButtonDraft({ draft }: { draft: unknown }) {
  const { loading, downloadPost } = useFileExport();
  return (
    <button
      onClick={() => downloadPost("/api/export/pdf", { draft }, "COTIZACION.pdf")}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-red-600" />}
      PDF
    </button>
  );
}
