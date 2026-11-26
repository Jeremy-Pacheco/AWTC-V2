# Demo pública: proceso completo de despliegue y mantenimiento

Guía de referencia de **cómo está montada la demo real** (`awtc.jeremypacheco.es`), paso a paso: qué servicio hace qué, **de dónde sale cada valor** (contraseñas, claves, certificados), cómo se cargan los secretos con `gh`, y cómo funciona el reset nocturno **con las líneas exactas del código**.

> La guía genérica (para montar una demo nueva desde cero con otros nombres) es [deploy-demo.md](deploy-demo.md). Este documento describe la instalación concreta y los problemas que aparecieron al hacerla.

> **Nunca** pegues valores secretos (contraseñas, `API secret`, `CLOUDINARY_URL`, claves VAPID privadas) en un chat, un issue, un commit o un PR. Se escriben solo en los paneles de Render/Vercel o en tu propia terminal con `gh secret set`.

---

## 1. Arquitectura

```
 Navegador
    │
    ├── https://awtc.jeremypacheco.es ─────────► Vercel  (frontend React + Vite, carpeta frontend/)
    │                                               │  VITE_API_URL
    │                                               ▼
    └── https://awtc-api.jeremypacheco.es ─────► Render  (backend Express + Socket.IO + panel EJS, carpeta backend/)
                                                    │            │
                                         DB_* + CA  │            │ CLOUDINARY_URL
                                                    ▼            ▼
                                            Aiven MySQL     Cloudinary (imágenes, carpeta awtc/)
                                                    ▲            ▲
                                                    │            │
                         GitHub Actions "Reset demo data" (cada noche 03:00 UTC)
                         secretos DEMO_DB_* + DEMO_DB_SSL_CA + CLOUDINARY_URL
```

| Pieza | Servicio | URL / nombre |
|---|---|---|
| Web | Vercel, proyecto `awtc-v2` | https://awtc.jeremypacheco.es (`awtc-v2.vercel.app` redirige aquí) |
| API + panel EJS | Render, servicio `awtc-v2` en **Frankfurt** (plan free) | https://awtc-api.jeremypacheco.es (también `awtc-v2.onrender.com`) |
| Base de datos | Aiven for MySQL (plan free) | base `defaultdb` |
| Imágenes | Cloudinary | carpeta `awtc/` |
| DNS | DonDominio | zona de `jeremypacheco.es` |
| Reset nocturno | GitHub Actions | workflow `Reset demo data` |

Orden en que se montó (y en el que conviene repetirlo): **Aiven → Cloudinary → claves VAPID → Render → GitHub Actions → Vercel → volver a Render → dominio propio**.

---

## 2. Aiven (base de datos MySQL)

### Qué se hace
1. <https://console.aiven.io> → *Create service* → **MySQL**, plan **Free**.
2. Esperar a que el servicio esté en estado *Running*.

### De dónde sale cada valor
Todo está en el servicio → pestaña **Overview → Connection information**:

| Valor en Aiven | Variable en Render | Secreto en GitHub |
|---|---|---|
| **Host** (`mysql-xxxx.aivencloud.com`) — *no* la "Service URI" entera | `DB_HOST` | `DEMO_DB_HOST` |
| **Port** (número de 5 cifras) | `DB_PORT` | `DEMO_DB_PORT` |
| **User** (`avnadmin`) | `DB_USER` | `DEMO_DB_USER` |
| **Password** (botón del ojo para verla) | `DB_PASS` | `DEMO_DB_PASS` |
| **Database name** (`defaultdb`) | `DB_NAME` | `DEMO_DB_NAME` |
| **CA certificate** (botón *Download* / *Show*) | `DB_SSL_CA` | `DEMO_DB_SSL_CA` |

### El certificado CA (`DB_SSL_CA`)
- Es **público** (no es una contraseña): sirve para que el backend compruebe que de verdad habla con Aiven.
- Debe copiarse **completo, con las líneas** `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`.
- Si faltan esas líneas, el build de Render falla con `self-signed certificate in certificate chain` (nos pasó la primera vez).
- Dónde se usa: `backend/config/sequelize.config.js:11-16` (`sslOptions()`): con `DB_SSL=true` y `DB_SSL_CA` → `rejectUnauthorized: true`.

