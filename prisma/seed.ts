import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "cotizador_e3",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const adminHash = await hash("cee564F1.", 10);
  const asesorHash = await hash("asesor123", 10);

  await prisma.user.upsert({
    where: { email: "urieljareth@gmail.com" },
    update: { password: adminHash },
    create: {
      email: "urieljareth@gmail.com",
      password: adminHash,
      name: "Uriel Jareth Alvarado Ortiz",
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "asesor@urieljareth.com" },
    update: { password: asesorHash },
    create: {
      email: "asesor@urieljareth.com",
      password: asesorHash,
      name: "Lorena Soto",
      role: "asesor",
    },
  });

  // ── CATEGORIAS (must be created BEFORE servicios for FK) ──
  const categorias = [
    { nombre: "SEO", descripcion: "Optimizacion para motores de busqueda", color: "#10b981", orden: 1 },
    { nombre: "Marketing", descripcion: "Estrategia y marketing digital", color: "#6366f1", orden: 2 },
    { nombre: "Paid Media", descripcion: "Publicidad pagada en plataformas digitales", color: "#f59e0b", orden: 3 },
    { nombre: "Desarrollo Web", descripcion: "Diseno y desarrollo de sitios web y ecommerce", color: "#3b82f6", orden: 4 },
    { nombre: "Automatizaciones", descripcion: "Automatizacion de procesos y flujos de trabajo", color: "#8b5cf6", orden: 5 },
    { nombre: "CRM", descripcion: "Gestion de relaciones con clientes", color: "#ec4899", orden: 6 },
    { nombre: "Desarrollo Personalizado", descripcion: "Soluciones a medida y desarrollo custom", color: "#14b8a6", orden: 7 },
  ];

  const catMap: Record<string, string> = {};
  for (const cat of categorias) {
    const created = await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: { color: cat.color, orden: cat.orden },
      create: cat,
    });
    catMap[cat.nombre] = created.id;
  }

  const catAlias: Record<string, string> = {
    auditoria: "Marketing",
    estrategia: "Marketing",
    diseno: "Desarrollo Web",
    sitio_web: "Desarrollo Web",
    ecommerce: "Desarrollo Web",
    ads: "Paid Media",
    redes: "Marketing",
    seo: "SEO",
    contenido: "Marketing",
    crm: "CRM",
    acompanamiento: "Marketing",
    otros: "Desarrollo Personalizado",
  };

  const servicios = [
    {
      nombre: "Auditoria en Redes Sociales",
      descripcion: "Auditoria completa de presencia en redes sociales",
      fase: 0,
      tipoPago: "unico",
      precioBase: 2990,
      tiempoEntrega: "4 - 10 dias",
      categoria: "auditoria",
      orden: 1,
      entregablesDefault: [
        "Revision de presencia en redes sociales",
        "Analisis de contenido publicado",
        "Evaluacion de engagement",
        "Documento de Evaluacion Total de Auditoria",
        "Junta de Resultados",
      ],
    },
    {
      nombre: "Auditoria en Sitio Web",
      descripcion: "Auditoria tecnica y de rendimiento de sitio web",
      fase: 0,
      tipoPago: "unico",
      precioBase: 2990,
      tiempoEntrega: "4 - 10 dias",
      categoria: "auditoria",
      orden: 2,
      entregablesDefault: [
        "Seguridad de dominio (vulnerabilidades)",
        "Velocidad de sitio web (core web vital)",
        "Diseno responsivo",
        "Performance del sitio",
        "Revison de SEO On Page y Off Page",
        "Chequeo de listado del sitio en listas negras",
        "Chequeo de Malware y Codigo Malicioso",
        "Revision de Firewall en el Sitio",
        "Recomendaciones SEO",
        "Revision de Google Search Console",
        "Revision de pixeles de Google y FB Ads",
        "Documento de Evaluacion Total de Auditoria",
        "Junta de Resultados",
      ],
    },
    {
      nombre: "Auditoria en Ecommerce",
      descripcion: "Auditoria completa de tienda en linea",
      fase: 0,
      tipoPago: "unico",
      precioBase: 2990,
      tiempoEntrega: "4 - 10 dias",
      categoria: "auditoria",
      orden: 3,
      entregablesDefault: [
        "Revision de Seguridad de dominio",
        "Revision de Certificado SSL",
        "Revision de Metodos de Pago",
        "Revision de Metodos de Envio",
        "Revision de Velocidad de Sitio Web",
        "Revision de Categorizacion de Productos",
        "Revision de Filtrado de Productos",
        "Revision de Carritos Abandonados",
        "Revision de Correos Transaccionales",
        "Revision de Pasos de Checkout",
        "Documento de Evaluacion Total de Auditoria",
        "Junta de Resultados",
      ],
    },
    {
      nombre: "Auditoria de cuentas Google Ads y Meta Ads",
      descripcion: "Auditoria de cuentas publicitarias",
      fase: 0,
      tipoPago: "unico",
      precioBase: 2990,
      tiempoEntrega: "4 - 10 dias",
      categoria: "auditoria",
      orden: 4,
      entregablesDefault: [
        "Revision de Configuracion General de Google Ads",
        "Revision de Configuracion de Facebook/Instagram Ads",
        "Revision de la Segmentacion de Publicos Personalizados",
        "Revision de Configuracion de Campanas",
        "Revision de Configuracion de Grupo de Anuncios",
        "Revision de Conversiones y Eventos Personalizados",
        "Revision de Integracion e Implementacion de Pixeles",
        "Revision de Estrategia de Presupuesto",
        "Revision de Anuncios Graficos",
        "Revision de Extensiones en los Anuncios",
        "Documento de Evaluacion Total de Auditoria",
        "Junta de Resultados",
      ],
    },
    {
      nombre: "Estudio Digital de Mercado",
      descripcion: "Estudio completo de mercado digital",
      fase: 1,
      tipoPago: "unico",
      precioBase: 4900,
      tiempoEntrega: "4 - 10 dias",
      categoria: "estrategia",
      orden: 5,
      entregablesDefault: [
        "Estudio de Competencia Organica",
        "Estudio de Competencia Pagada",
        "Estudio de Demanda",
        "Estudio de Tendencia",
        "Estudio de Segmentacion de Mercado",
        "Junta de Analisis de Resultados y Conclusiones",
      ],
    },
    {
      nombre: "Diseno de Identidad Corporativa",
      descripcion: "Creacion de identidad corporativa completa",
      fase: 1,
      tipoPago: "unico",
      precioBase: 11900,
      tiempoEntrega: "7 - 15 dias",
      categoria: "diseno",
      orden: 6,
      entregablesDefault: [
        "Creacion de Logotipo y Favicon",
        "Manual de Identidad Corporativa (colores, tipografias, usos)",
        "Plantillas para Redes Sociales (posts, historias, carruseles)",
        "Plantilla para portada de Redes Sociales",
        "Entrega de archivos editables",
        "Entrega de Mockups",
        "Aplicativos Digitales (firma electronica, diapositivas, wallpaper)",
        "Aplicativos Fisicos (tarjetas, hojas membretadas)",
        "Presentacion de Propuestas",
        "Tres juntas de revision",
      ],
    },
    {
      nombre: "Diseno de Sitio Web (WordPress)",
      descripcion: "Diseno y desarrollo de sitio web en WordPress",
      fase: 1,
      tipoPago: "unico",
      precioBase: 35000,
      tiempoEntrega: "4 - 8 semanas",
      categoria: "sitio_web",
      variante: "wordpress",
      orden: 7,
      entregablesDefault: [
        "Desarrollo y Estructuracion Jerarquica de Sitio Web",
        "Creacion de Paginas Basicas (TyC, PyP, Gracias, 404)",
        "Optimizacion Avanzada SEO en cada Pagina",
        "Sitio adaptado a ordenadores, tabletas y celulares (responsive)",
        "Configuracion Avanzada de Velocidad de Carga",
        "Diseno y Optimizacion de elementos graficos",
        "Integracion y Configuracion de Contacto por WhatsApp y Llamada",
        "Configuracion de Plugins de Seguridad",
        "Capacitacion Basica de Sitio",
        "Poliza de mantenimiento",
        "Respaldo de seguridad semanal",
        "Creacion y Optimizacion de Blog optimizado para SEO",
        "Integracion de Formulario",
        "Documento Estadisticas de Sitio Web (mensual)",
        "Indexacion en Motores de Busqueda",
        "Configuracion de Google Analytics 4, Tag Manager, Google Ads, Pixel y Capi de Facebook",
        "Configuracion de Google Search Console",
        "Revision de TyC, Politicas y Privacidad",
        "Creacion de Textos Comerciales",
        "Soporte de Primer y Segundo Nivel",
        "Dominio, Certificado SSL, Hosting Incluido (5GB) - 1 Ano",
        "Incluye tres revisiones del Proyecto",
      ],
    },
    {
      nombre: "Diseno de Ecommerce (WooCommerce)",
      descripcion: "Tienda en linea con WooCommerce",
      fase: 1,
      tipoPago: "unico",
      precioBase: 19900,
      tiempoEntrega: "4 - 8 semanas",
      categoria: "ecommerce",
      variante: "woocommerce",
      orden: 8,
      entregablesDefault: [
        "Desarrollo y Estructuracion de Ecommerce",
        "Creacion de Paginas Basicas (TyC, PyP, Gracias, 404)",
        "Optimizacion Avanzada SEO en cada Pagina de Productos y Categorias",
        "Diseno Responsivo (UI / UX)",
        "Configuracion Avanzada de Velocidad de Carga",
        "Diseno y Optimizacion de elementos graficos para cada Pagina",
        "Integracion y Configuracion de Contacto por WhatsApp y Llamada",
        "Integracion de Formulario",
        "Integracion de Plugins de Seguridad",
        "Capacitacion Basica de Sitio",
        "Integracion de Metodos de Pago",
        "Integracion de Metodos de Envio",
        "Configuracion Jerarquica de Categoria por Nivel",
        "Configuracion de Enlazado de Categorias",
        "Configuracion de Carritos Abandonados",
        "Documento Estadisticas de Sitio Web (mensual)",
        "Indexacion en Motores de Busqueda",
        "Configuracion de Google Analytics 4, Tag Manager, Google Ads, Pixel y Capi de Facebook para Ecommerce",
        "Configuracion de Google Search Console",
        "Incluye tres revisiones del Proyecto",
        "Dominio, Certificado SSL, Hosting Incluido (5GB) - 1 Ano",
        "Creacion de Textos Comerciales",
        "Desarrollo y Estructuracion de Blog",
      ],
    },
    {
      nombre: "Diseno Tienda en Linea (Shopify)",
      descripcion: "Tienda en linea con Shopify",
      fase: 1,
      tipoPago: "unico",
      precioBase: 21900,
      tiempoEntrega: "4 - 8 semanas",
      categoria: "ecommerce",
      variante: "shopify",
      orden: 9,
      entregablesDefault: [
        "Desarrollo y Estructuracion de Ecommerce",
        "Configuracion de Paginas Basicas (TyC, AyP, Contacto, Nosotros, 404)",
        "Configuracion de Paginas de Ecommerce (Mi cuenta, Inicio de sesion, Politicas)",
        "Configuracion y Personalizacion de Template",
        "Optimizacion SEO en cada Pagina de Productos y Categorias",
        "Diseno Responsivo (UI / UX)",
        "Configuracion de Velocidad de Carga en Sitio Web",
        "Diseno y Optimizacion de elementos graficos para cada Pagina",
        "Integracion y Configuracion de App de Contacto por WhatsApp",
        "Integracion de Apps para Metodos de Pago",
        "Integracion de Apps para Metodos de Envio",
        "Configuracion y Estructura de Menu Principal",
        "Soporte de Primer y Segundo Nivel",
        "Creacion de Categorias de Tienda",
        "Configuracion de Correos Base para Ecommerce",
        "Configuracion de Carritos Abandonados",
        "Indexacion en Motores de Busqueda",
        "Configuracion de Google Search Console",
        "Implementacion de Google Analytics 4",
        "Capi y Pixel de Facebook",
        "Creacion de Textos Comerciales",
        "Capacitacion Basica de Tienda",
        "Incluye tres revisiones del Proyecto",
        "Dominio",
      ],
    },
    {
      nombre: "Creacion y Optimizacion de Redes Sociales",
      descripcion: "Creacion y brandeo de perfiles en redes sociales",
      fase: 1,
      tipoPago: "unico",
      precioBase: 2500,
      tiempoEntrega: "4 - 10 dias",
      categoria: "redes",
      orden: 10,
      entregablesDefault: [
        "Creacion de Redes Sociales (Facebook, Instagram)",
        "Brandeo de las Redes y Optimizacion",
      ],
    },
    {
      nombre: "Creacion y Optimizacion de la Ficha de Google My Business",
      descripcion: "Configuracion y optimizacion de perfil de Google",
      fase: 1,
      tipoPago: "unico",
      precioBase: 2000,
      tiempoEntrega: "4 - 10 dias",
      categoria: "seo",
      orden: 11,
      entregablesDefault: [
        "Creacion y Configuracion de Perfil de Negocio de Google",
        "Optimizacion de Perfil de Negocio de Google",
        "Generacion de Mapas Fractales",
        "Plantillas para Publicaciones en Perfil de Negocio",
        "Reporte de resultados",
      ],
    },
    {
      nombre: "Configuracion y Puesta en Marcha del CRM Bucefalo",
      descripcion: "Configuracion inicial de cuenta CRM Bucefalo",
      fase: 1,
      tipoPago: "unico",
      precioBase: 3900,
      tiempoEntrega: "4 - 10 dias",
      categoria: "crm",
      orden: 12,
      entregablesDefault: [
        "Configuracion de cuenta CRM Bucefalo",
        "Curso de Capacitacion",
        "Configuracion de Automatizaciones",
        "Configuracion de Pipeline de Oportunidades",
        "Configuracion de Campos Personalizados",
        "Integracion de Calendario",
        "Configuracion de Reportes",
      ],
    },
    {
      nombre: "Configuracion, Optimizacion y Puesta en Marcha de Google Ads y Meta Ads",
      descripcion: "Setup completo de ambas plataformas publicitarias",
      fase: 1,
      tipoPago: "unico",
      precioBase: 4000,
      tiempoEntrega: "4 - 10 dias",
      categoria: "ads",
      orden: 13,
      entregablesDefault: [
        "Configuracion y estructura de las Campanas de Google Ads",
        "Configuracion de Conversiones",
        "Configuracion de la Segmentacion de Publicos Personalizados",
        "Configuracion de listas de terminos de busqueda negativos",
        "Configuracion de listas de terminos busqueda",
        "Configuracion de Anuncios publicitarios",
        "Configuracion de Extensiones en los anuncios",
        "Configuracion de Cuenta Facebook Ads e Instagram Ads",
        "Configuracion de Pixeles de Conversion",
        "Configuracion de Anuncios Publicitarios para Meta",
        "Configuracion de Conversiones Personalizadas",
      ],
    },
    {
      nombre: "Tablero de Inspiracion",
      descripcion: "Estrategia creativa para campanas publicitarias",
      fase: 2,
      tipoPago: "unico",
      precioBase: 2900,
      tiempoEntrega: "6 - 10 dias",
      categoria: "estrategia",
      orden: 14,
      entregablesDefault: [
        "Estrategia Creativa",
        "Segmentacion de Mercado",
        "Complexogramo",
        "Analisis de Competencia",
        "Analisis de los mejores Anuncios Locales, Nacionales e Internacionales",
      ],
    },
    {
      nombre: "Configuracion y Optimizacion Google Ads",
      descripcion: "Configuracion y optimizacion mensual de Google Ads",
      fase: 2,
      tipoPago: "mensual",
      precioBase: 4900,
      tiempoEntrega: "4 - 10 dias",
      categoria: "ads",
      orden: 15,
      entregablesDefault: [
        "Revision de la Segmentacion de Publicos Personalizados",
        "Revision de Listas de Terminos de Busqueda Negativos",
        "Revision de Listas de Terminos Busqueda",
        "Revision de Anuncios Publicitarios",
        "Revision de Anuncios Graficos",
        "Una Sesion de Acompanamiento para Google",
      ],
    },
    {
      nombre: "Manejo y Optimizacion de Meta Ads",
      descripcion: "Manejo y optimizacion mensual de Meta Ads",
      fase: 2,
      tipoPago: "mensual",
      precioBase: 1500,
      tiempoEntrega: "4 - 10 dias",
      categoria: "ads",
      orden: 16,
      entregablesDefault: [
        "Revision de la Configuracion de Conversiones",
        "Revision de la Segmentacion de Publicos Personalizados",
        "Revision de Conversiones Personalizadas",
        "Revision de Anuncios Publicitarios",
        "Una Sesion de Acompanamiento para la Creacion de Portafolio Comercial / Facebook",
      ],
    },
    {
      nombre: "Manejo Basico de Redes Sociales",
      descripcion: "Manejo mensual basico de redes sociales",
      fase: 2,
      tipoPago: "mensual",
      precioBase: 3000,
      tiempoEntrega: "4 - 10 dias",
      categoria: "redes",
      orden: 17,
      entregablesDefault: [
        "Realizacion de Parrilla, Diseno y Programacion",
        "3 - 5 Post Mensuales",
      ],
    },
    {
      nombre: "Plan Mensual CRM Bucefalo",
      descripcion: "Suscripcion mensual al CRM Bucefalo",
      fase: 2,
      tipoPago: "mensual",
      precioBase: 3900,
      tiempoEntrega: "Mensual",
      categoria: "crm",
      orden: 18,
      entregablesDefault: [
        "Uso completo del CRM segun plan contratado",
        "Soporte tecnico",
        "Actualizaciones del sistema",
      ],
    },
    {
      nombre: "Desarrollo de Plan de Contenido",
      descripcion: "Plan estrategico de contenido",
      fase: 3,
      tipoPago: "unico",
      precioBase: 2900,
      tiempoEntrega: "6 - 10 dias",
      categoria: "contenido",
      orden: 19,
      entregablesDefault: [
        "Analisis situacional de la marca",
        "Objetivos de la marca",
        "Analisis de Audiencia y Competencia",
        "Estrategias de Contenido",
        "Propuesta de Contenido",
        "Plan de Acciones",
        "Canales de Distribucion",
        "Medicion y Metricas",
      ],
    },
    {
      nombre: "Generacion de Contenido",
      descripcion: "Generacion mensual de contenido para redes",
      fase: 3,
      tipoPago: "mensual",
      precioBase: 8000,
      tiempoEntrega: "Mensual",
      categoria: "contenido",
      orden: 20,
      entregablesDefault: [
        "Manejo de Parrilla Mensual (Facebook, Instagram, Pinterest, YouTube, Tik Tok)",
        "Publicaciones Estaticas para Redes Sociales",
        "Post para Blog",
        "Video YouTube largo, Generacion de Reels, Shorts",
        "Escucha Social (analisis de opiniones de clientes)",
        "Junta de Reporte mensual",
      ],
    },
    {
      nombre: "Posicionamiento SEO",
      descripcion: "Posicionamiento SEO mensual",
      fase: 3,
      tipoPago: "mensual",
      precioBase: 2900,
      tiempoEntrega: "4 - 10 dias",
      categoria: "seo",
      orden: 21,
      entregablesDefault: [
        "Posicionamiento de KW (3 palabras clave)",
        "Traqueo de las Palabras Clave",
        "Creacion de Enlaces Externos al Sitio",
        "Citaciones para el Sitio",
        "Reporte de resultados (mensual)",
      ],
    },
    {
      nombre: "Estrategia SEO Completa",
      descripcion: "Estrategia SEO completa con contenido y backlinks",
      fase: 3,
      tipoPago: "mensual",
      precioBase: 2900,
      tiempoEntrega: "Mensual",
      categoria: "seo",
      orden: 22,
      entregablesDefault: [
        "Busqueda y definicion de KW a atacar",
        "Definicion de tematica y KW por Mes (calendario semestral)",
        "Monitoreo de posiciones en SERPS de KW",
        "Busqueda de backlinks de la competencia",
        "Gestion con medios y webs para el correcto enlazado",
        "Indexacion a Backlinks y monitoreo",
        "Generacion de contenido SEO para Post del blog o Landing",
        "Generacion de Imagenes y video para ilustracion",
        "Generacion de Url (post o Landing) para posicionamiento",
        "Optimizacion SEO de todas las Url nuevas",
        "Enlazado Interno de todo el sitio web",
        "Optimizacion de usabilidad del sitio",
        "Optimizacion de Copy",
        "Optimizacion de EEAT",
        "Optimizacion de enlazado interno",
        "Optimizacion de prominencia Semantica",
        "Reporte mensual",
      ],
    },
    {
      nombre: "Plan de Acompanamiento Integral",
      descripcion: "Servicio integral de acompanamiento estrategico y operativo durante un periodo minimo obligatorio de 9 meses (3 meses operando E3, 3 operando en conjunto y 3 meses operando en acompanamiento)",
      fase: 0,
      tipoPago: "mensual",
      precioBase: 9000,
      tiempoEntrega: "Minimo 9 meses",
      categoria: "acompanamiento",
      orden: 23,
      entregablesDefault: [
        "Manejo de Google Ads (Performance Max, Demand Gen, IA Max for Search)",
        "Implementacion con first-party data y third-party data",
        "Reportes mensuales con analisis de resultados Google Ads",
        "Manejo de Meta Ads (Advantage+, campanas por objetivo, remarketing dinamico)",
        "Segmentacion y automatizacion con IA",
        "Reportes mensuales con analisis de resultados Meta Ads",
      ],
    },
  ];

  for (const servicio of servicios) {
    const catNombre = catAlias[servicio.categoria] || "Desarrollo Personalizado";
    await prisma.servicioCatalogo.upsert({
      where: { id: servicio.nombre.toLowerCase().replace(/\s+/g, "-").substring(0, 30) + "-" + servicio.orden },
      update: {},
      create: {
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        fase: servicio.fase,
        tipoPago: servicio.tipoPago,
        precioBase: servicio.precioBase,
        tiempoEntrega: servicio.tiempoEntrega,
        entregablesDefault: servicio.entregablesDefault,
        categoriaId: catMap[catNombre] || null,
        variante: servicio.variante || null,
        orden: servicio.orden,
      },
    });
  }

  const allServicios = await prisma.servicioCatalogo.findMany();

  // ── PAQUETE GENERAL ──
  const paquete = await prisma.paquete.upsert({
    where: { id: "paquete-general" },
    update: {},
    create: {
      id: "paquete-general",
      nombre: "General",
      descripcion: "Paquete completo de servicios de marketing digital",
      activo: true,
    },
  });

  const fasesGeneral = [
    { nombre: "Auditoria / Acompanamiento", orden: 0 },
    { nombre: "Setup e Infraestructura", orden: 1 },
    { nombre: "Publicidad y Manejo", orden: 2 },
    { nombre: "Contenido y SEO", orden: 3 },
  ];

  const faseMap: Record<number, string> = {};
  for (const fg of fasesGeneral) {
    const faseId = `fase-general-${fg.orden}`;
    const created = await prisma.fasePaquete.upsert({
      where: { id: faseId },
      update: { nombre: fg.nombre, orden: fg.orden },
      create: {
        id: faseId,
        paqueteId: paquete.id,
        nombre: fg.nombre,
        orden: fg.orden,
      },
    });
    faseMap[fg.orden] = created.id;
  }

  const existingLinks = await prisma.servicioPaquete.findMany();
  if (existingLinks.length === 0) {
    for (const s of allServicios) {
      const fasePaqueteId = faseMap[s.fase];
      if (fasePaqueteId) {
        await prisma.servicioPaquete.create({
          data: {
            servicioCatalogoId: s.id,
            fasePaqueteId,
          },
        }).catch(() => {});
      }
    }
  }

  const bonos = [
    { numero: 1, titulo: "Servicio Centinela Web", descripcion: "30 minutos mensuales en servicios Centinela (Sitio Web)" },
    { numero: 2, titulo: "Workshop Buyer Persona", descripcion: "Workshop Estrategico de Buyer Persona" },
    { numero: 3, titulo: "Workshop Propuesta de Valor", descripcion: "Workshop de Propuestas de Valor y Oferta Irresistible" },
    { numero: 4, titulo: "Membresia Premium", descripcion: "1 ano de Membresia Premium" },
    { numero: 5, titulo: "Mes Gratis Bucefalo", descripcion: "Un mes gratis de Bucefalo CRM, Marketing y Ventas" },
    { numero: 6, titulo: "Script de Ventas", descripcion: "Script de Ventas con mas de 100 complementos" },
  ];

  for (const bono of bonos) {
    await prisma.bono.create({ data: bono });
  }

  const planes = [
    { meses: 3, tasa: 0.077, comision: 2.5, montoMinimo: 300, iva: 0.16 },
    { meses: 6, tasa: 0.107, comision: 2.5, montoMinimo: 600, iva: 0.16 },
    { meses: 9, tasa: 0.137, comision: 2.5, montoMinimo: 900, iva: 0.16 },
    { meses: 12, tasa: 0.167, comision: 2.5, montoMinimo: 1200, iva: 0.16 },
  ];

  for (const plan of planes) {
    await prisma.financiamientoPlan.upsert({
      where: { meses: plan.meses },
      update: {},
      create: plan,
    });
  }

  const configs = [
    {
      clave: "razon_social",
      valor: "URIEL JARETH ALVARADO ORTIZ",
    },
    {
      clave: "rfc",
      valor: "AAOU970201SU7",
    },
    {
      clave: "domicilio_fiscal",
      valor: "EMILIANO ZAPATA S/N, CUAMIO, CUITZEO, MICHOACAN DE OCAMPO CP 58855",
    },
    {
      clave: "cuenta_nacional",
      valor: "012227015788120440",
    },
    {
      clave: "clabe_interbancaria",
      valor: "012227015788120440",
    },
    {
      clave: "cuenta_internacional",
      valor: "Beneficiario: URIEL JARETH ALVARADO ORTIZ\nCLABE: 012227015788120440\nBanco: BBVA",
    },
    {
      clave: "cuenta_internacional_swift",
      valor: "Beneficiario: URIEL JARETH ALVARADO ORTIZ\nCodigo SWIFT / BIC: BCMRMXMMPYM\nCLABE: 012227015788120440\nBanco: BBVA Mexico",
    },
    {
      clave: "hora_centinela",
      valor: "700",
    },
    {
      clave: "anualidad_hosting",
      valor: "5000",
    },
    {
      clave: "iva",
      valor: "0.16",
    },
    {
      clave: "terminos_condiciones",
      valor: "- Esta cotizacion tiene una vigencia de 15 dias habiles.\n- Cualquier ajuste al proyecto despues de la aprobacion del contenido afectara la fecha de entrega y por consiguiente el costo.\n- El cliente debera proporcionar la informacion solicitada por Uriel Jareth Consulting en tiempo y forma.\n- Si la falta de informacion provoca un excedente en los plazos de entrega del proyecto, las horas adicionales de servicio se cotizaran por separado.\n- Los pagos correspondientes a los servicios mensuales deberan realizarse en los primeros 5 dias del mes.\n- Todo el material e informacion necesarios para la realizacion del sitio web deberan ser entregados en un plazo maximo de 40 dias naturales a partir del arranque del proyecto.",
    },
    {
      clave: "no_incluye",
      valor: "- Generacion de disenos, videos, traducciones, cambios de divisas y unidades, o cualquier servicio externo a lo cotizado. (Estos servicios son Extras, pueden ser realizados por E3 y se cotizan como adicionales mediante cotizacion).\n- Redaccion de entradas de Blog.\n- Integracion de Servicios de terceros ajenos a los cotizados.\n- Servicio de Recuperacion de Accesos de: Google Analytics, Google Tag Manager, Google Search Console, Google Ads, y Meta Ads (En Caso de Requerir el Servicio se Aplicara uso de Hora Centinela).\n- Creacion de Redes Sociales (En Caso de Requerir el Servicio Incluira un Costo Adicional).",
    },
    {
      clave: "notas_adicionales",
      valor: "- El presente proyecto debera tener un responsable oficial, a quien se le compartiran los avances y con quien se mantendra la comunicacion.\n- La Hora Centinela tiene un precio de $700.00 MXN.\n- Nuestros servicios incluyen la entrega de archivos finales listos para su uso (JPG, PNG, PDF, etc.). Los archivos editables/fuente (AI, PSD) son propiedad intelectual de la agencia y no estan incluidos, salvo en proyectos de Branding/Logotipos.\n- SI EL PROYECTO SE PAUSA POR RAZONES AJENAS A URIEL JARETH CONSULTING O FALTA DE CONTINUIDAD, ESTO GENERARA COSTO EXTRA PARA RETOMAR EL PROYECTO (SE CONSIDERARA UN COSTO QUE PUEDE IR DEL 15% AL 30% CON BASE A LA COTIZACION INICIAL).",
    },
    {
      clave: "color_primario",
      valor: "#2563eb",
    },
    {
      clave: "color_secundario",
      valor: "#1e293b",
    },
    {
      clave: "logo_base64",
      valor: "",
    },
  ];

  for (const config of configs) {
    await prisma.configuracion.upsert({
      where: { clave: config.clave },
      update: { valor: config.valor },
      create: config,
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
