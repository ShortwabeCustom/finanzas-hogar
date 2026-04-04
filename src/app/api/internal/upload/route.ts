import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { validateInternalToken } from "@/lib/internalAuth";

type Body = {
  base64?: string;
  mimetype?: string;
  fileName?: string;
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function stripDataUriPrefix(input: string): string {
  const idx = input.indexOf(",");
  if (input.startsWith("data:") && idx >= 0) return input.slice(idx + 1);
  return input;
}

function safeExtFromName(fileName?: string): string | null {
  if (!fileName) return null;
  const m = fileName.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Body;
    const base64Raw = String(body.base64 || "").trim();
    const mimetype = String(body.mimetype || "").trim().toLowerCase();

    if (!base64Raw) {
      return NextResponse.json({ error: "No se recibió base64" }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(mimetype)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido (solo JPG, PNG, WebP o PDF)" },
        { status: 400 }
      );
    }

    const cleanBase64 = stripDataUriPrefix(base64Raw);
    const buffer = Buffer.from(cleanBase64, "base64");
    if (!buffer.length) {
      return NextResponse.json({ error: "Base64 inválido" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      return NextResponse.json({ error: "El archivo no debe superar 5MB" }, { status: 400 });
    }

    const ext = safeExtFromName(body.fileName) || MIME_TO_EXT[mimetype] || "bin";
    const fileName = `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    return NextResponse.json({ url: `/api/receipt/${fileName}` });
  } catch (error) {
    console.error("[internal/upload POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
