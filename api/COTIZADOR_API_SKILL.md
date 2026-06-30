# Cotizador — API Documentation for AI Skills

## Overview

REST API for Uriel Jareth Consulting's digital marketing quotation system. Allows AI agents to manage clients, browse service catalogs, create quotations, calculate financing, generate PDF/Excel documents, and manage the full sales pipeline.

**Base URL:** `http://localhost:8000`
**Auth:** API Key via `X-API-Key` header or `Authorization: Bearer <key>`
**Content-Type:** `application/json`
**OpenAPI Spec:** `GET /openapi.json` (no auth required)

---

## Domain Context

Uriel Jareth Consulting is a digital marketing agency in Querétaro, México. Services are organized in 4 project phases:

- **Fase 0 — Auditoría / Acompañamiento:** Initial assessments and ongoing consulting
- **Fase 1 — Setup e Infraestructura:** One-time setup (websites, branding, CRM config)
- **Fase 2 — Publicidad y Manejo:** Ongoing advertising and social media management
- **Fase 3 — Contenido y SEO:** Content creation and search engine optimization

Two payment types:
- **unico:** One-time payment
- **mensual:** Monthly recurring payment

Currency: MXN (Mexican Pesos) or USD. IVA (tax) rate: 16%.

---

## Authentication

### API Key (for agents)
```
X-API-Key: your-api-key-here
```
or
```
Authorization: Bearer your-api-key-here
```

### JWT (for human login)
```
POST /auth/login
Body: { "email": "user@example.com", "password": "secret" }
Response: { "user": { "id", "name", "email", "role" } }
Sets cookie: cotizador-session (httpOnly, 7 days)
```

---

## Endpoints Reference

### Health & Info

#### GET /health
Health check endpoint. No auth required.
- **Response:** `{ "status": "ok", "timestamp": "2026-05-03T..." }`

#### GET /api-info
API capabilities and version info.
- **Response:** `{ "name": "Cotizador API", "version": "1.0.0", "capabilities": [...] }`

---

### Clients (Clientes)

#### GET /clientes
List clients with optional search and pagination.
- **Query params:** `?q=texto&page=1&limit=50`
- **Response:** `{ "data": [Cliente], "meta": { "total", "page", "limit", "pages" } }`

#### POST /clientes
Create a new client.
- **Body:**
```json
{
  "nombre": "Juan Pérez",
  "empresa": "ACME Corp",
  "email": "juan@acme.com",
  "telefono": "4421234567"
}
```
- **Response (201):** Full Cliente object with `id`

#### GET /clientes/{id}
Get client details including recent quotations.
- **Response:** Cliente object + `cotizaciones` array

#### PUT /clientes/{id}
Update client information.
- **Body:** Same as POST (all fields optional for update)

#### DELETE /clientes/{id}
Delete client. Returns 409 if client has quotations.
- **Response (200):** `{ "ok": true }`
- **Error (409):** `{ "error": "Cliente tiene N cotizaciones asociadas" }`

---

### Service Catalog (Catálogo)

#### GET /catalogo
List all active services with optional filters.
- **Query params:** `?fase=0&tipoPago=mensual&categoriaId=xxx&q=seo`
- **Response:** Array of ServicioCatalogo objects

Each service:
```json
{
  "id": "cuid",
  "nombre": "Posicionamiento SEO",
  "descripcion": "...",
  "fase": 3,
  "tipoPago": "mensual",
  "precioBase": 2900,
  "tiempoEntrega": "7 - 14 dias",
  "entregablesDefault": ["Keyword research", "On-page optimization"],
  "categoriaId": "cuid",
  "variante": null,
  "activo": true,
  "orden": 0
}
```

#### POST /catalogo
Create a new service.
- **Body:**
```json
{
  "nombre": "Nuevo Servicio",
  "descripcion": "Descripción del servicio",
  "fase": 1,
  "tipoPago": "unico",
  "precioBase": 5000,
  "tiempoEntrega": "7 - 14 dias",
  "entregablesDefault": ["Entregable 1", "Entregable 2"],
  "categoriaId": "cuid",
  "variante": null,
  "orden": 0
}
```

#### GET /catalogo/{id}
Get service details with category info.

#### PUT /catalogo/{id}
Update service. Same body as POST.

#### DELETE /catalogo/{id}
Soft-delete if used in quotations, hard-delete otherwise.
- **Response:** `{ "ok": true, "archived": true|false }`

---

### Categories (Categorías)

