import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ParsedRow {
  nombre: string;
  categoria: string;
  fase: number;
  tipoPago: string;
  precioBase: number;
  tiempoEntrega: string;
  entregables: string[];
  variante: string | null;
}

const FASES_MAP: Record<string, number> = {
  auditoria: 0,
  "setup e infraestructura": 1,
  setup: 1,
  infraestructura: 1,
  "publicidad y manejo": 2,
  publicidad: 2,
  manejo: 2,
  "contenido y seo": 3,
  contenido: 3,
  seo: 3,
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseRow(fields: string[]): ParsedRow | null {
  const [nombre, categoria, faseStr, tipoPago, precioStr, tiempoEntrega, entregablesStr, variante] = fields;

  if (!nombre || !categoria || !tipoPago || !precioStr) return null;

  const faseKey = faseStr.toLowerCase().trim();
  const fase = FASES_MAP[faseKey];
  if (fase === undefined) return null;

  const tipo = tipoPago.toLowerCase().trim();
  if (tipo !== "unico" && tipo !== "mensual") return null;

  const precioBase = parseFloat(precioStr);
  if (isNaN(precioBase) || precioBase < 0) return null;

  return {
    nombre,
    categoria,
    fase,
    tipoPago: tipo,
    precioBase,
    tiempoEntrega: tiempoEntrega || "7 - 14 dias",
    entregables: entregablesStr
      ? entregablesStr.split("|").map((e) => e.trim()).filter(Boolean)
      : [],
    variante: variante || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibio archivo" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('"CATEGORIAS') && !l.trim().startsWith('"FASES') && !l.trim().startsWith('"TIPOS') && !l.trim().startsWith('"ENTREGABLES') && !l.trim().startsWith('"VARIANTE'));

    if (lines.length < 2) {
      return NextResponse.json({ error: "El CSV esta vacio o no tiene datos" }, { status: 400 });
    }

    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    });
    const catMap = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c.id]));

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      if (fields.length < 5) continue;
      const row = parseRow(fields);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron filas validas. Verifica el formato del CSV." },
        { status: 400 }
      );
    }

    let creados = 0;
    let omitidos = 0;
    const errores: string[] = [];

    const maxOrden = await prisma.servicioCatalogo.aggregate({ _max: { orden: true } });
    let nextOrden = (maxOrden._max.orden || 0) + 1;

    const toCreate: { nombre: string; fase: number; tipoPago: string; precioBase: number; tiempoEntrega: string; entregablesDefault: string[]; variante: string | null; categoriaId: string; orden: number; activo: boolean }[] = [];

    for (const row of rows) {
      const categoriaId = catMap.get(row.categoria.toLowerCase());
      if (!categoriaId) {
        errores.push(`"${row.nombre}": categoria "${row.categoria}" no encontrada`);
        omitidos++;
        continue;
      }

      toCreate.push({
        nombre: row.nombre,
        fase: row.fase,
        tipoPago: row.tipoPago,
        precioBase: row.precioBase,
        tiempoEntrega: row.tiempoEntrega,
        entregablesDefault: row.entregables,
        variante: row.variante,
        categoriaId,
        orden: nextOrden++,
        activo: true,
      });
    }

    if (toCreate.length > 0) {
      await prisma.servicioCatalogo.createMany({ data: toCreate });
    }
    creados = toCreate.length;

    return NextResponse.json({
      creados,
      omitidos,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
