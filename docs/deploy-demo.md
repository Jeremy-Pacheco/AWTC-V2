# Despliegue gratuito de la demo pública

Guía para publicar AWTC como **sitio de prueba** donde cualquiera puede probar los tres roles
(voluntario, coordinador y administrador) con datos ficticios que se reinician cada noche.

> Instalación real de la demo (dominios, de dónde sale cada valor, `gh secret set`, reset con líneas de código): [demo-runbook.md](demo-runbook.md).

| Pieza | Servicio (plan gratuito) | Qué aloja |
|---|---|---|
| Frontend (React + Vite) | **Vercel** | SPA en `https://<proyecto>.vercel.app` |
| Backend (Express + Socket.IO + panel EJS) | **Render** Web Service | API, WebSocket y `/login` del panel admin |
| Base de datos | **Aiven for MySQL** | Todas las tablas |
| Imágenes subidas | **Cloudinary** | El disco de Render es efímero |
| Reset nocturno | **GitHub Actions** | `.github/workflows/demo-reset.yml` |

No hay LDAP: la demo usa `AUTH_PROVIDER=local` (contraseñas con bcrypt en la base de datos).

> **Seguridad:** las credenciales que estuvieron en el repositorio (BD de producción, JWT, VAPID, LDAP)
> deben considerarse filtradas. **No reutilices ninguna** en la demo: genera valores nuevos.

---

## Orden recomendado

1. Aiven (BD) → 2. Cloudinary → 3. Claves VAPID → 4. Render (backend) →
5. GitHub Actions (carga inicial de datos) → 6. Vercel (frontend) → 7. Volver a Render para fijar la URL del frontend → 8. Comprobaciones.

---

## 1. Aiven for MySQL

1. Crea una cuenta en <https://aiven.io> y un servicio **MySQL** con el plan *Free*.
2. Cuando esté *Running*, copia de la pestaña *Overview*: **Host**, **Port**, **User**, **Password** y **Database** (por defecto `defaultdb`).
3. Descarga el **CA certificate** (`ca.pem`). Lo usarás como `DB_SSL_CA` para verificar el certificado TLS.
4. Aiven exige SSL (`DB_SSL=true`) y clave primaria en todas las tablas (`sql_require_primary_key`). Todas las migraciones del proyecto la tienen.

> Revisa los límites actuales del plan gratuito (almacenamiento, conexiones e inactividad) en la web de Aiven.

## 2. Cloudinary

1. Crea una cuenta en <https://cloudinary.com>.
2. En *Dashboard → API Keys* copia la **API environment variable**: `cloudinary://<api_key>:<api_secret>@<cloud_name>`. Ese es `CLOUDINARY_URL`.
3. Las subidas se guardan en la carpeta `awtc/` (configurable con `CLOUDINARY_FOLDER`). El reset nocturno vacía esa carpeta.

## 3. Claves VAPID (notificaciones push)

El backend **no arranca sin ellas**. Genera un par nuevo:

```bash
cd backend
npx --yes web-push generate-vapid-keys
```

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` → Render.
- La **pública** también va a Vercel como `VITE_VAPID_PUBLIC_KEY`.
- `VAPID_EMAIL` → un correo de contacto (sin `mailto:`).

## 4. Render (backend)

### Opción A: Blueprint (recomendada)

El repositorio incluye `render.yaml`.

1. En Render: *New → Blueprint* y elige el repositorio.
2. Render crea el servicio `awtc-backend` (plan *free*, carpeta `backend/`) y genera `JWT_SECRET` y `SESSION_SECRET` aleatorios.
3. Rellena las variables que pide (`sync: false`), según la [tabla de variables](#tabla-de-variables). `REFRESH_COOKIE_SAMESITE` = `none` mientras uses los dominios de Vercel y Render (`lax` con dominio propio, paso 9).
   `FRONTEND_URL` y `CORS_ORIGINS` aún no las conoces: pon temporalmente `https://example.com` y cámbialas en el paso 7.

