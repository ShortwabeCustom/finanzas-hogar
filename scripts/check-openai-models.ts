import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env", quiet: true });

const REQUIRED_MODELS = [
  process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
  process.env.OPENAI_VISION_RETRY_MODEL || "gpt-5.5",
  process.env.OPENAI_LEGACY_FALLBACK_MODEL || "gpt-4o-mini",
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY no está configurada. No se puede consultar la lista de modelos.");
    process.exitCode = 1;
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.models.list();
  const availableModels = new Set(response.data.map((model) => model.id));

  console.log("Modelos OpenAI configurados para OCR:");
  for (const model of REQUIRED_MODELS) {
    console.log(`- ${model}: ${availableModels.has(model) ? "disponible" : "no disponible"}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`No se pudo consultar la lista de modelos: ${message}`);
  process.exitCode = 1;
});
