import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { nombre: true },
    });

  const catList = categorias.map((c) => c.nombre).join(" / ");

  const csv = `Nombre,Categoria,Fase,Tipo de Pago,Precio Base,Tiempo de Entrega,Entregables,Variante
"SEO On-Page Basico","SEO","Setup e Infraestructura","unico",5000,"7 - 14 dias","Auditoria SEO | Optimizacion de meta tags | Mapa del sitio",
"Manejo de Redes Sociales","Marketing","Publicidad y Manejo","mensual",8000,"Mensual","Publicaciones semanales | Reporte mensual | Gestion de comunidad","Basico"
"Gestion de Google Ads","Paid Media","Publicidad y Manejo","mensual",5000,"Mensual","Configuracion de campanas | Reporte semanal",
"Sitio Web Informativo","Desarrollo Web","Setup e Infraestructura","unico",15000,"15 - 30 dias","Diseno responsivo | Hasta 5 secciones | Formulario de contacto",
"Automatizacion Email Marketing","Automatizaciones","Publicidad y Manejo","unico",8000,"10 - 15 dias","Configuracion de flujos | Plantillas de correo | Integracion CRM",
"CRM Basico","CRM","Publicidad y Manejo","mensual",1000,"Mensual","CRM completo segun plan contratado","basico"

,,,,
"CATEGORIAS DISPONIBLES: ${catList}",,,,,
"FASES: Auditoria / Setup e Infraestructura / Publicidad y Manejo / Contenido y SEO",,,,,
"TIPOS DE PAGO: unico / mensual",,,,,
"ENTREGABLES: separar con | (pipe)",,,,,
"VARIANTE: opcional (ej: Basico, Estandar, Premium)",,,,,
`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=plantilla-catalogo.csv",
    },
  });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