### Opción B: manual

*New → Web Service*, con estos valores:

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npx --yes pnpm@12.23.0 install --frozen-lockfile --prod && npx --yes sequelize-cli@6 db:migrate` |
| Start Command | `node index.js` |
| Health Check Path | `/api/demo` |
| Instance Type | Free |

Añade las variables de la tabla. Para `JWT_SECRET` y `SESSION_SECRET` genera valores largos y aleatorios:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Notas

- Las **migraciones se ejecutan en el build**, porque el plan gratuito no tiene *pre-deploy command*.
- `DB_SSL_CA`: pega el contenido completo de `ca.pem`. Si tu panel no admite saltos de línea, usa `\n` literales.
- Cuando termine el despliegue, `https://<servicio>.onrender.com/api/demo` debe devolver `{"enabled":true,...}`.

## 5. GitHub Actions: carga inicial y reset nocturno

Las cuentas demo **no existen hasta que se ejecuta el reset**. Mientras tanto, "Entrar como…" responde 503.

1. En GitHub: *Settings → Secrets and variables → Actions*.
2. **Secrets**, con los mismos datos de Aiven:
   `DEMO_DB_HOST`, `DEMO_DB_PORT`, `DEMO_DB_USER`, `DEMO_DB_PASS`, `DEMO_DB_NAME`, `DEMO_DB_SSL_CA`.
   Opcionales: `CLOUDINARY_URL`, para borrar las subidas de los visitantes, y `DEMO_PASSWORD`, para poder entrar también con el formulario normal.
3. **Variables**: `DEMO_RESET_ENABLED` = `true`. Sin ella el workflow no hace nada.
4. *Actions → Reset demo data → Run workflow*, para la primera carga. Después se ejecuta solo cada día a las 03:00 UTC.

> ⚠️ El reset **borra todos los datos**. Los secretos `DEMO_DB_*` solo deben apuntar a la BD de la demo.
> El script se niega a ejecutarse sin `DEMO_MODE=true` y `--yes`.

Para lanzarlo a mano desde tu máquina contra la BD de la demo:

```bash
cd backend
# con las variables DB_* de Aiven exportadas en la shell
DEMO_MODE=true NODE_ENV=production DB_SSL=true node scripts/reset-demo.js --yes
```

## 6. Vercel (frontend)

1. *Add New → Project* e importa el repositorio.
2. **Root Directory**: `frontend`. `frontend/vercel.json` ya define el install y el build (pnpm 12.23.0), la salida `dist`, los *rewrites* del SPA (recargar `/dashboard` no da 404) y cabeceras de seguridad básicas.
3. **Environment Variables** (Production):

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://<servicio>.onrender.com` (sin `/` final) |
   | `VITE_VAPID_PUBLIC_KEY` | la clave pública VAPID del paso 3 |

   Las variables de Vercel tienen prioridad sobre `frontend/.env.production`, que apunta al antiguo dominio.
4. *Deploy*. Anota la URL final, por ejemplo `https://awtc-demo.vercel.app`.

> Las variables `VITE_*` se incrustan en el build: si las cambias, vuelve a desplegar.

## 7. Volver a Render

En *Environment* del servicio:

- `FRONTEND_URL` = URL de Vercel (sin `/` final).
- `CORS_ORIGINS` = la misma URL. Añade más separadas por comas si usas un dominio propio.
  Si defines `CORS_ORIGINS`, **sustituye** la lista por defecto (localhost y el antiguo dominio).

Guarda: Render redespliega solo.

## 8. Comprobaciones

- [ ] `GET https://<servicio>.onrender.com/api/demo` → `enabled: true` y tres cuentas.
- [ ] La web de Vercel muestra el aviso **Sitio de prueba**.
- [ ] *Iniciar sesión → Entrar como… Voluntario / Coordinador / Administrador*: entra y el panel muestra las pestañas del rol.
- [ ] Recargar `https://<vercel>/dashboard` no da 404.
- [ ] Panel EJS: `https://<servicio>.onrender.com/login` → *Enter as demo admin*.
- [ ] Subir una imagen de más de 1 MB → error "File too large"; una pequeña aparece servida desde `res.cloudinary.com`.
- [ ] Borrar o cambiar el rol de una cuenta demo → 403.
- [ ] El chat funciona entre dos navegadores (Socket.IO).
- [ ] *Actions → Reset demo data* termina en verde.