---

## 3. Cloudinary (imágenes)

### Qué se hace
1. <https://console.cloudinary.com> → cuenta gratuita.
2. ⚙️ **Settings → API Keys → Generate New API Key**.
   - **Key name**: `awtc-demo` (solo es una etiqueta).
   - **Role**: **Master Admin**. Es el único de los disponibles (*Master Admin*, *Media Library User*, *Reports*, *Viewers*) que permite subir, borrar y usar la Admin API (el borrado en bloque del reset).

### De dónde sale `CLOUDINARY_URL`
Se compone con tres datos de esa pantalla:

```
cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
```

- **API Key**: el número largo de la fila de la clave.
- **API Secret**: en la misma fila, botón del ojo.
- **Cloud name**: arriba en el panel (no cambia al rotar claves).

Ese valor va en **dos sitios**: Render (`CLOUDINARY_URL`) y el secreto de GitHub `CLOUDINARY_URL`.

### Dónde se usa en el código
- Subidas: `backend/services/storage.service.js:30-47` (`getCloudinary()`, `uploadBufferToCloudinary()`), carpeta `awtc/<subcarpeta>`.
- Límite de tamaño: `backend/multer/upload.js:51-58` → 1 MB en demo (`backend/services/demo.service.js:36-40`, `DEMO_MAX_UPLOAD_MB`).
- Borrado nocturno: `backend/scripts/reset-demo.js:148-165` (`cleanCloudinary()`).

### Rotar la clave (por ejemplo, si se filtró)
1. Generar la clave nueva (pasos de arriba).
2. Render → `CLOUDINARY_URL` = URL nueva → *Save, rebuild and deploy*.
3. Terminal: `gh secret set CLOUDINARY_URL` (sección 6).
4. **Al final**, desactivar/borrar la clave antigua en *Settings → API Keys*.
5. Comprobar: subir una imagen en la demo y lanzar el reset; el log debe decir `Cloudinary: N uploaded image(s) removed`.

---

## 4. Claves VAPID (notificaciones push)

El backend **no arranca** sin ellas. No vienen de ningún servicio: se **generan** en local:

```bash
cd backend
npx --yes web-push generate-vapid-keys
```

| Salida del comando | Dónde va |
|---|---|
| *Public Key* | Render `VAPID_PUBLIC_KEY` **y** Vercel `VITE_VAPID_PUBLIC_KEY` (la misma) |
| *Private Key* | Render `VAPID_PRIVATE_KEY` (solo ahí, es secreta) |
| — | Render `VAPID_EMAIL`: un correo de contacto, sin `mailto:` |

---

## 5. Render (backend)

### Creación
1. <https://dashboard.render.com> → **New → Blueprint** → repositorio `AWTC-V2`.
2. Render lee `render.yaml` (raíz del repo) y crea `awtc-backend`:
   - `rootDir: backend`, plan free, Node 22.
   - **Build**: instala con pnpm y **ejecuta las migraciones** (`render.yaml:13`), porque el plan free no tiene *pre-deploy*.
   - **Start**: `node index.js`. **Health check**: `/api/demo`.
   - Valores fijos (`render.yaml:17-37`): `NODE_ENV=production`, `TRUST_PROXY=1`, `SESSION_COOKIE_SECURE=true`, `DEMO_MODE=true`, `AUTH_PROVIDER=local`, `STORAGE_PROVIDER=cloudinary`, `DB_SSL=true`.
   - **Generados por Render** (`render.yaml:39-42`): `JWT_SECRET` y `SESSION_SECRET`, aleatorios. No hay que inventarlos.
3. Render pide los valores marcados `sync: false`:

