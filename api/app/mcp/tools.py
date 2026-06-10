"""MCP (Model Context Protocol) tool definitions for the Cotizador API.

Each tool is designed to be semantically clear for AI agents like OpenClaw, Claude, and ChatGPT.
"""

TOOLS = [
    {
        "name": "buscar_servicios",
        "description": (
            "Busca servicios del catálogo de marketing digital de Consultoría E3. "
            "Útil cuando el cliente pregunta por servicios disponibles, precios, o por fase del proyecto. "
            "Las fases son: 0=Auditoría (diagnóstico inicial), 1=Setup (infraestructura y configuración), "
            "2=Publicidad (anuncios y manejo de redes), 3=Contenido/SEO (producción de contenido y posicionamiento). "
            "Tipos de pago: 'unico' (pago único) o 'mensual' (recurso recurrente)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "fase": {
                    "type": "integer",
                    "enum": [0, 1, 2, 3],
                    "description": "Fase del proyecto: 0=Auditoría/Acompañamiento, 1=Setup/Infraestructura, 2=Publicidad/Manejo, 3=Contenido/SEO",
                },
                "tipo_pago": {
                    "type": "string",
                    "enum": ["unico", "mensual"],
                    "description": "Tipo de pago: 'unico' para pago único, 'mensual' para recurrente",
                },
                "categoria": {
                    "type": "string",
                    "description": "Nombre de categoría: SEO, Marketing, Paid Media, Desarrollo Web, Automatizaciones, CRM, Desarrollo Personalizado",
                },
                "busqueda": {
                    "type": "string",
                    "description": "Texto libre para buscar en nombre y descripción del servicio",
                },
            },
        },
    },
    {
        "name": "crear_cotizacion",
        "description": (
            "Crea una cotización completa de servicios de marketing digital para un cliente. "
            "El cliente se crea automáticamente si no existe (busca por nombre+empresa). "
            "Incluye servicios del catálogo con precios personalizables, plan CRM Bucefalo opcional, "
            "y configuración de moneda y esquema de pago. "
            "La cotización se crea en estado 'borrador'. "
            "Precios CRM Bucefalo: basico=$1,000/mes, estandar=$3,500/mes, premium=$4,500/mes, empresarial=$7,500/mes. "
            "Soporta DOBLE PROPUESTA: con es_doble=true se presentan dos opciones comparables; cada servicio "
            "se asigna a la opción '1', '2' o 'ambas' (compartido), y opciones_metadata define el título, "
            "descripción y exclusiones de cada opción."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cliente": {
                    "type": "object",
                    "properties": {
                        "nombre": {"type": "string", "description": "Nombre completo del contacto"},
                        "empresa": {"type": "string", "description": "Nombre de la empresa (opcional)"},
                        "email": {"type": "string", "description": "Email de contacto"},
                        "telefono": {"type": "string", "description": "Teléfono de contacto"},
                    },
                    "required": ["nombre"],
                },
                "servicios": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "servicio_id": {"type": "string", "description": "ID del servicio del catálogo (obtener con buscar_servicios)"},
                            "precio_personalizado": {"type": "number", "description": "Precio personalizado (opcional, usa precio base si no se especifica)"},
                            "opcion": {"type": "string", "enum": ["1", "2", "ambas"], "description": "Solo en doble propuesta: opción a la que pertenece el servicio ('ambas' = compartido). Default 'ambas'."},
                        },
                        "required": ["servicio_id"],
                    },
                    "description": "Lista de servicios a incluir en la cotización",
                },
                "es_doble": {
                    "type": "boolean",
                    "description": "Si es true, la cotización presenta dos opciones comparables (doble propuesta).",
                },
                "opciones_metadata": {
                    "type": "object",
                    "description": "Solo en doble propuesta. Metadatos por opción, p.ej. {\"1\": {\"titulo\": \"...\", \"descripcion\": \"...\", \"noIncluye\": \"...\"}, \"2\": {...}}.",
                    "properties": {
                        "1": {"type": "object", "properties": {"titulo": {"type": "string"}, "descripcion": {"type": "string"}, "noIncluye": {"type": "string"}}},
                        "2": {"type": "object", "properties": {"titulo": {"type": "string"}, "descripcion": {"type": "string"}, "noIncluye": {"type": "string"}}},
                    },
                },
                "plan_bucefalo": {
                    "type": "string",
                    "enum": ["basico", "estandar", "premium", "empresarial"],
                    "description": "Nivel del plan CRM Bucefalo (opcional)",
                },
                "proyecto": {
                    "type": "string",
                    "description": "Nombre o descripción del proyecto (default: 'MKT Digital')",
                },
                "moneda": {
                    "type": "string",
                    "enum": ["MXN", "USD"],
                    "description": "Moneda de la cotización (default: MXN)",
                },
                "esquema_pago": {
                    "type": "string",
                    "enum": ["Pago Unico", "Mensual", "Pago Unico/Mensual"],
                    "description": "Esquema de pago (default: Pago Unico/Mensual)",
                },
            },
            "required": ["cliente", "servicios"],
        },
    },
    {
        "name": "obtener_cotizacion",
        "description": (
            "Obtiene los detalles completos de una cotización existente incluyendo: "
            "datos del cliente, servicios seleccionados con precios, estado actual, "
            "plan CRM Bucefalo si aplica, observaciones, fechas y vigencia."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cotizacion_id": {"type": "string", "description": "ID de la cotización"},
            },
            "required": ["cotizacion_id"],
        },
    },
    {
        "name": "listar_cotizaciones",
        "description": (
            "Lista cotizaciones con filtros opcionales. "
            "Útil para revisar el pipeline de ventas, cotizaciones pendientes, o historial de un cliente. "
            "Estados: borrador (en proceso), enviada (esperando respuesta), aprobada (cerrada ganada), rechazada (cerrada perdida)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "estado": {
                    "type": "string",
                    "enum": ["borrador", "enviada", "aprobada", "rechazada"],
                    "description": "Filtrar por estado",
                },
                "cliente_nombre": {
                    "type": "string",
                    "description": "Buscar por nombre de cliente",
                },
                "busqueda": {
                    "type": "string",
                    "description": "Texto libre para buscar en número, proyecto o cliente",
                },
            },
        },
    },
    {
        "name": "cambiar_estado_cotizacion",
        "description": (
            "Cambia el estado de una cotización. "
            "Flujo normal: borrador → enviada → aprobada o rechazada. "
            "Solo cambiar a 'enviada' cuando la cotización esté lista para el cliente. "
            "Cambiar a 'aprobada' cuando el cliente acepte, o 'rechazada' cuando decline."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cotizacion_id": {"type": "string", "description": "ID de la cotización"},
                "estado": {
                    "type": "string",
                    "enum": ["borrador", "enviada", "aprobada", "rechazada"],
                    "description": "Nuevo estado de la cotización",
                },
            },
            "required": ["cotizacion_id", "estado"],
        },
    },
    {
        "name": "actualizar_precio_servicio",
        "description": (
            "Actualiza el precio de un servicio específico dentro de una cotización. "
            "No modifica el precio base del catálogo, solo el precio en esta cotización. "
            "Útil para negociar precios individuales sin recrear toda la cotización."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cotizacion_id": {"type": "string", "description": "ID de la cotización"},
                "servicio_id": {"type": "string", "description": "ID del servicio cotizado (no el del catálogo)"},
                "nuevo_precio": {"type": "number", "description": "Nuevo precio en la moneda de la cotización"},
            },
            "required": ["cotizacion_id", "servicio_id", "nuevo_precio"],
        },
    },
    {
        "name": "duplicar_cotizacion",
        "description": (
            "Duplica una cotización existente como nueva copia en estado 'borrador'. "
            "Crea una copia exacta con nuevo ID y número. "
            "Útil para crear variaciones de una propuesta o reenviar una cotización actualizada."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cotizacion_id": {"type": "string", "description": "ID de la cotización a duplicar"},
            },
            "required": ["cotizacion_id"],
        },
    },
    {
        "name": "calcular_financiamiento",
        "description": (
            "Calcula las mensualidades para financiar una cotización o monto específico. "
            "Plazos disponibles: 3 meses (7.7% tasa), 6 meses (10.7%), 9 meses (13.7%), 12 meses (16.7%). "
            "Todos incluyen 2.5% de comisión + 16% IVA. "
            "Devuelve: pago mensual, IVA mensual, total mensual, comisión total, y gran total."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "monto": {"type": "number", "description": "Monto total a financiar en MXN"},
                "meses": {"type": "integer", "enum": [3, 6, 9, 12], "description": "Plazo en meses"},
            },
            "required": ["monto", "meses"],
        },
    },
    {
        "name": "generar_pdf_cotizacion",
        "description": (
            "Genera un PDF profesional de una cotización con: logo de la empresa, colores de marca, "
            "tabla de servicios agrupados por fase, bonos incluidos, términos y condiciones, "
            "y datos bancarios para transferencia. Devuelve el archivo PDF."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "cotizacion_id": {"type": "string", "description": "ID de la cotización guardada"},
            },
            "required": ["cotizacion_id"],
        },
    },
    {
        "name": "obtener_configuracion",
        "description": (
            "Obtiene la configuración de la empresa Consultoría E3: "
            "razón social, RFC, domicilio fiscal, datos bancarios (cuenta nacional, CLABE, cuenta internacional, SWIFT), "
            "colores de marca, logo, y términos y condiciones. "
            "Útil para generar documentos o verificar información fiscal."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "listar_bonos",
        "description": (
            "Lista los bonos/disponibles que se pueden incluir en una cotización: "
            "1) Servicio Centinela Web (monitoreo 30 min/mes), "
            "2) Workshop Buyer Persona, "
            "3) Workshop Propuesta de Valor, "
            "4) Membresía Premium (1 año), "
            "5) Mes Gratis CRM Bucefalo, "
            "6) Script de Ventas (100+ complementos)."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "listar_planes_bucefalo",
        "description": (
            "Lista los niveles del CRM Bucefalo con precios mensuales: "
            "Básico ($1,000/mes), Estándar ($3,500/mes), Premium ($4,500/mes), Empresarial ($7,500/mes). "
            "Bucefalo es un CRM para gestión de ventas y clientes."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
]

RESOURCES = [
    {
        "uri": "cotizador://servicios",
        "name": "Catálogo de Servicios",
        "description": (
            "Lista completa de servicios de marketing digital de Consultoría E3 organizados por fase: "
            "Fase 0 (Auditorías), Fase 1 (Setup/Infraestructura), Fase 2 (Publicidad/Manejo), "
            "Fase 3 (Contenido/SEO). Cada servicio incluye nombre, descripción, precio base, "
            "tiempo de entrega, tipo de pago (único/mensual), y entregables."
        ),
        "mimeType": "application/json",
    },
    {
        "uri": "cotizador://categorias",
        "name": "Categorías de Servicios",
        "description": (
            "Categorías disponibles para clasificar servicios: "
            "SEO, Marketing, Paid Media, Desarrollo Web, Automatizaciones, CRM, Desarrollo Personalizado."
        ),
        "mimeType": "application/json",
    },
    {
        "uri": "cotizador://configuracion",
        "name": "Configuración de la Empresa",
        "description": (
            "Datos fiscales, bancarios y de marca de Consultoría E3. "
            "Incluye razón social, RFC, domicilio fiscal, cuentas bancarias nacionales e internacionales, "
            "colores de marca, logo, y términos y condiciones."
        ),
        "mimeType": "application/json",
    },
]