Available: SEO (#10b981), Marketing (#6366f1), Paid Media (#f59e0b), Desarrollo Web (#3b82f6), Automatizaciones (#8b5cf6), CRM (#ec4899), Desarrollo Personalizado (#14b8a6)

#### GET /categorias
List all categories ordered by `orden`.

#### POST /categorias
- **Body:** `{ "nombre": "Nueva Cat", "descripcion": "...", "color": "#6b7280", "orden": 0 }`

#### GET /categorias/{id}
Get category with its services.

#### PUT /categorias/{id}
- **Body:** `{ "nombre", "descripcion", "color", "orden", "activo" }`

#### DELETE /categorias/{id}
Returns 409 if category has associated services.

---

### Quotations (Cotizaciones)

#### GET /cotizaciones
List quotations with filters.
- **Query params:** `?estado=borrador&asesorId=xxx&clienteId=xxx&q=texto&desde=2026-01-01&hasta=2026-12-31&page=1&limit=50`
- **Response:** Array with full relations (cliente, asesor, servicios+catalogo, planBucefalo)

#### POST /cotizaciones
Create a complete quotation. Auto-creates client if not found.
- **Body:**
```json
{
  "numero": "UJ2605AG001",
  "fecha": "2026-05-03",
  "vigencia": "2026-05-24",
  "moneda": "MXN",
  "tipoCambio": "NA",
  "proyecto": "MKT Digital",
  "esquemaPago": "Pago Unico/Mensual",
  "incluirBonos": false,
  "incluirFinanciamiento": false,
  "observaciones": "",
  "asesorId": "cuid",
  "cliente": {
    "nombre": "Juan Pérez",
    "empresa": "ACME Corp",
    "email": "juan@acme.com",
    "telefono": "4421234567"
  },
  "servicios": [
    {
      "catalogoId": "cuid",
      "nombre": "SEO On-Page",
      "fase": 3,
      "tipoPago": "mensual",
      "precio": 2900,
      "tiempoEntrega": "7 - 14 dias",
      "entregables": ["Keyword research", "On-page SEO"]
    }
  ],
  "planBucefalo": {
    "nivel": "basico",
    "precio": 1000
  }
}
```

#### GET /cotizaciones/{id}
Get quotation with all relations.

#### PUT /cotizaciones/{id}
Update quotation. Replaces all services in a transaction.
- **Body:** Same as POST without `numero` and `asesorId`. Optional `estado`.

#### DELETE /cotizaciones/{id}
Hard-delete with cascade.

#### PATCH /cotizaciones/{id}/precio
Update price of a single service.
- **Body:** `{ "servicioId": "cuid", "precio": 7500 }`

#### PATCH /cotizaciones/{id}/estado
Change quotation status.
- **Body:** `{ "estado": "enviada" }` — `borrador`, `enviada`, `aprobada`, `rechazada`

#### POST /cotizaciones/{id}/duplicate
Duplicate quotation as new copy in `borrador` state.

---

### Packages (Paquetes)

#### GET /paquetes
List active packages with nested phases and services.

#### POST /paquetes
- **Body:**
```json
{
  "nombre": "Paquete Básico",
  "descripcion": "...",
  "fases": [
    { "nombre": "Auditoría", "orden": 0 },
    { "nombre": "Setup", "orden": 1 }
  ]
}
```

#### GET /paquetes/{id}
Get package with full nested structure.

#### PUT /paquetes/{id}
- **Body:** `{ "nombre", "descripcion", "activo" }`

#### DELETE /paquetes/{id}
Hard-delete with cascade.

#### POST /paquetes/{id}/manage
Multi-action endpoint:
- `{ "action": "addFase", "nombre": "Fase 3", "orden": 2 }`
- `{ "action": "updateFase", "faseId": "cuid", "nombre": "New Name", "orden": 1 }`
- `{ "action": "deleteFase", "faseId": "cuid" }`
- `{ "action": "addServicio", "servicioCatalogoId": "cuid", "fasePaqueteId": "cuid" }`
- `{ "action": "removeServicio", "servicioCatalogoId": "cuid", "fasePaqueteId": "cuid" }`

---

### Configuration (Configuración)

Allowed keys: `color_primario`, `color_secundario`, `logo_base64`, `razon_social`, `rfc`, `domicilio_fiscal`, `cuenta_nacional`, `clabe_interbancaria`, `cuenta_internacional`, `cuenta_internacional_swift`, `hora_centinela`, `anualidad_hosting`, `iva`, `terminos_condiciones`, `no_incluye`, `notas_adicionales`

#### GET /configuracion
- **Response:** `{ "color_primario": "#2563eb", "razon_social": "...", ... }`

#### PUT /configuracion
Bulk upsert. Only whitelisted keys processed.
- **Body:** `{ "color_primario": "#ff0000", "razon_social": "Nuevo Nombre" }`

---

### Bonuses (Bonos)

Available: Centinela Web, Workshop Buyer Persona, Workshop Propuesta de Valor, Membresía Premium, Mes Gratis CRM, Script de Ventas

#### GET /bonos

---

### Financing (Financiamiento)

| Months | Rate | Commission | Min Amount |
|--------|------|------------|------------|
| 3 | 7.7% | 2.5% | $300 |
| 6 | 10.7% | 2.5% | $600 |
| 9 | 13.7% | 2.5% | $900 |
| 12 | 16.7% | 2.5% | $1,200 |

#### GET /financiamiento/planes

#### POST /financiamiento/calcular
- **Body:** `{ "monto": 50000, "meses": 6 }`
- **Response:** `{ "pagoMensual", "ivaMensual", "totalMensual", "comisionTotal", "granTotal" }`

#### GET /financiamiento/simulacion/{cotizacion_id}
Auto-calculate financing for existing quotation.

---

### Export

#### POST /export/pdf — PDF from draft data
#### GET /export/pdf/{id} — PDF from saved quotation
#### POST /export/excel — Excel from draft data
#### GET /export/excel/{id} — Excel from saved quotation
#### GET /export/catalogo — CSV of active services
#### GET /export/catalogo/plantilla — CSV import template

---

### Import

#### POST /import/catalogo
Bulk import services from CSV. `multipart/form-data` with `file` field.
- **Response:** `{ "creados": 5, "omitidos": 2, "errores": [...] }`

---

## Business Rules

### Quotation Number
Format: `UJ{YY}{MM}{AsesorInitials}{sequence}` — e.g., `UJ2605AG001`

### Quotation Validity
15 business days from issue (excludes Sat/Sun).

### CRM Bucefalo Plans
basico=$1,000/mes, estandar=$3,500/mes, premium=$4,500/mes, empresarial=$7,500/mes

### Client Deduplication
Matched by `(nombre, empresa)` pair.

### Service Soft-Delete
If referenced by quotations → `activo=false`. Otherwise hard-delete.

### Financing Formula
```
comisionTotal = monto × comision%
montoConComision = monto + comisionTotal
pagoMensual = montoConComision × (1 + tasa) / meses
ivaMensual = pagoMensual × 0.16
totalMensual = pagoMensual + ivaMensual
granTotal = totalMensual × meses
```

---

## Common Responses

### Success (paginated)
```json
{
  "data": [...],
  "meta": { "total": 45, "page": 1, "limit": 50, "pages": 1 }
}
```

### Error
```json
{ "error": "Message", "detail": "Details", "code": "ERROR_CODE" }
```

### HTTP Codes
200=OK, 201=Created, 204=No Content, 400=Bad Request, 401=Unauthorized, 404=Not Found, 409=Conflict, 500=Server Error

---

## Agent Workflows

### Create quotation
```
1. GET /catalogo?fase=0          → audit services
2. GET /catalogo?fase=1          → setup services
3. GET /catalogo?fase=2&tipoPago=mensual → ongoing services
4. POST /financiamiento/calcular → simulate payments
5. POST /cotizaciones            → create quotation
6. GET /export/pdf/{id}          → generate PDF
```

### Review pipeline
```
1. GET /cotizaciones?estado=borrador  → pending
2. GET /cotizaciones?estado=enviada   → awaiting
3. GET /cotizaciones?estado=aprobada  → won
```

### Negotiate price
```
1. GET /cotizaciones/{id}          → current state
2. PATCH /cotizaciones/{id}/precio → adjust price
3. GET /export/pdf/{id}            → regenerate PDF
```

---

## MCP Integration

MCP server at `/mcp` for OpenClaw, Claude, ChatGPT.

### Tools
| Tool | Description |
|------|-------------|
| `buscar_servicios` | Search catalog by phase, payment type, category, text |
| `crear_cotizacion` | Create complete quotation in one call |
| `obtener_cotizacion` | Get quotation details |
| `listar_cotizaciones` | List with filters |
| `cambiar_estado_cotizacion` | Change status |
| `actualizar_precio_servicio` | Adjust service price |
| `duplicar_cotizacion` | Clone as draft |
| `calcular_financiamiento` | Calculate payments |
| `generar_pdf_cotizacion` | Generate PDF |
| `obtener_configuracion` | Company config |
| `listar_bonos` | Available bonuses |
| `listar_planes_bucefalo` | CRM plans |

### Resources
| Resource | Description |
|----------|-------------|
| `cotizador://servicios` | Full catalog |
| `cotizador://categorias` | Categories |
| `cotizador://configuracion` | Company config |

---

## Environment

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=cotizador_e3
API_KEY=your-secret-api-key
JWT_SECRET=your-jwt-secret
```

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
# OpenAPI: http://localhost:8000/openapi.json
```
