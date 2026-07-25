/**
 * Utilidades para el lado del navegador: partir el stream de eventos del
 * agente en payloads individuales, y sacarle el texto y metadatos (autor, modelo)
 * a cada uno.
 */

const WHITESPACE_OR_DATA_PREFIX = /^(\s+|data:\s*|:[^\n]*\n)/;

/** Quita espacios en blanco y, si vienen, el prefijo `data:` o líneas de comentario SSE (`: ...`). */
function skipFraming(s: string): string {
  let rest = s;
  let match: RegExpExecArray | null;
  while ((match = WHITESPACE_OR_DATA_PREFIX.exec(rest))) {
    rest = rest.slice(match[0].length);
  }
  return rest;
}

/**
 * Busca el índice (exclusivo) donde termina el primer valor JSON completo al
 * inicio de `s`. Devuelve -1 si `s` no empieza con `{`/`[` o si el valor está
 * incompleto.
 */
function findJsonValueEnd(s: string): number {
  const first = s[0];
  if (first !== "{" && first !== "[") return -1;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escapeNext) escapeNext = false;
      else if (ch === "\\") escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function createSseSplitter() {
  let buffer = "";

  function drain(): string[] {
    const payloads: string[] = [];
    while (true) {
      buffer = skipFraming(buffer);
      if (!buffer) break;
      const end = findJsonValueEnd(buffer);
      if (end === -1) break; // valor incompleto: esperar más datos
      payloads.push(buffer.slice(0, end));
      buffer = buffer.slice(end);
    }
    return payloads;
  }

  return {
    push(chunk: string): string[] {
      buffer += chunk;
      return drain();
    },
    flush(): string[] {
      const payloads = drain();
      buffer = "";
      return payloads;
    },
  };
}

interface AdkPart {
  text?: string;
  thought?: boolean;
  [key: string]: unknown;
}

interface GenericAgentEvent {
  content?: { parts?: AdkPart[]; role?: string };
  output?: unknown;
  text?: string;
  delta?: string;
  error?: string;
  author?: string;
  name?: string;
  model_version?: string;
  model?: string;
  [key: string]: unknown;
}

export interface ExtractedEventResult {
  text: string;
  error?: string;
  author?: string;
  modelVersion?: string;
}

function extractSingleEvent(event: unknown): ExtractedEventResult {
  if (typeof event === "string") return { text: event };
  if (event === null || typeof event !== "object") return { text: "" };

  const e = event as GenericAgentEvent;
  if (e.error) return { text: "", error: String(e.error) };

  const author = e.author || e.name || undefined;
  const modelVersion = e.model_version || e.model || undefined;

  let text = "";
  const parts = e.content?.parts;
  if (Array.isArray(parts)) {
    text = parts
      .map((part) => (!part?.thought && typeof part?.text === "string" ? part.text : ""))
      .join("");
  } else if (typeof e.output === "string") {
    text = e.output;
  } else if (typeof e.text === "string") {
    text = e.text;
  } else if (typeof e.delta === "string") {
    text = e.delta;
  }

  return { text, author, modelVersion };
}

/**
 * Extrae texto y metadatos de un evento de streaming de Vertex AI Agent Engine.
 */
export function extractEventText(raw: string): ExtractedEventResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { text: "" };
  }

  if (Array.isArray(parsed)) {
    let combinedText = "";
    let author: string | undefined;
    let modelVersion: string | undefined;

    for (const item of parsed) {
      const result = extractSingleEvent(item);
      if (result.error) {
        return { text: combinedText, error: result.error };
      }
      // Solo nos quedamos con el autor/modelo de eventos que sí aportan
      // texto (y con el último de ellos si hay varios), para no fijarnos
      // en eventos intermedios sin contenido (ej. transfer_to_agent).
      if (result.text) {
        combinedText += result.text;
        if (result.author) author = result.author;
        if (result.modelVersion) modelVersion = result.modelVersion;
      }
    }

    return { text: combinedText, author, modelVersion };
  }

  return extractSingleEvent(parsed);
}
