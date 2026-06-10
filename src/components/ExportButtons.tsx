"use client";

import { Eye, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
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

function PDFPreviewModal({
  url,
  filename,
  onClose,
}: {
  url: string;
  filename: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm truncate">{filename}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={url}
            download={filename}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50"
          >
            <FileDown className="w-4 h-4 text-red-600" />
            Descargar
          </a>
          <button
            onClick={onClose}
            aria-label="Cerrar previsualización"
            className="p-2 border border-border rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-4" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={url}
          title="Previsualización del PDF"
          className="w-full h-full rounded-lg bg-white border border-border"
        />
      </div>
    </div>
  );
}

function usePDFPreview() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);

  const open = async (fetcher: () => Promise<Response>, fallback: string) => {
    setLoading(true);
    try {
      const res = await fetcher();
      if (res.ok) {
        const filename = getFilenameFromHeaders(res.headers, fallback);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        setPreview({ url, filename });
      } else {
        alert("Error al generar la previsualización");
      }
    } catch {
      alert("Error al generar la previsualización");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (preview) window.URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return { loading, preview, open, close };
}

export function PreviewPDFButtonSaved({ cotizacionId }: { cotizacionId: string }) {
  const { loading, preview, open, close } = usePDFPreview();
  return (
    <>
      <button
        onClick={() =>
          open(() => fetch(`/api/export/pdf/${cotizacionId}`), "COTIZACION.pdf")
        }
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 text-blue-600" />}
        Previsualizar
      </button>
      {preview && (
        <PDFPreviewModal url={preview.url} filename={preview.filename} onClose={close} />
      )}
    </>
  );
}

export function PreviewPDFButtonDraft({ draft }: { draft: unknown }) {
  const { loading, preview, open, close } = usePDFPreview();
  return (
    <>
      <button
        onClick={() =>
          open(
            () =>
              fetch("/api/export/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ draft }),
              }),
            "COTIZACION.pdf"
          )
        }
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 text-blue-600" />}
        Previsualizar
      </button>
      {preview && (
        <PDFPreviewModal url={preview.url} filename={preview.filename} onClose={close} />
      )}
    </>
  );
}