| Variable | Valor en la demo | Origen |
|---|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | datos de Aiven | sección 2 |
| `DB_SSL_CA` | certificado CA de Aiven, completo | sección 2 |
| `CLOUDINARY_URL` | `cloudinary://…` | sección 3 |
| `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_EMAIL` | claves generadas | sección 4 |
| `FRONTEND_URL` | `https://awtc.jeremypacheco.es` | tu dominio de la web (al principio, la URL de Vercel) |
| `CORS_ORIGINS` | `https://awtc.jeremypacheco.es` | igual que `FRONTEND_URL`, **con** `https://` y sin `/` final |
| `REFRESH_COOKIE_SAMESITE` | `lax` | `none` si la web está en `*.vercel.app` y la API en `*.onrender.com`; `lax` con dominio propio |

> Cualquier cambio en *Environment* necesita **Save, rebuild and deploy** y esperar a que el último deploy esté *Live*.

### Errores que aparecieron
- **`self-signed certificate in certificate chain`** en el build → `DB_SSL_CA` sin las líneas `BEGIN/END`.
- **403 `Origin not allowed`** desde la web → `CORS_ORIGINS`/`FRONTEND_URL` sin `https://`, con otro dominio, o deploy no relanzado. La comprobación está en `backend/config/cors.js:35-55` (`getAllowedOrigins()`, `isOriginAllowed()`).

---

## 6. GitHub Actions: secretos con `gh` y reset nocturno

### Requisitos
- GitHub CLI instalado (`C:\Program Files\GitHub CLI\gh.exe`) y sesión iniciada: `gh auth login`.
- Ejecutar los comandos **en tu PowerShell**, dentro de la carpeta del proyecto (`C:\Users\pache\Documents\AWTC`), para que `gh` sepa a qué repositorio van.

### Cómo funciona `gh secret set`
```powershell
gh secret set NOMBRE
```
Pide `? Paste your secret`: pegas el valor y pulsas Enter. **No se muestra** ni se guarda en el historial. Cada comando guarda **un** secreto: el valor tiene que ser el que corresponde a ese nombre (un error real fue pegar la contraseña de Aiven en todos).

### Los secretos y de dónde sale cada uno

| Comando | Qué pegar | Origen |
|---|---|---|
| `gh secret set DEMO_DB_HOST` | Host de Aiven | Aiven → Overview |
| `gh secret set DEMO_DB_PORT` | Port de Aiven | Aiven → Overview |
| `gh secret set DEMO_DB_USER` | User (`avnadmin`) | Aiven → Overview |
| `gh secret set DEMO_DB_PASS` | Password de Aiven | Aiven → Overview (ojo) |
| `gh secret set DEMO_DB_NAME` | `defaultdb` | Aiven → Overview |
| `gh secret set CLOUDINARY_URL` | `cloudinary://…` | sección 3 |
| `DEMO_DB_SSL_CA` | certificado CA **multilínea** | ver abajo |

El certificado tiene varias líneas y el prompt interactivo solo acepta una, así que se guarda en un archivo `aiven-ca.pem` y se envía por tubería:

```powershell
Get-Content "C:\ruta\a\aiven-ca.pem" -Raw | gh secret set DEMO_DB_SSL_CA
```

Opcional: `gh secret set DEMO_PASSWORD` (≥ 8 caracteres) para que las cuentas demo puedan entrar también con el formulario normal (`backend/scripts/reset-demo.js:51-56`). La demo actual no lo usa: se entra con "Entrar como…".

### La variable que activa el reset
No sale de ningún servicio: es un **interruptor** que creas tú. Sin ella el workflow se salta (`.github/workflows/demo-reset.yml:27`), para que no pueda borrar una base de datos por accidente.

```powershell
gh variable set DEMO_RESET_ENABLED --body true
```

### Comprobar
```powershell
gh secret list      # deben salir los 7 secretos
gh variable list    # DEMO_RESET_ENABLED  true
```

Para borrar un secreto mal escrito (por ejemplo `CLOUNDINARY_URL`): `gh secret delete NOMBRE`.

---

## 7. El reset nocturno, paso a paso (con líneas)

### Cuándo se ejecuta
- **Automático**: todos los días a las **03:00 UTC** (04:00 hora peninsular en invierno, 05:00 en verano) — `.github/workflows/demo-reset.yml:14-15`.
- **Manual**: GitHub → *Actions → Reset demo data → Run workflow*, o desde la terminal:

