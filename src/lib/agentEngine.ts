import { getAgentEngineConfig } from "./env";
import { getAccessToken } from "./googleAuth";

/**
 * Cliente delgado sobre la REST API de Vertex AI Agent Engine (reasoningEngines).
 * Documentación: projects/{p}/locations/{l}/reasoningEngines/{id}:query|:streamQuery
 */

export class AgentEngineError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AgentEngineError";
    this.status = status;
  }
}

function baseUrl(location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1`;
}

async function authorizedFetch(url: string, body: unknown) {
  const token = await getAccessToken();
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Intenta abrir una sesión con el agente (create_session, típico de agentes ADK).
 * Si el agente no expone ese método, no es un error fatal: seguimos sin sesión.
 */
export async function createAgentSession(userId: string): Promise<string | null> {
  const { fullResourceName, location } = getAgentEngineConfig();

  const res = await authorizedFetch(`${baseUrl(location)}/${fullResourceName}:query`, {
    class_method: "create_session",
    input: { user_id: userId },
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const output = data?.output ?? data;
  const sessionId = output?.id ?? output?.session_id ?? output?.sessionId ?? null;
  return typeof sessionId === "string" ? sessionId : null;
}

export interface StreamQueryParams {
  userId: string;
  sessionId?: string | null;
  message: string;
}

/**
 * Llama a :streamQuery con alt=sse y devuelve el stream crudo (Server-Sent Events)
 * tal como lo entrega Vertex AI, para que la ruta de la API lo reenvíe al navegador.
 */
export async function streamAgentQuery({
  userId,
  sessionId,
  message,
}: StreamQueryParams): Promise<ReadableStream<Uint8Array>> {
  const { fullResourceName, location, streamMethod } = getAgentEngineConfig();

  const input: Record<string, unknown> = {
    user_id: userId,
    message,
  };
  if (sessionId) input.session_id = sessionId;

  const token = await getAccessToken();
  const res = await fetch(
    `${baseUrl(location)}/${fullResourceName}:streamQuery?alt=sse`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ class_method: streamMethod, input }),
    }
  );

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new AgentEngineError(
      res.status,
      text || `El Reasoning Engine respondió ${res.status} sin más detalle.`
    );
  }

  return res.body;
}
