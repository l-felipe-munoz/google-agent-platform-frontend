import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAgentSession } from "@/lib/agentEngine";
import { getIapIdentity, IapConfigError } from "@/lib/iap";
import type { SessionResponse } from "@/types/chat";

export const runtime = "nodejs";

/**
 * El userId es la clave con la que Memory Bank agrupa las memorias. Si
 * generáramos un ID aleatorio en cada visita (como antes), cada persona
 * "olvidaría" todo al recargar la página, porque para el agente sería un
 * usuario distinto cada vez.
 *
 * Por eso, si la petición pasó por IAP, usamos el correo verificado de esa
 * persona como userId: siempre el mismo para el mismo usuario, distinto entre
 * usuarios distintos. Si no hay IAP (ej. desarrollo local), caemos de vuelta a
 * un ID aleatorio, para no romper el flujo local.
 */
async function resolveUserId(req: NextRequest): Promise<string> {
  const identity = await getIapIdentity(req.headers);
  if (identity) return identity.email;
  return `user_${randomUUID()}`;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await resolveUserId(req);
  } catch (error) {
    if (error instanceof IapConfigError) {
      // Dejamos que este falle "ruidoso": si el JWT de IAP viene pero no lo
      // pudimos verificar, es una mala configuración (falta IAP_AUDIENCE, o
      // no coincide) y preferimos que se note ya, no que todos los usuarios
      // caigan silenciosamente a IDs anónimos sin memoria compartida.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  let sessionId: string | null = null;
  try {
    sessionId = await createAgentSession(userId);
  } catch {
    // El agente puede no soportar sesiones (no todos los frameworks las requieren).
    // No es un error fatal: seguimos sin sessionId.
    sessionId = null;
  }

  const body: SessionResponse = { userId, sessionId };
  return NextResponse.json(body);
}
