// API de CV en Cloudflare Workers (alternativa a la función de Netlify).
// La lógica está en lib/cv-core.ts; aquí solo se conecta con KV y las variables del Worker.
import { handleCvRequest } from "../../lib/cv-core";

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS: string;   // orígenes permitidos, separados por coma
  MODEL?: string;
  EFFORT?: string;
  DAILY_LIMIT?: string;
  PER_IP_LIMIT?: string;
  RATE?: KVNamespace;        // opcional: KV para los topes diarios
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/api/cv") return new Response("No encontrado", { status: 404 });
    const kv = env.RATE;
    return handleCvRequest(request, {
      apiKey: env.ANTHROPIC_API_KEY,
      allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
      ip: request.headers.get("CF-Connecting-IP") || "0.0.0.0",
      model: env.MODEL,
      effort: env.EFFORT,
      perIpLimit: Number(env.PER_IP_LIMIT || 5),
      dailyLimit: Number(env.DAILY_LIMIT || 200),
      counters: kv && { get: (k) => kv.get(k), put: (k, v) => kv.put(k, v, { expirationTtl: 172800 }) },
    });
  },
};
