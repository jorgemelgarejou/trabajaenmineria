// API de CV en Netlify Functions: responde en /api/cv del mismo dominio del sitio.
// La lógica está en lib/cv-core.ts; aquí solo se conecta con Netlify Blobs y las variables de entorno.
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { handleCvRequest } from "../../lib/cv-core";

export default async (req: Request, context: Context) => {
  const env = (k: string) => Netlify.env.get(k);
  const store = getStore({ name: "cv-limites", consistency: "strong" });
  return handleCvRequest(req, {
    apiKey: env("ANTHROPIC_API_KEY") || "",
    allowedOrigins: (env("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean),
    ip: context.ip || "0.0.0.0",
    model: env("MODEL"),
    // Netlify corta las funciones a los 60 s: con esfuerzo "low" la respuesta llega a tiempo
    effort: env("EFFORT") || "low",
    perIpLimit: Number(env("PER_IP_LIMIT") || 5),
    dailyLimit: Number(env("DAILY_LIMIT") || 200),
    counters: {
      get: (k) => store.get(k),
      put: (k, v) => store.set(k, v),
    },
  });
};

export const config: Config = {
  path: "/api/cv",
};
