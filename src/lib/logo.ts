// Sistema dinamico de adaptacion del logo subido.
//
// El logo se guarda en Configuracion como "<mime>:<base64>" y puede venir en
// cualquier formato que el usuario suba (PNG, JPEG, WEBP, SVG, GIF...). Ni pdfkit
// ni exceljs soportan WEBP/SVG/GIF, asi que aqui normalizamos SIEMPRE a un Buffer
// PNG (lo unico que ambos renderizan de forma fiable). PNG pasa directo; cualquier
// otro formato se convierte con sharp.
//
// Devuelve undefined si no hay logo o si la conversion falla, para que el consumidor
// pueda caer a su placeholder sin romper la exportacion.

const PNG_PASSTHROUGH = "image/png";

export async function logoToPngBuffer(
  base64?: string,
  mime?: string
): Promise<Buffer | undefined> {
  if (!base64) return undefined;
  const buf = Buffer.from(base64, "base64");
  if (mime === PNG_PASSTHROUGH) return buf;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buf).png().toBuffer();
  } catch {
    return undefined;
  }
}