## 9. Dominio propio (opcional, recomendado)

Con la web y la API bajo el mismo dominio, la cookie de sesión deja de ser de terceros: Safari no la bloquea y puede usarse `SameSite=Lax`. La demo oficial usa:

| Subdominio | Servicio | Registro DNS |
|---|---|---|
| `awtc.jeremypacheco.es` | Vercel (web) | `CNAME` al destino que indique Vercel (`<id>.vercel-dns-0xx.com`) |
| `awtc-api.jeremypacheco.es` | Render (API + panel EJS) | `CNAME` a `<servicio>.onrender.com` |

1. **Vercel** → *Settings → Domains* → añade el subdominio de la web. Opcional: edita `<proyecto>.vercel.app` y elige *Redirect to* el dominio nuevo.
2. **Render** → *Settings → Custom Domains* → añade el subdominio de la API.
3. En el **DNS** del dominio crea los dos `CNAME` y espera a que ambos paneles lo verifiquen y emitan el certificado.
4. **Render** → *Environment*:
   - `FRONTEND_URL` y `CORS_ORIGINS` = `https://<dominio de la web>`
   - `REFRESH_COOKIE_SAMESITE` = `lax`
5. **Vercel** → `VITE_API_URL` = `https://<dominio de la API>` (tipo *Config*, entornos *Production* y *Preview*) y *Redeploy*.

Con `lax`, el login solo funciona desde el dominio propio: por eso conviene la redirección del dominio `.vercel.app`.

---

## Limitaciones conocidas del plan gratuito

