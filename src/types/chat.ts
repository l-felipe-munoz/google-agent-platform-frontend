export type ChatRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** true mientras el texto sigue llegando en streaming */
  streaming?: boolean;
  /** true si esta burbuja representa un error, no una respuesta real del agente */
  isError?: boolean;
  createdAt: number;
  /** Identificador del autor de la respuesta (ej. "exek_agent") */
  author?: string;
  /** Versión del modelo que generó la respuesta (ej. "gemini-2.5-flash") */
  modelVersion?: string;
}

export interface StatusResponse {
  ok: boolean;
  location?: string;
  engineIdShort?: string;
  displayName?: string;
  /** Con qué identidad de Google estamos hablando con el agente, ej. "cuenta de servicio de Cloud Run". */
  authLabel?: string;
  error?: string;
}

export interface SessionResponse {
  userId: string;
  sessionId: string | null;
}

export interface ChatRequestBody {
  userId: string;
  sessionId: string | null;
  message: string;
}
