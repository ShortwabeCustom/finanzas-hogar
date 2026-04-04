import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

function isSafeFileName(fileName: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await ctx.params;
    const fileName = decodeURIComponent(file || "");

    if (!isSafeFileName(fileName)) {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    const filePath = join(process.cwd(), "public", "uploads", fileName);
    const buffer = await readFile(filePath);
    const ext = fileName.toLowerCase().split(".").pop() || "";
    const mime = MIME_BY_EXT[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[api/receipt GET]", error);
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
