"""Cotizador — FastAPI Application

REST API + MCP Server for digital marketing quotation management.
Optimized for n8n workflows and AI agents (OpenClaw, Claude, ChatGPT).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="Cotizador API",
    description=(
        "API REST para el sistema de cotizaciones de marketing digital de Uriel Jareth Consulting. "
        "Optimizada para integración con n8n y agentes de IA (OpenClaw, Claude, ChatGPT) "
        "via MCP (Model Context Protocol)."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "Health", "description": "Health check y información de la API"},
        {"name": "Auth", "description": "Autenticación (API Key + JWT)"},
        {"name": "Clientes", "description": "Gestión de clientes"},
        {"name": "Catálogo", "description": "Catálogo de servicios de marketing digital"},
        {"name": "Categorías", "description": "Categorías de servicios"},
        {"name": "Cotizaciones", "description": "Cotizaciones — CRUD completo con servicios y plan CRM"},
        {"name": "Paquetes", "description": "Paquetes de servicios con fases"},
        {"name": "Configuración", "description": "Configuración de la empresa (key-value)"},
        {"name": "Bonos", "description": "Bonos disponibles para cotizaciones"},
        {"name": "Financiamiento", "description": "Planes y cálculo de financiamiento"},
        {"name": "Export", "description": "Exportación de PDF, Excel y CSV"},
        {"name": "Import", "description": "Importación masiva de servicios"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Error interno del servidor", "detail": str(exc)},
    )


# Register routers
from app.routers import (
    auth,
    bonos,
    catalogo,
    categorias,
    clientes,
    configuracion,
    cotizaciones,
    export_,
    financiamiento,
    health,
    import_,
    paquetes,
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(catalogo.router)
app.include_router(categorias.router)
app.include_router(cotizaciones.router)
app.include_router(paquetes.router)
app.include_router(configuracion.router)
app.include_router(bonos.router)
app.include_router(financiamiento.router)
app.include_router(export_.router)
app.include_router(import_.router)

# Mount MCP server
try:
    from app.mcp.server import server as mcp_server

    from mcp.server.streamable_http import StreamableHTTPServerTransport

    @app.post("/mcp")
    async def mcp_endpoint(request: Request):
        """MCP (Model Context Protocol) endpoint for AI agents."""
        transport = StreamableHTTPServerTransport(mcp_server)
        return await transport.handle_request(request)

    @app.get("/mcp")
    async def mcp_info():
        """MCP server info. Use POST for actual MCP communication."""
        return {
            "name": "cotizador-e3",
            "version": "1.0.0",
            "protocol": "mcp",
            "description": "MCP server for Cotizador quotation system",
        }
except ImportError:
    # MCP SDK not installed, skip MCP mount
    pass


@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": "Cotizador API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
        "mcp": "/mcp",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
