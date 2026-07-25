/**
 * Todo lo que la app necesita para hablar con tu Agent Engine vive en variables
 * de entorno. Este módulo es el único lugar que las lee e interpreta, así que
 * si algo falta o tiene un formato raro, el error sale de aquí con un mensaje
 * que dice exactamente qué corregir.
 */

const RESOURCE_NAME_PATTERN =
  /^projects\/([^/]+)\/locations\/([^/]+)\/reasoningEngines\/([^/]+)$/;

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvConfigError";
  }
}

export interface AgentEngineConfig {
  /** El resource name completo, tal cual lo copiaste de Vertex AI. */
  fullResourceName: string;
  projectId: string;
  location: string;
  engineId: string;
  /** Nombre para mostrar en la UI. */
  displayName: string;
  /** class_method a invocar en :streamQuery (por defecto, el de ADK). */
  streamMethod: string;
}

let cachedConfig: AgentEngineConfig | null = null;

export function getAgentEngineConfig(): AgentEngineConfig {
  if (cachedConfig) return cachedConfig;

  const full = process.env.GOOGLE_AGENT_ENGINE_ID?.trim();
  if (!full) {
    throw new EnvConfigError(
      "Falta GOOGLE_AGENT_ENGINE_ID. Copia el resource name completo de tu Reasoning Engine " +
        "(projects/{proyecto}/locations/{region}/reasoningEngines/{id}) y ponlo en .env.local."
    );
  }

  const match = full.match(RESOURCE_NAME_PATTERN);
  if (!match) {
    throw new EnvConfigError(
      `GOOGLE_AGENT_ENGINE_ID no tiene el formato esperado. Recibí "${full}", pero se ` +
        "necesita algo como projects/608591128658/locations/us-central1/reasoningEngines/980311373185548288."
    );
  }

  const [, projectId, location, engineId] = match;

  cachedConfig = {
    fullResourceName: full,
    projectId,
    location,
    engineId,
    displayName: process.env.GOOGLE_AGENT_DISPLAY_NAME?.trim() || "Reasoning Engine",
    // Los agentes de ADK registran "async_stream_query" (moderno) y el alias
    // deprecado "stream_query". Usamos el primero por defecto.
    streamMethod: process.env.GOOGLE_AGENT_STREAM_METHOD?.trim() || "async_stream_query",
  };

  return cachedConfig;
}

/** Versión corta del engine id, para mostrar en la barra de estado sin ocupar la pantalla. */
export function shortEngineId(engineId: string): string {
  if (engineId.length <= 10) return engineId;
  return `${engineId.slice(0, 6)}…${engineId.slice(-4)}`;
}
