# La cuenta, porfa

Divide la cuenta del restobar con tus amigas: sube la foto de la boleta, cada
quien marca cuánto consumió desde su celular, y la app calcula el total por
persona (con propina) igual que la planilla de Google Sheets que reemplaza.

App universal con [Expo Router](https://docs.expo.dev/router/introduction/)
(React Native + web), pensada para distribuirse **solo como PWA instalable**
por ahora, con [Supabase](https://supabase.com) como backend (Auth, Postgres
con Row Level Security, Storage).

## Estado del proyecto

Implementado — **Fase 1 (MVP)**:

- Login con Google (Supabase Auth).
- Control de acceso por correo verificado, reforzado con Row Level Security
  en Postgres (nunca solo en el frontend).
- Perfil con datos bancarios para recibir transferencias.
- Gestión de contactos.
- Crear evento y elegir participantes.
- Subir foto de la boleta, cargar productos (con división entre N personas).
- Marcar el propio consumo (dueña del evento).
- Link de invitado sin login, para que cada participante marque lo suyo.
- Cálculo automático de "Total por persona" y "Total con propina".
- Estado de pago (pendiente/pagado) controlado solo por la dueña.
- Vista "Mis eventos" para cualquier persona logueada.

Implementado — **Fase 2** (parcial, activado a pedido):

- Lectura automática de la boleta con IA (Claude, vía Edge Function de
  Supabase): al subir la foto, propone productos y precios; la dueña los
  revisa/edita/elimina antes de guardar — nunca se guarda nada sin su
  confirmación. Ver [Lectura de boleta con IA](#lectura-de-boleta-con-ia-fase-2)
  más abajo para desplegarla.

Pendiente de Fase 2 (saldo histórico, simplificación de deudas,
recordatorios, compartir resumen, expiración del link, log de edición) y
**Fase 3** (build nativo con EAS): quedan consideradas en el modelo de datos
pero sin implementar — se activan cuando se pidan explícitamente.

## Stack

- Expo SDK 57, Expo Router (typed routes), TypeScript.
- `expo-router` maneja la navegación directamente (no se importa
  `@react-navigation/*` a mano — desde el SDK 56 son incompatibles).
- Supabase: Auth (Google OAuth), Postgres + RLS, Storage (fotos de boleta).
- Salida web en modo **SPA** (`web.output: "single"`), con manifest, ícono,
  service worker y meta tags inyectados para que se comporte como una PWA
  instalable.

## 1. Configura Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito
   alcanza sobradamente para un grupo de amigas).
2. Ve a **SQL Editor** y ejecuta, en orden, cada archivo de
   [`supabase/migrations/`](supabase/migrations/) (`0001_init.sql`,
   `0002_fix_rls_recursion.sql`, `0003_participant_self_payment.sql`, y
   cualquiera que se agregue después) — pega el contenido completo de cada
   uno y dale Run antes de pasar al siguiente. Juntos crean:
   - Las tablas (`profiles`, `contacts`, `events`, `event_participants`,
     `receipt_items`, `item_consumption`).
   - Las políticas de Row Level Security que hacen imposible que alguien vea
     un evento donde su correo no participa, o el consumo/datos bancarios de
     otra persona, aunque conozca el ID.
   - Las funciones RPC que usa el link de invitado (sin login) para leer y
     marcar consumo, protegidas por el `guest_token` de cada evento.
   - El bucket de Storage `receipts` (público para lectura, escritura solo
     del dueño del archivo).
3. Ve a **Authentication → Sign In / Providers → Google**, actívalo, y sigue
   [la guía de Supabase para Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
   para crear las credenciales en Google Cloud Console:
   - Tipo de credencial: **OAuth Client ID** (aplicación web).
   - **Authorized redirect URI**: la que te muestra Supabase en esa misma
     pantalla (`https://<tu-proyecto>.supabase.co/auth/v1/callback`).
   - Pega el Client ID y Client Secret de Google en el panel de Supabase.
4. En **Authentication → URL Configuration**, agrega la URL donde vas a
   correr/desplegar la app (ej. `http://localhost:8081`,
   `https://lacuenta-porfa.vercel.app`) a **Redirect URLs**, además del
   dominio final que uses en Vercel/Netlify.
5. Copia **Project URL** y **anon public key** desde
   **Project Settings → API** — los necesitas en el siguiente paso.

## 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# Opcional: dominio final donde se despliega la web, para que los links de
# invitado funcionen siempre aunque se generen desde otra URL/dispositivo.
# EXPO_PUBLIC_WEB_URL=https://lacuenta-porfa.vercel.app
```

La `anon key` es pública a propósito (así funciona Supabase): la seguridad
real la dan las políticas de RLS del paso 1, nunca la ocultes ni la
confundas con la `service_role key`, que jamás debe usarse en el cliente.

## 3. Correr en desarrollo

```bash
npm install
npm run web       # abre http://localhost:8081
# o
npm start         # abre el menú de Expo (web / iOS / Android con Expo Go)
```

## 4. Desplegar la web en Vercel o Netlify (plan gratuito)

El comando de build genera una SPA estática en `dist/` y le inyecta las
etiquetas de PWA (manifest, ícono, service worker):

```bash
npm run build:web
```

### Vercel

1. Importa el repo en [vercel.com](https://vercel.com/new).
2. **Build Command**: `npm run build:web` — **Output Directory**: `dist`.
3. Agrega las variables de entorno del paso 2 en **Settings → Environment
   Variables** (deben empezar con `EXPO_PUBLIC_` para llegar al bundle).
4. Deploy. Copia la URL final y agrégala a **Redirect URLs** en Supabase
   Auth (paso 1.4), y a `EXPO_PUBLIC_WEB_URL` en las variables de entorno.

### Netlify

1. Importa el repo en [app.netlify.com](https://app.netlify.com).
2. **Build command**: `npm run build:web` — **Publish directory**: `dist`.
3. Mismas variables de entorno y mismo paso de agregar la URL final a
   Supabase Auth.

Ambos planes gratuitos son más que suficientes para el tráfico de un grupo
de amigas. Avisaré explícitamente si algo del diseño empujara a necesitar un
plan pago antes de tiempo — hoy no hay nada que lo requiera.

## 5. Probar la instalación como PWA

La instalación solo se ofrece sobre **HTTPS** (o `localhost`), así que
pruébala contra la URL ya desplegada en Vercel/Netlify.

**Android (Chrome)**

1. Abre la URL en Chrome.
2. Aparece un banner dentro de la app ("Instalar La cuenta, porfa") con un botón
   **Instalar**, o desde el menú ⋮ → **Instalar app** / **Agregar a
   pantalla de inicio**.
3. Ábrela desde el ícono: se abre en modo `standalone`, sin barra de
   direcciones.

**iPhone (Safari)**

1. Abre la URL en Safari (no funciona desde Chrome en iOS: Apple obliga a
   usar el motor de Safari).
2. Toca **Compartir** (el ícono del cuadrado con flecha) → **Agregar a
   pantalla de inicio**.
3. Ábrela desde el ícono nuevo: pantalla completa, sin controles de Safari.
4. Las notificaciones push web en iPhone **solo funcionan una vez instalada
   así** — es una limitación de Apple, no de esta app.

## Lectura de boleta con IA (Fase 2)

Opcional — la app funciona sin esto (cargando productos a mano). Si quieres
que al subir la foto la app proponga los productos automáticamente, hay que
desplegar una Edge Function de Supabase que llama a la API de Claude. Esto
es lo único del proyecto que no es gratis (ver el aviso de costo en el paso
2 de más abajo).

**Requisito:** la [CLI de Supabase](https://supabase.com/docs/guides/cli).
En Mac, con Homebrew:

```bash
brew install supabase/tap/supabase
```

**1. Conecta la CLI a tu proyecto**

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

`TU_PROJECT_REF` es el ID que aparece en la URL de tu proyecto en el
dashboard (ej. `isbjztiekcbnjwwszeij`).

**2. Guarda tu API key de Anthropic como secreto** (nunca en el código ni en
el `.env` del frontend — solo la ve esta función, corriendo en el servidor):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-tu-key-aqui
```

⚠️ **Costo:** a diferencia de Supabase/Vercel/Netlify, la API de Claude se
cobra por uso (comprado como créditos prepago en
[console.anthropic.com](https://console.anthropic.com), no es una
suscripción). Leer una boleta cuesta típicamente 1-5 centavos de dólar;
$5 dólares alcanzan para varios cientos de boletas.

**3. Despliega la función**

```bash
supabase functions deploy parse-receipt
```

Con esto, el botón **"Leer boleta con IA"** (en el detalle del evento y en
la pantalla de productos) queda funcional: llama a la función, te muestra
los productos propuestos para que los revises/edites, y solo se guardan en
la base de datos cuando tocas "Guardar productos".

## Modelo de datos y seguridad

Ver [`supabase/migrations/`](supabase/migrations/) para el detalle completo.
Resumen de las reglas de acceso:

- Cada usuario ve y edita solo su propio perfil (`profiles`) y sus propios
  contactos (`contacts`).
- Un evento es visible para su dueña (control total) y para cualquier
  usuaria logueada cuyo correo de Google **coincida exactamente** con el
  correo guardado en `event_participants` para ese evento — nunca por
  adivinar o conocer el ID del evento.
- Si el correo no coincide exactamente (o la persona no quiere loguearse),
  el link de invitado (`/guest/[token]`) sigue funcionando: usa funciones
  `SECURITY DEFINER` en Postgres que validan el `guest_token` del evento,
  sin necesitar sesión.
- El estado de pago (`event_participants.payment_status`) lo puede cambiar
  la dueña del evento (cualquier participante) o cada participante sobre su
  **propia** fila (marcarse a sí misma como pagada/pendiente). Un trigger en
  Postgres bloquea cualquier otro cambio en esa fila cuando quien edita no es
  la dueña (no puede tocar su nombre, correo, ni la de nadie más) — no es
  solo una regla del frontend.
- El consumo de una participante (`item_consumption`) solo lo puede
  editar ella misma (por correo verificado) o la dueña del evento.
- Las fotos de boleta se guardan en Storage bajo
  `<uid-de-la-dueña>/<event-id>/...`; solo esa dueña puede escribir ahí, la
  lectura es pública (necesaria para que el link de invitado muestre la
  foto sin sesión).

## Estructura del proyecto

```
app/                  # rutas (Expo Router)
  (auth)/login.tsx     # login con Google
  (tabs)/              # Mis eventos, Contactos, Perfil
  event/new.tsx         # crear evento
  event/[id]/           # detalle, productos, mi consumo, compartir link, scan (IA)
  guest/[token].tsx     # vista de invitado sin cuenta
components/           # UI compartida (Button, Card, Badge, TextField…)
contexts/auth-context.tsx
lib/                  # cliente de Supabase, cálculo de totales, helpers
supabase/migrations/  # schema + RLS + funciones RPC
supabase/functions/parse-receipt/  # Edge Function: lee la boleta con Claude (Fase 2)
public/               # manifest.webmanifest, sw.js, íconos (assets de la PWA)
scripts/inject-pwa-head.js  # agrega las etiquetas de PWA al build final
```

## Preparado para más adelante (no implementado todavía)

- **Fase 2**: la lectura de boleta con IA ya está implementada (ver arriba).
  El esquema además tiene columnas reservadas (`events.receipt_ocr_raw`,
  `event_participants.reminder_last_sent_at`) para no tener que migrar de
  nuevo cuando se agreguen recordatorios y resúmenes compartibles.
- **Fase 3 (apps nativas)**: al ser Expo Router universal, compilar con
  `eas build` para iOS/Android reutiliza el mismo código. Se necesitaría
  entonces cuenta de Apple Developer (US$99/año) si se publica en App Store,
  y Google Play Console (US$25 único) si se publica en Play Store — ninguna
  es necesaria para la distribución web/PWA actual.
