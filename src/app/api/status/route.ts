import { NextResponse } from "next/server";
import { EnvConfigError, getAgentEngineConfig, shortEngineId } from "@/lib/env";
import { describeAuthContext, getAuthContext } from "@/lib/googleAuth";
import type { StatusResponse } from "@/types/chat";

export const runtime = "nodejs";

export async function GET() {
  let config;
  try {
    config = getAgentEngineConfig();
  } catch (error) {
    const message =
      error instanceof EnvConfigError
        ? error.message
        : "No se pudo leer la configuración del Reasoning Engine.";
    const body: StatusResponse = { ok: false, error: message };
    return NextResponse.json(body, { status: 500 });
  }

  try {
    const authContext = await getAuthContext();
    const body: StatusResponse = {
      ok: true,
      location: config.location,
      engineIdShort: shortEngineId(config.engineId),
      displayName: config.displayName,
      authLabel: describeAuthContext(authContext),
    };
    return NextResponse.json(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const body: StatusResponse = {
      ok: false,
      error:
        "No encontramos credenciales de Google. En Cloud Run, dale el rol `roles/aiplatform.user` a " +
        "la cuenta de servicio del servicio. En local, corre `gcloud auth application-default login`. " +
        `Detalle: ${detail}`,
    };
    return NextResponse.json(body, { status: 500 });
  }
}
