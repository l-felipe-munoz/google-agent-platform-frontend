# engine/room

Consola de chat mínima para hablar con un agente ya desplegado en **Vertex AI
Agent Engine** (lo que Google llama "Reasoning Engine"). La única
configuración es una variable de entorno con el resource name completo de tu
agente; el login con Google es automático (nunca una llave JSON), y ya tienes
un frontend bonito para probarlo.

No crea agentes ni los despliega — asume que ya existe uno en Agent Engine y
solo te da una forma simple de conversar con él.

## Cómo funciona

- **Next.js (App Router)**, un solo proyecto que hace de frontend y de backend
  a la vez (las rutas en `src/app/api/*` actúan de proxy autenticado hacia
  Vertex AI, así el navegador nunca ve tus credenciales de Google).
- `src/lib/env.ts` lee y valida `GOOGLE_AGENT_ENGINE_ID`, sacando de ahí el
  proyecto, la región y el id del engine.
- `src/lib/googleAuth.ts` obtiene un access token de Google con Application
  Default Credentials — nunca con una llave JSON (ver
  [Autenticación](#autenticación)).
- `src/lib/agentEngine.ts` llama a la REST API de Vertex AI:
  `:query` con `class_method: "create_session"` para abrir sesión, y
  `:streamQuery?alt=sse` con `class_method: "stream_query"` para conversar,
  transmitiendo la respuesta en vivo.
- `src/components/chat/ChatConsole.tsx` es la UI: abre sesión, manda mensajes y
  pinta la respuesta a medida que llega.

## Requisitos previos en Google Cloud

1. Ya tienes un agente desplegado en Agent Engine y su resource name completo,
   por ejemplo:

   ```
   projects/608591128658/locations/us-central1/reasoningEngines/980311373185548288
   ```

   Lo obtienes en la consola de Vertex AI → Agent Engine, o con:

   ```bash
   gcloud ai reasoning-engines list --project=TU_PROYECTO --region=us-central1
   ```

2. Alguna identidad de Google con permiso para invocarlo (rol
   `roles/aiplatform.user` como mínimo) sobre ese proyecto.

## Autenticación

Sin llaves JSON. La app usa siempre **Application Default Credentials (ADC)**,
que `google-auth-library` resuelve sola según dónde esté corriendo:

| Dónde corre | Con qué se autentica | Qué tienes que hacer |
| --- | --- | --- |
| Cloud Run (o GKE / Compute Engine / App Engine / Cloud Functions) | La cuenta de servicio adjunta al propio servicio, vía el metadata server | Dale a esa cuenta el rol `roles/aiplatform.user` — nada de código ni variables |
| Tu máquina, en desarrollo | Tu sesión local de gcloud | Corre `gcloud auth application-default login` una vez |

La barra de estado de la app muestra en vivo con qué identidad quedó
autenticada (ej. `cuenta de servicio de Cloud Run · engine-room@proyecto.iam.gserviceaccount.com`),
así confirmas de un vistazo que está usando la cuenta correcta.

### En Cloud Run

Cada servicio de Cloud Run corre con una cuenta de servicio (por defecto, la
del proyecto: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, o una
propia si la creaste). Solo necesitas darle permiso para invocar el agente:

```bash
gcloud projects add-iam-policy-binding TU_PROYECTO \
  --member="serviceAccount:LA_CUENTA_DE_SERVICIO_DE_TU_CLOUD_RUN" \
  --role="roles/aiplatform.user"
```

No hace falta descargar ni montar ninguna llave: al desplegar, ADC detecta que
está en Cloud Run y pide credenciales directamente al metadata server.

### En local

```bash
gcloud auth application-default login
```

Eso guarda una credencial en tu máquina (fuera del repo) que ADC usa
automáticamente. Tu propia cuenta de Google necesita el mismo rol
`roles/aiplatform.user` sobre el proyecto para poder invocar el agente.

## Configuración local

```bash
cp .env.example .env.local
# edita .env.local con tu GOOGLE_AGENT_ENGINE_ID

gcloud auth application-default login

npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La barra superior muestra
en vivo si la app pudo leer tu configuración y con qué cuenta quedó
autenticada; si algo falta, te dice exactamente qué revisar.

### Variables de entorno

Ver [`.env.example`](./.env.example) para el detalle completo. La única
obligatoria es:

- `GOOGLE_AGENT_ENGINE_ID` — resource name completo del agente.

Opcionales:

- `GOOGLE_AGENT_DISPLAY_NAME` — nombre que se muestra en la consola.
- `GOOGLE_AGENT_STREAM_METHOD` (por defecto `async_stream_query`) — el
  `class_method` que se invoca al conversar. Los agentes construidos con ADK
  (`AdkApp`) exponen `async_stream_query`; si tu agente usa otro framework y
  expone un método distinto, ajústalo aquí.

No hay ninguna variable para credenciales: el login con Google se resuelve
solo (ver [Autenticación](#autenticación)).

## Si tu agente no es de ADK

El parseo de la respuesta en streaming vive en una sola función,
`extractEventText` en [`src/lib/sse.ts`](./src/lib/sse.ts). Ya soporta las
formas más comunes (`content.parts[].text` de ADK, un lote de varios eventos
en un mismo payload, o `output` / `text` / `delta` de otros frameworks). Si tu
agente devuelve algo distinto, es el único lugar que hay que tocar.

### Si la respuesta llega como "(sin contenido)"

Significa que el stream terminó sin errores pero no se pudo extraer texto de
ningún evento. Ya nos pasó una vez: aunque se pide `:streamQuery?alt=sse` y el
header de la respuesta dice `text/event-stream`, Vertex AI Agent Engine no
siempre envuelve los eventos con el framing `data: ...\n\n` de SSE — a veces
manda uno o más objetos JSON pelados, sin ningún prefijo. Por eso
`createSseSplitter` (en [`src/lib/sse.ts`](./src/lib/sse.ts)) no depende de
encontrar `data:`: busca directamente el final de cada valor JSON completo en
el buffer, venga o no envuelto en SSE.

Si igual te sigue apareciendo "(sin contenido)", abre la consola del
navegador: se imprime `[engine/room] El agente respondió pero no se pudo
extraer texto` junto con los eventos crudos que llegaron. Con eso puedes ver
la forma real que usa tu agente y ajustar `extractEventText`.

## Producción

```bash
npm run build
npm run start
```

Pensado para **Cloud Run**: construyes la imagen, la despliegas, le das a su
cuenta de servicio el rol `roles/aiplatform.user`, y defines
`GOOGLE_AGENT_ENGINE_ID` en el propio servicio. Nada más — sin secretos que
gestionar.

```bash
gcloud run deploy engine-room \
  --source . \
  --region us-central1 \
  --set-env-vars GOOGLE_AGENT_ENGINE_ID=projects/.../reasoningEngines/... \
  --allow-unauthenticated   # o quítalo si quieres que la consola exija login
```

Si necesitas correrlo en un host que no sea de Google (y por lo tanto no tiene
metadata server), ADC también puede leer una llave desde disco con
`GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/key.json` — pero esa es la excepción,
no el camino recomendado por esta app.

## Estructura

```
src/
  app/
    api/status/route.ts   # ¿la config está bien? (para la barra de estado)
    api/session/route.ts  # abre una sesión con el agente
    api/chat/route.ts     # reenvía el streaming de Vertex AI al navegador
    page.tsx, layout.tsx
  components/chat/        # UI: barra de estado, burbujas, composer
  lib/
    env.ts                # lee y valida variables de entorno
    googleAuth.ts          # resuelve credenciales y pide access tokens
    agentEngine.ts         # llamadas REST a Vertex AI Agent Engine
    sse.ts                 # parseo de Server-Sent Events en el navegador
  types/chat.ts
```
