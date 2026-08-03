import { OAuth2Client } from "google-auth-library";
import { instance as gceInstance, project as gceProject } from "gcp-metadata";

/**
 * Identidad de usuario verificada por Identity-Aware Proxy (IAP).
 *
 * Cuando Cloud Run tiene IAP nativo activado, cada petición que le llega a la
 * app ya pasó por el login de Google: IAP le agrega un header
 * `x-goog-iap-jwt-assertion` con un JWT *firmado* que contiene quién inició
 * sesión.
 *
 * Usamos ese JWT (verificando su firma) en vez de los headers de texto plano
 * `x-goog-authenticated-user-*` porque esos sí se pueden falsificar si alguien
 * logra mandarle una petición a la app sin pasar por IAP. El JWT firmado no:
 * solo Google puede generarlo.
 *
 * Referencia: https://cloud.google.com/iap/docs/signed-headers-howto
 */

export class IapConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IapConfigError";
  }
}

export interface IapIdentity {
  /** Correo verificado por Google, ej. "ana@acme.com". */
  email: string;
  /** ID único y estable del usuario (no cambia aunque el correo cambie). */
  subject: string;
}

const IAP_ISSUER = "https://cloud.google.com/iap";

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) client = new OAuth2Client();
  return client;
}

let cachedAudience: string | null = null;

/**
 * Calcula el "audience" que debe traer el JWT de IAP para este servicio.
 *
 * No pedimos que nadie lo configure a mano: Cloud Run ya sabe todo lo
 * necesario (en qué proyecto y región corre, y cómo se llama el servicio,
 * vía `K_SERVICE`), así que lo armamos solos preguntándole al metadata
 * server. Esto es clave porque esta app se despliega en proyectos y
 * servicios distintos cada vez (es una plantilla pública): un valor fijo o
 * copiado a mano no serviría para el siguiente despliegue.
 *
 * `IAP_AUDIENCE` sigue existiendo como escape hatch para casos que no son el
 * IAP nativo de Cloud Run (ej. un Load Balancer externo con IAP delante).
 */
async function resolveAudience(): Promise<string> {
  if (cachedAudience) return cachedAudience;

  const override = process.env.IAP_AUDIENCE?.trim();
  if (override) {
    cachedAudience = override;
    return cachedAudience;
  }

  const serviceName = process.env.K_SERVICE;
  if (!serviceName) {
    throw new IapConfigError(
      "No se pudo calcular el 'audience' de IAP: falta K_SERVICE (Cloud Run la agrega solo, " +
        "así que esto probablemente no está corriendo en Cloud Run). Si tu caso es distinto " +
        "(ej. un Load Balancer externo con IAP), fija el valor a mano con la variable de " +
        "entorno IAP_AUDIENCE."
    );
  }

  try {
    const [projectNumber, region] = await Promise.all([
      gceProject("numeric-project-id"),
      gceInstance("region"), // formato: "projects/{numero}/regions/{region}"
    ]);
    const regionName = String(region).split("/").pop();
    cachedAudience = `/projects/${projectNumber}/locations/${regionName}/services/${serviceName}`;
    return cachedAudience;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new IapConfigError(
      "No se pudo calcular el 'audience' de IAP consultando el metadata server. Puedes fijarlo " +
        `a mano con la variable de entorno IAP_AUDIENCE. Detalle: ${detail}`
    );
  }
}

/**
 * Verifica el JWT de IAP de la petición y devuelve la identidad del usuario.
 *
 * Devuelve `null` (no lanza error) cuando no hay header de IAP, porque eso es
 * normal en desarrollo local (`next dev` sin pasar por Cloud Run) y no debería
 * tumbar la app: simplemente no hay identidad que usar.
 */
export async function getIapIdentity(headers: Headers): Promise<IapIdentity | null> {
  const assertion = headers.get("x-goog-iap-jwt-assertion");
  if (!assertion) return null;

  const audience = await resolveAudience();

  try {
    const { pubkeys } = await getClient().getIapPublicKeys();
    const ticket = await getClient().verifySignedJwtWithCertsAsync(assertion, pubkeys, audience, [
      IAP_ISSUER,
    ]);

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new IapConfigError(
        "El JWT de IAP se verificó pero no trae 'email' o 'sub'. Revisa la configuración de IAP."
      );
    }

    return { email: payload.email, subject: payload.sub };
  } catch (error) {
    if (error instanceof IapConfigError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new IapConfigError(
      `No se pudo verificar el JWT de IAP contra audience="${audience}". Detalle: ${detail}`
    );
  }
}
