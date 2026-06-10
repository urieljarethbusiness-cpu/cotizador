from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, UploadFile
from asyncpg import Connection

from app.dependencies import get_db
from app.auth import require_auth

router = APIRouter(prefix="/import", tags=["Import"])

REQUIRED_COLUMNS = {"nombre", "fase", "tipoPago", "precioBase", "categoria"}


@router.post("/catalogo")
async def import_catalogo_csv(
    file: UploadFile = File(...),
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        return {
            "creados": 0,
            "omitidos": 0,
            "errores": [f"Missing required columns: {', '.join(missing)}"],
        }

    categorias = await db.fetch('SELECT id, nombre FROM "Categoria" WHERE activo = true')
    cat_map = {r["nombre"]: r["id"] for r in categorias}

    existing = await db.fetch('SELECT nombre FROM "ServicioCatalogo" WHERE activo = true')
    existing_names = {r["nombre"] for r in existing}

    creados = 0
    omitidos = 0
    errores: list[str] = []

    async with db.transaction():
        for i, row in enumerate(reader, start=2):
            nombre = (row.get("nombre") or "").strip()
            if not nombre:
                omitidos += 1
                continue

            if nombre in existing_names:
                omitidos += 1
                continue

            cat_nombre = (row.get("categoria") or "").strip()
            cat_id = cat_map.get(cat_nombre)
            if not cat_id:
                errores.append(f"Row {i}: category '{cat_nombre}' not found")
                continue

            try:
                fase = int(row.get("fase", "0"))
                if fase not in (0, 1, 2, 3):
                    raise ValueError
            except (ValueError, TypeError):
                errores.append(f"Row {i}: invalid fase '{row.get('fase')}'")
                continue

            tipo_pago = (row.get("tipoPago") or "").strip()
            if tipo_pago not in ("unico", "mensual"):
                errores.append(f"Row {i}: invalid tipoPago '{tipo_pago}'")
                continue

            try:
                precio = float(row.get("precioBase", "0"))
            except (ValueError, TypeError):
                errores.append(f"Row {i}: invalid precioBase '{row.get('precioBase')}'")
                continue

            tiempo = (row.get("tiempoEntrega") or "7 - 14 dias").strip()
            variante = (row.get("variante") or "").strip() or None
            try:
                orden = int(row.get("orden", "0"))
            except (ValueError, TypeError):
                orden = 0

            entregables_raw = (row.get("entregablesDefault") or "").strip()
            entregables = [e.strip() for e in entregables_raw.split(";") if e.strip()] if entregables_raw else []

            await db.execute(
                """
                INSERT INTO "ServicioCatalogo"
                    (id, nombre, descripcion, fase, "tipoPago", "precioBase",
                     "tiempoEntrega", "entregablesDefault", "categoriaId",
                     variante, orden, activo, "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now(), now())
                """,
                nombre,
                (row.get("descripcion") or "").strip() or None,
                fase,
                tipo_pago,
                precio,
                tiempo,
                entregables if entregables else None,
                cat_id,
                variante,
                orden,
            )
            existing_names.add(nombre)
            creados += 1

    return {"creados": creados, "omitidos": omitidos, "errores": errores}