```powershell
gh workflow run demo-reset.yml --ref main
gh run list --workflow demo-reset.yml --limit 1
gh run watch <id>                       # seguirlo en directo
gh run view <id> --log | Select-String "reset-demo"   # ver el resultado
```

### Qué hace el workflow (`.github/workflows/demo-reset.yml`)
| Líneas | Paso |
|---|---|
| 18-20 | `concurrency`: nunca dos resets a la vez |
| 27 | solo corre si `DEMO_RESET_ENABLED == 'true'` |
| 33-46 | convierte los secretos `DEMO_DB_*` en `DB_*`, fuerza `DEMO_MODE=true` y `DB_SSL=true`; activa Cloudinary solo si existe `CLOUDINARY_URL` |
| 48-61 | checkout, pnpm 12.23.0, Node 22, `pnpm install --prod` |
| 63-64 | `sequelize-cli db:migrate` (la BD queda con el esquema al día) |
| 66-67 | `node scripts/reset-demo.js --yes` |

### Qué hace el script (`backend/scripts/reset-demo.js`)
| Líneas | Qué hace |
|---|---|
| 168-169 | **Seguros**: se niega a ejecutarse si `DEMO_MODE` no es `true` o si falta `--yes` |
| 33-44 | Orden de borrado de tablas (hijas primero, para no chocar con claves foráneas): RefreshToken, Message, Subscription, UserProjectBan, UserProject, Reviews, Contact, Project, Category, User |
| 62-69 | Todo dentro de **una transacción**: si algo falla, no se queda la BD a medias |
| 72-82 | Crea las 3 cuentas demo + los usuarios ficticios |
| 85-112 | Categorías, proyectos (fechas relativas a hoy, responsable = coordinador demo) e inscripciones |
| 114-132 | Reseñas, incidencias (contactos) y mensajes del chat |
| 137-145 | Vacía la tabla `Sessions`: todo el mundo sale del panel EJS |
| 148-165 | Borra de Cloudinary todo lo que haya bajo `awtc/` (hasta 1000 por llamada, repite si queda más). Si falla, avisa pero el reset de datos ya está hecho |

Salida correcta en el log:
```
[reset-demo] Demo data reset successfully
[reset-demo] Dashboard sessions cleared
[reset-demo] Cloudinary: N uploaded image(s) removed from "awtc/"
```
Si sale `Cloudinary cleanup failed`, la `CLOUDINARY_URL` del secreto de GitHub está mal o es de una clave desactivada.

### Los datos que se cargan
- `backend/scripts/demo-data.js`: categorías, proyectos, usuarios extra, inscripciones, reseñas, incidencias y mensajes. **Para cambiar lo que ve la gente tras cada reset, se edita este archivo.**
  - Los mensajes del chat solo pueden ser **entre admins y coordinadores** (la mensajería es interna; `backend/config/socket.js:130`). Lo comprueba un test en `backend/tests/demo.test.js`.
- Cuentas demo: `backend/services/demo.service.js:14-18` (`demo-volunteer@`, `demo-coordinator@`, `demo-admin@example.com`; dominio reservado `example.com`, nunca son personas reales).

### Qué se guarda y qué se borra
| Durante el día | En el reset |
|---|---|
| Todo lo que hagan los visitantes se guarda y lo ven los demás | Se borra **todo** y se vuelven a cargar los datos de ejemplo |
| Cuentas creadas con "Registrarse" | Se borran |
| Imágenes subidas (máx. 1 MB) | Se borran de Cloudinary |
| Sesiones abiertas | Se cierran (los IDs cambian: el frontend recibe 401 y cierra sesión) |

Protecciones permanentes de las cuentas demo (no se pueden borrar ni cambiar de rol → 403): `backend/middlewares/demo.middlewares.js:16-35`.

---

## 8. Vercel (frontend)

### Creación
1. <https://vercel.com/new> → importar `AWTC-V2`.
2. **Root Directory**: `frontend` (lo más importante). Framework: Vite. El resto lo pone `frontend/vercel.json`:
   - instalación y build con pnpm 12.23.0 (líneas 4-5),
   - *rewrite* de todas las rutas a `index.html` para que `/dashboard` no dé 404 (líneas 7-9),
   - cabeceras de seguridad (`nosniff`, `Referrer-Policy`, `X-Frame-Options`).
