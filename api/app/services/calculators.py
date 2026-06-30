from __future__ import annotations

from datetime import date, datetime


IVA_RATE = 0.16

# Tarifa por hora sugerida para partidas personalizadas (Hora Centinela).
TARIFA_HORA_DEFAULT = 700

# Modelos de cobro de una partida (espejo del frontend TS).
# "demanda" = tarifa por hora sin horas comprometidas; precio=0, no suma al total
# (se factura a fin de mes segun consumo).
MODELOS_COBRO: dict[str, str] = {
    "fijo": "Precio fijo",
    "horas": "Por horas",
    "retainer": "Retainer (minimo + adicionales)",
    "demanda": "Bajo demanda / por hora",
}

# Doble propuesta: cada partida va en la Opcion 1, la 2 o en ambas (espejo del TS).
OPCIONES = ("1", "2", "ambas")

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


def calcular_precio_horas(horas: float, tarifa_hora: float) -> float:
    return round((horas or 0) * (tarifa_hora or 0), 2)


def describir_retainer(monto_minimo: float, horas_incluidas: float, tarifa_hora: float) -> str:
    """Texto descriptivo de un retainer (espejo de describirRetainer en TS)."""
    partes = [f"{format_currency(monto_minimo or 0)}/mes"]
    if horas_incluidas:
        partes.append(f"incluye {horas_incluidas:g} hr")
    if tarifa_hora:
        partes.append(f"adicional {format_currency(tarifa_hora)}/hr (se factura aparte)")
    return " · ".join(partes)


def detalle_modelo(serv: dict) -> str:
    """Sub-linea de desglose por modelo de cobro (horas / retainer / demanda) para PDF/Excel."""
    modelo = serv.get("modeloCobro")
    if modelo == "retainer":
        return describir_retainer(
            serv.get("montoMinimo") or 0,
            serv.get("horasIncluidas") or 0,
            serv.get("tarifaHora") or 0,
        )
    if modelo == "demanda":
        return f"{format_currency(serv.get('tarifaHora') or 0)}/hr · segun consumo"
    horas = serv.get("horas")
    tarifa = serv.get("tarifaHora")
    if (modelo == "horas" or serv.get("esPersonalizado")) and horas and tarifa:
        return f"{horas:g} h x {format_currency(tarifa)}/hr"
    return ""


def precio_display(serv: dict) -> str:
    """Texto a mostrar en la columna 'Precio'. Para 'demanda' muestra la tarifa/hr
    en vez de $0 (el precio real depende del consumo). Espejo de precioDisplay en TS."""
    if serv.get("modeloCobro") == "demanda":
        return f"{format_currency(serv.get('tarifaHora') or 0)}/hr"
    return format_currency(serv.get("precio") or 0)


def nota_demanda(servicios: list[dict]) -> str:
    """Nota al pie para las partidas 'bajo demanda': no suman al total comprometido y se
    facturan segun consumo. Devuelve '' si no hay. Espejo de notaDemanda en TS."""
    dem = [s for s in servicios if s.get("modeloCobro") == "demanda"]
    if not dem:
        return ""
    detalle = ", ".join(
        f"{s.get('nombre') or 'Servicio'} a {format_currency(s.get('tarifaHora') or 0)}/hr" for s in dem
    )
    return f"+ Horas facturadas a fin de mes segun consumo (no incluidas en el total): {detalle}."


def calcular_totales_opcion(servicios: list[dict], opcion: str) -> dict:
    """Totales de una opcion: suma sus partidas + las marcadas 'ambas'.

    Espejo de calcularTotalesOpcion en TS. Respeta la regla de retainer: el total
    usa `precio`, no `horas x tarifa`. Las horas son informativas.
    """
    rel = [s for s in servicios if s.get("opcion") == "ambas" or s.get("opcion") == opcion]
    total_unico = sum((s.get("precio") or 0) for s in rel if s.get("tipoPago") == "unico")
    total_mensual = sum((s.get("precio") or 0) for s in rel if s.get("tipoPago") == "mensual")
    horas = sum((s.get("horas") or 0) for s in rel)
    return {
        "totalUnico": round(total_unico, 2),
        "totalMensual": round(total_mensual, 2),
        "horas": round(horas, 2),
    }


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