- **Render se duerme** tras un rato sin tráfico: la primera petición puede tardar en torno a un minuto.
- Las sesiones del panel EJS se guardan en la tabla `Sessions` (`SESSION_STORE=database`, valor por defecto en producción), así que sobreviven a los reinicios de Render. El reset nocturno las borra.
- Tras cada reset los IDs cambian: los usuarios con sesión abierta reciben un 401 y el frontend cierra su sesión.
- Las cuentas demo son **compartidas**: cualquiera puede cambiar su nombre o foto hasta el siguiente reset.
- Revisa periódicamente las cuotas de Aiven y Cloudinary.
- **Sesiones del frontend sin dominio propio**: el token de acceso dura 15 minutos y se renueva con una cookie `httpOnly` del dominio de la API. Con la web en `*.vercel.app` y la API en `*.onrender.com` es una cookie de terceros: Safari (y Chrome si el usuario bloquea cookies de terceros) no la envía, así que esos usuarios tendrán que volver a iniciar sesión cuando caduque el token. Se resuelve con un [dominio propio](#9-dominio-propio-opcional-recomendado).

## Tabla de variables

### Backend (Render)

| Variable | Obligatoria | Valor en la demo | Descripción |
|---|---|---|---|
| `NODE_ENV` | sí | `production` | Usa la config `production` de `config/sequelize.config.js` |
| `JWT_SECRET` | sí | aleatorio | Firma de los JWT. Nunca reutilices el antiguo |
| `SESSION_SECRET` | sí | aleatorio | Firma de la cookie del panel EJS |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME` | sí | Aiven | Conexión MySQL |
| `DB_SSL` | sí | `true` | TLS hacia MySQL |
| `DB_SSL_CA` | recomendada | `ca.pem` de Aiven | Verifica el certificado del servidor |
| `FRONTEND_URL` | sí | URL de Vercel | Enlaces del panel y origen CORS permitido |
| `CORS_ORIGINS` | recomendada | URL de Vercel | Orígenes permitidos (API + Socket.IO), separados por comas |
| `TRUST_PROXY` | no | `1` | Saltos de proxy de confianza (IP real para el rate limit) |
| `SESSION_COOKIE_SECURE` | recomendada | `true` | Cookie de sesión solo por HTTPS (`true`/`false`/`auto`) |
| `SESSION_STORE` | no | `database` (por defecto en producción) | Dónde guardar las sesiones del panel: `database` o `memory` (solo desarrollo) |
| `ACCESS_TOKEN_TTL` | no | `15m` | Duración del token de acceso (formato de `jsonwebtoken`) |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | Duración del refresh token (cookie `httpOnly`), de 1 a 90 días |
| `REFRESH_COOKIE_SAMESITE` | sí | `none` / `lax` | `none` si frontend y API están en sitios distintos (Vercel + Render); `lax` si comparten dominio |
| `REFRESH_RATE_LIMIT` | no | `120` | Renovaciones de sesión por IP cada 15 minutos |
| `AUTH_PROVIDER` | sí | `local` | `local` (bcrypt en BD) o `ldap` |
| `STORAGE_PROVIDER` | sí | `cloudinary` | `local` o `cloudinary` |
| `CLOUDINARY_URL` | con Cloudinary | `cloudinary://…` | Credenciales de Cloudinary |
| `CLOUDINARY_FOLDER` | no | `awtc` | Carpeta raíz de las subidas |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | sí | nuevas | Notificaciones push (el servidor no arranca sin ellas) |
| `VAPID_EMAIL` | no | correo de contacto | Identificación ante los servicios push |
| `PUSH_ALLOWED_HOSTS` | no | sin definir | Servicios push extra (por defecto solo los de Chrome/Edge, Firefox, Safari y Windows); `*.dominio` admite subdominios |
| `DEMO_MODE` | demo | `true` | Cuentas demo, protecciones y aviso de sitio de prueba |
| `DEMO_MAX_UPLOAD_MB` | no | `1` | Límite de subida en modo demo (máximo 5) |
| `DEMO_LOGIN_RATE_LIMIT` | no | `30` | Logins demo por IP cada 15 minutos |
| `LOGIN_RATE_LIMIT` / `SIGNUP_RATE_LIMIT` / `CONTACT_RATE_LIMIT` | no | por defecto | Ajuste de los rate limits |
| `PORT` | no | la pone Render | Puerto HTTP |
| `HOST` | no | `0.0.0.0` (necesario en Render) | Interfaz de escucha; detrás de nginx usa `127.0.0.1` para no exponer 8080/8443 |
| `CSP_REPORT_ONLY` | no | sin definir | `true` envía la CSP en modo solo informe (para probarla sin bloquear nada) |
| `CSP_CONNECT_SRC` | no | sin definir | Orígenes extra para `fetch`/websockets si la API está en otro dominio que la página servida por Express |

No uses en Render: `USE_HTTPS` (Render ya termina TLS) ni las variables `LDAP_*`.

### Frontend (Vercel)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_URL` | sí | URL pública del backend en Render |
| `VITE_VAPID_PUBLIC_KEY` | sí | Clave VAPID pública (la misma que `VAPID_PUBLIC_KEY`) |

### GitHub Actions (reset nocturno)

| Nombre | Tipo | Descripción |
|---|---|---|
| `DEMO_RESET_ENABLED` | variable | `true` para activar el workflow |
| `DEMO_DB_HOST` / `DEMO_DB_PORT` / `DEMO_DB_USER` / `DEMO_DB_PASS` / `DEMO_DB_NAME` | secretos | BD de la demo (Aiven) |
| `DEMO_DB_SSL_CA` | secreto | CA de Aiven |
| `CLOUDINARY_URL` | secreto (opcional) | Para borrar las subidas de los visitantes |
| `CLOUDINARY_FOLDER` | variable (opcional) | Si no usas `awtc` |
| `DEMO_PASSWORD` | secreto (opcional) | Contraseña de las cuentas demo para el formulario normal (mínimo 8 caracteres) |
