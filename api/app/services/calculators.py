from __future__ import annotations

from datetime import date, datetime


IVA_RATE = 0.16

FASES: dict[int, str] = {
    0: "FASE 0 - Auditoria / Acompanamiento",
    1: "FASE 1 - Setup e Infraestructura",
    2: "FASE 2 - Publicidad y Manejo",
    3: "FASE 3 - Contenido y SEO",
}

FASES_SHORT: dict[int, str] = {
    0: "FASE 0 - Auditoria",
    1: "FASE 1 - Setup e Infraestructura",
    2: "FASE 2 - Publicidad y Manejo",
    3: "FASE 3 - Contenido y SEO",
}

PLANES_BUCEFALO = [
    {"nivel": "basico", "label": "Basico", "precio": 1000},
    {"nivel": "estandar", "label": "Estandar", "precio": 3500},
    {"nivel": "premium", "label": "Premium", "precio": 4500},
    {"nivel": "empresarial", "label": "Empresarial", "precio": 7500},
]

ESTADOS_COTIZACION = ["borrador", "enviada", "aprobada", "rechazada"]

FINANCIAMIENTO_PLANES = [
    {"meses": 3, "tasa": 0.077, "comision": 2.5, "montoMinimo": 300},
    {"meses": 6, "tasa": 0.107, "comision": 2.5, "montoMinimo": 600},
    {"meses": 9, "tasa": 0.137, "comision": 2.5, "montoMinimo": 900},
    {"meses": 12, "tasa": 0.167, "comision": 2.5, "montoMinimo": 1200},
]

BONOS = [
    {"id": "bono-1", "numero": 1, "titulo": "Servicio Centinela Web", "descripcion": "Monitoreo web 30 min/mes", "activo": True},
    {"id": "bono-2", "numero": 2, "titulo": "Workshop Buyer Persona", "descripcion": "Taller de definición de buyer persona", "activo": True},
    {"id": "bono-3", "numero": 3, "titulo": "Workshop Propuesta de Valor", "descripcion": "Taller de propuesta de valor", "activo": True},
    {"id": "bono-4", "numero": 4, "titulo": "Membresia Premium", "descripcion": "Membresía premium por 1 año", "activo": True},
    {"id": "bono-5", "numero": 5, "titulo": "Mes Gratis Bucefalo CRM", "descripcion": "Un mes gratis del CRM Bucefalo", "activo": True},
    {"id": "bono-6", "numero": 6, "titulo": "Script de Ventas", "descripcion": "Script de ventas con 100+ complementos", "activo": True},
]


def bucefalo_precio(nivel: str) -> float:
    for p in PLANES_BUCEFALO:
        if p["nivel"] == nivel:
            return float(p["precio"])
    return 0.0


def calcular_vigencia(fecha: datetime | date) -> datetime:
    if isinstance(fecha, datetime):
        vigencia = fecha.replace()
    else:
        vigencia = datetime.combine(fecha, datetime.min.time())
    dias_habiles = 0
    while dias_habiles < 15:
        vigencia = vigencia.replace(day=vigencia.day + 1) if vigencia.day < 28 else vigencia + __import__("datetime").timedelta(days=1)
        vigencia = vigencia + __import__("datetime").timedelta(days=1)
        dia = vigencia.weekday()
        if dia < 5:
            dias_habiles += 1
    return vigencia


def calcular_financiamiento(monto: float, meses: int, tasa: float, comision: float, iva: float = IVA_RATE) -> dict:
    comision_total = (monto * comision) / 100
    monto_con_comision = monto + comision_total
    pago_mensual = monto_con_comision * (1 + tasa) / meses
    iva_mensual = pago_mensual * iva
    total_mensual = pago_mensual + iva_mensual
    return {
        "pagoMensual": round(pago_mensual, 2),
        "ivaMensual": round(iva_mensual, 2),
        "totalMensual": round(total_mensual, 2),
        "comisionTotal": round(comision_total, 2),
        "granTotal": round(total_mensual * meses, 2),
    }


def generar_numero_cotizacion(iniciales: str, secuencia: int) -> str:
    now = datetime.now()
    yy = str(now.year)[-2:]
    mm = f"{now.month:02d}"
    seq = f"{secuencia:03d}"
    return f"UJ{yy}{mm}{iniciales}{seq}"


def sanitize_filename(name: str) -> str:
    import re
    name = re.sub(r"[^\w\s.\-]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def format_currency(amount: float) -> str:
    return f"${amount:,.2f}"


def format_date(d: datetime | date) -> str:
    return f"{d.day:02d}/{d.month:02d}/{d.year}"