3. **Environment Variables** (*Settings → Environment Variables*):

| Variable | Valor | Tipo | Entornos |
|---|---|---|---|
| `VITE_API_URL` | `https://awtc-api.jeremypacheco.es` (sin `/` final) | **Config** | Production + Preview |
| `VITE_VAPID_PUBLIC_KEY` | la clave **pública** VAPID | Config | Production + Preview |

### Cosas a saber
- Las variables `VITE_*` se **incrustan en el build**: después de cambiarlas hay que ir a *Deployments → último → ⋯ → Redeploy*.
- Son públicas por diseño (el navegador las ve). Vercel avisa ("Remove the public framework prefix…") si se marcan como **Secret**: hay que elegir **Config**. No se puede pasar una variable de Secret a Config: se borra y se crea de nuevo.
- Al editar una variable, revisar que siguen marcados **Production** y **Preview** (si no, avisa "will be removed from Production").
- Dónde se leen: `frontend/src/utils/auth.ts:11`, `frontend/src/utils/demo.ts:19-31` (`/api/demo`, `/api/demo/login`), `frontend/src/pages/dashboard/shared.ts`.

---

## 9. Dominio propio (`jeremypacheco.es`)

Motivo: con web y API bajo el mismo dominio la cookie de sesión deja de ser de terceros, se puede usar `SameSite=Lax` (más seguro) y Safari/iPhone no pierden la sesión. El dominio raíz (GitHub Pages) no se toca.

| Paso | Dónde | Qué |
|---|---|---|
| 1 | Vercel → *Settings → Domains* | Añadir `awtc.jeremypacheco.es`. Vercel muestra el destino CNAME (`<id>.vercel-dns-017.com`) |
| 2 | Render → *Settings → Custom Domains* | Añadir `awtc-api.jeremypacheco.es` → CNAME a `<servicio>.onrender.com` (hoy `awtc-v2.onrender.com`) |
| 3 | DonDominio → *Zona DNS* | `CNAME awtc` → destino de Vercel; `CNAME awtc-api` → `awtc-v2.onrender.com` |
| 4 | Esperar | Ambos paneles marcan *Verified* y emiten el certificado HTTPS (5-30 min) |
| 5 | Render → Environment | `FRONTEND_URL` y `CORS_ORIGINS` = `https://awtc.jeremypacheco.es`; `REFRESH_COOKIE_SAMESITE` = `lax` |
| 6 | Vercel → Environment Variables | `VITE_API_URL` = `https://awtc-api.jeremypacheco.es` → **Redeploy** |
| 7 | Vercel → Domains | En `awtc-v2.vercel.app` → *Edit* → **Redirect to** `awtc.jeremypacheco.es` (sin cambiar el nombre: si se cambia, sale "already in use") |

La cookie: `backend/services/token.service.js:38-53` (`sameSite()`, `cookieOptions()`), cookie `awtc.rt`, `HttpOnly; Secure; Path=/api/auth`, 7 días.

---

## 9 bis. Mover el backend de región (hecho el 2026-11-26)

El primer servicio (`awtc-backend`) se creó en **Oregón**, pero Aiven está en **Frankfurt** (`fra`): cada consulta cruzaba el Atlántico y cualquier petición tardaba 0,5–1 s. Render **no permite cambiar la región** de un servicio, así que se creó otro y se movió el dominio, sin tocar Vercel:

