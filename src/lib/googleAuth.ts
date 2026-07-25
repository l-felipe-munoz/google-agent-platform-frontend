import { GCPEnv, GoogleAuth } from "google-auth-library";

/**
 * Nos autenticamos con Google usando siempre Application Default Credentials
 * (ADC), sin llaves JSON de por medio:
 *  - En Cloud Run (o GKE / Compute Engine / App Engine / Cloud Functions), ADC
 *    resuelve automáticamente la cuenta de servicio adjunta al servicio,
 *    hablando con el metadata server. No hay nada que configurar: solo hay
 *    que darle a esa cuenta de servicio el rol `roles/aiplatform.user`.
 *  - En local, ADC usa la sesión que dejó `gcloud auth application-default
 *    login`.
 *
 * Así, "el login con la cuenta de Google" nunca depende de un archivo de
 * credenciales que alguien tenga que copiar o commitear por error.
 */

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) cachedAuth = new GoogleAuth({ scopes: SCOPES });
  return cachedAuth;
}

export class GoogleAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthConfigError";
  }
}

export async function getAccessToken(): Promise<string> {
  try {
    const client = await getAuth().getClient();
    const token = await client.getAccessToken();
    if (!token?.token) {
      throw new Error("Google no devolvió un token de acceso.");
    }
    return token.token;
  } catch (error) {
    cachedAuth = null; // fuerza a reconstruir el cliente en el próximo intento
    const detail = error instanceof Error ? error.message : String(error);
    throw new GoogleAuthConfigError(
      "No se pudo autenticar con Google. Si corres en Cloud Run, revisa que la cuenta de servicio " +
        "del servicio tenga el rol `roles/aiplatform.user`. En local, corre " +
        "`gcloud auth application-default login`. " +
        `Detalle: ${detail}`
    );
  }
}

export interface AuthContext {
  /** Dónde detectó ADC las credenciales: Cloud Run, Compute Engine, local, etc. */
  env: GCPEnv;
  /** Email de la cuenta de servicio, cuando ADC puede resolverlo. */
  accountEmail: string | null;
}

/**
 * Describe con qué identidad estamos hablando con Google, para mostrarlo en
 * la barra de estado (y para poder fallar rápido, antes de mandar el primer
 * mensaje, si ADC no encuentra ninguna credencial).
 */
export async function getAuthContext(): Promise<AuthContext> {
  const auth = getAuth();

  // Si ADC no encuentra ninguna credencial (ni Cloud Run, ni sesión local de
  // gcloud), esto lanza con un mensaje claro. Lo dejamos propagar para que el
  // caller falle rápido en vez de reportar una conexión sana que no lo es.
  await auth.getClient();

  const env = await auth.getEnv();

  let accountEmail: string | null = null;
  try {
    const credentials = await auth.getCredentials();
    accountEmail = credentials.client_email ?? null;
  } catch {
    // Credenciales de usuario (gcloud) no siempre traen client_email; no es fatal.
    accountEmail = null;
  }

  return { env, accountEmail };
}

const ENV_LABELS: Record<GCPEnv, string> = {
  [GCPEnv.CLOUD_RUN]: "cuenta de servicio de Cloud Run",
  [GCPEnv.CLOUD_RUN_JOBS]: "cuenta de servicio de Cloud Run Jobs",
  [GCPEnv.KUBERNETES_ENGINE]: "cuenta de servicio de GKE",
  [GCPEnv.COMPUTE_ENGINE]: "cuenta de servicio de Compute Engine",
  [GCPEnv.APP_ENGINE]: "cuenta de servicio de App Engine",
  [GCPEnv.CLOUD_FUNCTIONS]: "cuenta de servicio de Cloud Functions",
  [GCPEnv.NONE]: "credenciales locales de gcloud",
};

/** Etiqueta legible para mostrar en la UI, ej. "cuenta de servicio de Cloud Run (x@y.iam...)". */
export function describeAuthContext({ env, accountEmail }: AuthContext): string {
  const label = ENV_LABELS[env] ?? "Application Default Credentials";
  return accountEmail ? `${label} · ${accountEmail}` : label;
}
