import { prisma } from "./db";

export async function getConfigBranding() {
  try {
    const configs = await prisma.configuracion.findMany({
      where: { clave: { in: ["color_primario", "color_secundario", "logo_base64"] } },
    });
    const map: Record<string, string> = {};
    for (const c of configs) map[c.clave] = c.valor;
    return {
      colorPrimario: map.color_primario || undefined,
      colorSecundario: map.color_secundario || undefined,
      logoBase64: map.logo_base64 ? (map.logo_base64.includes(":") ? map.logo_base64.split(":").slice(1).join(":") : map.logo_base64) : undefined,
      logoMime: map.logo_base64 ? (map.logo_base64.includes(":") ? map.logo_base64.split(":")[0] : "image/png") : undefined,
    };
  } catch {
    return {};
  }
}

export async function getConfigBancaria() {
  try {
    const configs = await prisma.configuracion.findMany({
      where: {
        clave: {
          in: [
            "razon_social",
            "rfc",
            "domicilio_fiscal",
            "cuenta_nacional",
            "clabe_interbancaria",
            "cuenta_internacional",
            "cuenta_internacional_swift",
            "hora_centinela",
            "terminos_condiciones",
            "no_incluye",
            "notas_adicionales",
          ],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const c of configs) map[c.clave] = c.valor;
    return map;
  } catch {
    return {};
  }
}