1. **New → Web Service** (no *Blueprint*, para no chocar con el servicio existente): región **Frankfurt**, `Root Directory` `backend`, mismos *build* / *start* / *health check* que `render.yaml`, plan Free. Nombre actual: `awtc-v2`.
2. Variables: las fijas de `render.yaml` (pegadas con *Add from .env*), `JWT_SECRET` y `SESSION_SECRET` con **Generate**, y el resto copiado del servicio viejo (`DB_*`, `DB_SSL_CA`, `CLOUDINARY_URL`, `VAPID_*`, `FRONTEND_URL`, `CORS_ORIGINS`, `REFRESH_COOKIE_SAMESITE=lax`). Las `VAPID_*` deben ser **las mismas** (la pública está compilada en Vercel).
3. Probar `https://<nuevo>.onrender.com/api/demo` y el login demo.
4. Quitar `awtc-api.jeremypacheco.es` del servicio viejo, añadirlo al nuevo y cambiar el `CNAME awtc-api` en DonDominio. Unos minutos sin servicio mientras se emite el certificado.
5. Comprobar (sección 10) y **borrar el servicio viejo** y su *Blueprint* en Render.

Resultado medido: `/api/projects` pasó de 0,72–1,0 s a ~0,2 s.

## 10. Comprobaciones tras cada cambio

Desde la terminal (Git Bash):

```bash
B=https://awtc-api.jeremypacheco.es; O=https://awtc.jeremypacheco.es
curl -s $B/api/demo                                   # {"enabled":true,...,"accounts":[3 roles]}
for r in volunteer coordinator admin; do
  curl -s -o /dev/null -w "$r %{http_code}\n" -X POST $B/api/demo/login \
    -H "Origin: $O" -H "Content-Type: application/json" -d "{\"role\":\"$r\"}"
done                                                  # 200 los tres
curl -s -D - -o /dev/null -X POST $B/api/demo/login -H "Origin: $O" \
  -H "Content-Type: application/json" -d '{"role":"volunteer"}' | grep -i set-cookie
                                                      # ...HttpOnly; Secure; SameSite=Lax
```

En el navegador:
- [ ] *Iniciar sesión → Entrar como…* con los tres roles; cada uno ve sus pestañas (voluntario: Perfil y Mis Proyectos).
- [ ] F5 en `/dashboard`: la sesión se mantiene.
- [ ] *Analíticas* (admin) abre el panel EJS en `awtc-api…`; *Enter as demo admin* entra (`backend/views/login.ejs:73-77`, `backend/routes/session.routes.js:45`).
- [ ] Cambiar la foto de perfil: la imagen sale de `res.cloudinary.com`.
- [ ] Chat entre admin y coordinador.

Limitaciones del plan gratuito:
- **Render se duerme** tras ~15 min sin tráfico: la primera visita tarda 30-60 s.
- Las cuentas demo son compartidas: cualquiera puede cambiar su nombre o foto hasta el siguiente reset.
- Vigilar las cuotas de Aiven y Cloudinary.

---

## 11. Resumen: cada valor, de dónde sale y dónde va

| Valor | Sale de | Render | Vercel | GitHub |
|---|---|---|---|---|
| Host / Port / User / Password / DB de MySQL | Aiven → Overview | `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | — | `DEMO_DB_HOST` `DEMO_DB_PORT` `DEMO_DB_USER` `DEMO_DB_PASS` `DEMO_DB_NAME` |
| Certificado CA | Aiven → Overview → CA certificate | `DB_SSL_CA` | — | `DEMO_DB_SSL_CA` (con `Get-Content … -Raw \|`) |
| `cloudinary://key:secret@cloud` | Cloudinary → Settings → API Keys | `CLOUDINARY_URL` | — | `CLOUDINARY_URL` |
| Clave VAPID pública | `npx web-push generate-vapid-keys` | `VAPID_PUBLIC_KEY` | `VITE_VAPID_PUBLIC_KEY` | — |
| Clave VAPID privada | mismo comando | `VAPID_PRIVATE_KEY` | — | — |
| Correo de contacto push | tú | `VAPID_EMAIL` | — | — |
| `JWT_SECRET`, `SESSION_SECRET` | Render los genera | automático | — | — |
| URL de la web | tu dominio | `FRONTEND_URL`, `CORS_ORIGINS` | — | — |
| URL de la API | tu dominio | — | `VITE_API_URL` | — |
| Política de cookie | `none` / `lax` | `REFRESH_COOKIE_SAMESITE` | — | — |
| Interruptor del reset | tú (`true`) | — | — | variable `DEMO_RESET_ENABLED` |

Si alguna credencial se filtra: [credential-rotation.md](credential-rotation.md).
