# AUDIT_REPORT — A Will To Change (AWTC)

**Fecha:** 2026-11-24 · **Alcance:** repositorio completo (`backend/`, `frontend/`, `awtc.nginx.conf`, `docs/`) en la rama `main` (commit `05aad75`).
**Método:** revisión estática de todo el código fuente y la configuración, seguimiento de los flujos de autenticación y autorización de principio a fin, y ejecución de las comprobaciones automáticas que se podían realizar (ver §H).
**Convenciones:** **[VERIFICADO]** = confirmado leyendo el código o la configuración, o ejecutando una herramienta. **[POTENCIAL]** = depende de algo que no se ha podido comprobar (por ejemplo, la configuración real de producción o del servidor LDAP).
Por norma, este informe **no reproduce ningún secreto**: solo indica dónde están.

---

## A. Resumen ejecutivo

| Aspecto | Valoración |
|---|---|
| Estado general | Funcional como proyecto académico o demo; **no apto para producción** en su estado actual. |
| Nivel de seguridad | **Crítico.** Hay al menos 7 vulnerabilidades que permiten tomar el control de cuentas de administrador o leer y modificar datos sin estar autenticado. |
| Calidad del código | Media-baja: lógica duplicada, mucho log de depuración, archivos `index.js` y vistas EJS monolíticos, errores de TypeScript y de lint, y tests que dependen de la base de datos real. |

**Principales problemas:**
1. **El secreto JWT es un valor por defecto escrito en el código** (y coincide con el de `backend/.env`). Cualquiera puede **firmar un token de administrador**.
2. **Rutas de depuración públicas** (`/debug-models` y `/debug-messages`) que devuelven **todas las tablas**: usuarios, contactos, mensajes privados y suscripciones push. En producción también son accesibles a través de `/admin/debug-models`.
3. **Socket.IO confía en el `userId` que envía el cliente**: se puede suplantar a cualquier administrador o coordinador en el chat y recibir sus mensajes.
4. **`PUT` y `DELETE /api/projects/:id` no tienen ninguna autenticación.**
5. **XSS almacenado en el panel de administración (EJS):** se puede disparar desde el formulario de contacto público (sin cuenta) y desde las reseñas o el nombre de usuario de cualquier voluntario.
6. **Subida de archivos sin filtrar en las reseñas:** permite subir `.html` o `.svg` con la extensión original, que se sirven desde el mismo origen que el frontend. Es un XSS que roba los JWT guardados en `localStorage`.
7. **Credenciales y secretos versionados en git:** `.env*` del backend y del frontend, y `config/config.json` con las **credenciales de la base de datos de producción** (DigitalOcean).
8. Cualquier usuario con sesión (incluido un voluntario) puede ver el **dashboard completo de administración** a través de `/projects/:id/volunteers`.
9. Dependencias con **27 vulnerabilidades en el backend (1 crítica, 16 altas)** y **35 en el frontend (3 críticas, 22 altas)**.
10. No hay rate limiting, protección contra fuerza bruta, cabeceras de seguridad en Express, CSP, CSRF ni rotación de sesión.

---

## B. Errores encontrados (bugs funcionales y de calidad)

| ID | Archivo:línea | Descripción | Por qué ocurre | Consecuencia | Solución |
|---|---|---|---|---|---|
| BUG-01 | `backend/index.js:285` | En el orden de `recent()` se usa `b.CreatedAt` (con C mayúscula). | Errata. | `bDate` siempre recurre a `created_at` o `date`, que en los modelos Sequelize suelen ser `undefined`. Los bloques "Últimos usuarios/proyectos" quedan mal ordenados. | Usar `b.createdAt`. |
| BUG-02 | `backend/index.js:109-113` y `194-199` | `sequelize.sync()` se llama **dos veces**, además de las migraciones. | Código duplicado. | Doble trabajo al arrancar. `sync` puede crear tablas que no coinciden con las migraciones y ocultar desajustes del esquema. | Quitar `sync` y usar solo migraciones (`npm run migrate`). |
| BUG-03 | `backend/controllers/user.controller.js:61` y `middlewares/auth.middlewares.js:19-20` | Las credenciales Basic se decodifican con `"ascii"` y se separan con `split(":")`. | Una contraseña que contenga `:` se trunca, y los caracteres no ASCII se corrompen. En el frontend, `btoa()` (`AuthModal.tsx:45`) **lanza una excepción** con caracteres fuera de Latin-1 (ñ, acentos, emojis...). | Usuarios que no pueden iniciar sesión según su contraseña. | Decodificar en `utf8` y separar solo por el **primer** `:`. Mejor aún, enviar JSON por POST con TLS. |
| BUG-04 | `backend/controllers/user.controller.js:23-35` | En el registro se crea el usuario en LDAP **antes** de validar en la base de datos (`isEmail`, `name`). | Orden incorrecto y sin transacción ni compensación. | Si `User.create` falla, la entrada de LDAP queda huérfana. Al reintentar, LDAP responde "already exists", la API devuelve un 500 y el email queda **bloqueado** para siempre. | Validar antes y, si falla la base de datos, borrar la entrada de LDAP (compensación). |
| BUG-05 | `user.controller.js:161-175` y `292-305` | Al borrar un usuario (como admin o desde su propia cuenta) **no se elimina de LDAP**. | Falta la llamada `ldap.del`. | El usuario sigue existiendo en el directorio. No puede volver a registrarse (BUG-04) y su contraseña sigue siendo válida en LDAP. | Borrar también en LDAP, dentro de un flujo transaccional. |
| BUG-06 | `project.controller.js:200-213` y `281-290` | El control de capacidad hace `count` y después `findOrCreate` sin transacción ni bloqueo. | Condición de carrera. | Con peticiones simultáneas se puede superar `capacity`. Además, `count` incluye todos los estados, no solo `accepted`. | Usar una transacción con `SELECT ... FOR UPDATE` o una restricción en la base de datos. |
| BUG-07 | `backend/index.js:406-424` | `/projects/:id/volunteers` (EJS) no pasa `frontendUrl`, `userRegisteredProjectIds`, etc. a la vista. | Se renderiza fuera de `renderDashboard`. | Posibles errores de renderizado o enlaces rotos. También provoca SEC-08. | Usar `renderDashboard` con una sección específica. |
| BUG-08 | `frontend/src/components/AuthModal.tsx:82-90` | Tras el registro se guarda el JWT (el usuario queda logueado), pero el modal cambia a modo "login" y no se cierra. | Lógica de la interfaz incoherente. | Experiencia confusa. | Cerrar el modal o no guardar el token. |
| BUG-09 | `frontend/src/components/NavBar.tsx:79-82` | El logout no elimina `userEmail` ni `userProfileImage`, a diferencia de `clearAuth()` en `utils/auth.ts`. | Lógica duplicada. | Restos de datos personales en `localStorage` tras cerrar sesión. | Usar siempre `clearAuth()`. |
| BUG-10 | `frontend/` (TypeScript) | `tsc --noEmit -p tsconfig.app.json` da **27 errores**: `NodeJS` no encontrado (`Chat.tsx:59`), tipo de `Uint8Array` (`notificationService.ts:168`), `global` en los tests y variables sin usar. | El script `build` es solo `vite build`, sin comprobación de tipos. | Los errores de tipos llegan a producción sin detectarse. | Corregirlos y usar `"build": "tsc -b && vite build"`. |
| BUG-11 | `frontend/` (ESLint) | `eslint .` da **60 problemas (54 errores, 6 avisos)**, sobre todo `no-explicit-any`, variables sin usar y bloques vacíos. | Falta de disciplina de lint y de CI. | Mantenibilidad. | Corregirlos y añadir lint a la CI. |
| BUG-12 | `backend/tests/*.test.js` | Los tests llaman a los controladores con los **modelos reales** y cargan `.env.development`: escriben en la **base de datos de desarrollo real**. | No hay base de datos de test ni mocks. | Contaminan los datos, no son reproducibles y no se pueden ejecutar en CI sin MySQL. Además, no prueban las rutas ni los middlewares (autenticación y autorización), que es donde están los fallos graves. | Usar una base de datos de test aislada (o sqlite en memoria) y supertest sobre `app`. Para eso hay que separar `app` de `listen`. |
| BUG-13 | `frontend/.gitignore` | No incluye `dist/`. | Omisión. | Un build local puede acabar commiteado. | Añadir `dist/`. |
| BUG-14 | `backend/coverage/` y `frontend/coverage/` | Informes de cobertura versionados. | Omisión en `.gitignore`. | Ruido en el repositorio. | Ignorarlos y eliminarlos del índice. |
| BUG-15 | CORS duplicado: `index.js:39-58` y `config/socket.js:15-33` | Dos listas distintas: Express tiene `awilltochange.me:8433` (¿errata de 8443?) y Socket.IO tiene `:8080` y `www.`. | Configuración duplicada. | Comportamiento distinto entre REST y WebSocket. | Una única lista, definida en variables de entorno. |
| BUG-16 | `backend/models/index.js:36-49` | `contact.js` y `userprojectban.js` se cargan dos veces "por si acaso". | Código defensivo innecesario. | Se redefine el modelo (y se pierden las asociaciones previas si hubiera). | Eliminar ese bloque. |

---

## C. Vulnerabilidades de seguridad

### CRITICAL

#### SEC-01 — Secreto JWT escrito en el código y conocido → falsificación de tokens de administrador · **[VERIFICADO en dev / POTENCIAL en prod]**
- **Dónde:** `backend/middlewares/auth.middlewares.js:4` y `backend/utils/utils.js:3` (`process.env.JWT_SECRET || "<literal>"`).
- **Evidencia:** `index.js:11-13` solo carga `.env.${NODE_ENV}`. `.env.development` **no define `JWT_SECRET`**, así que se usa el literal del código. Además, el valor de `backend/.env` (que nunca se carga) es **idéntico** a ese literal (comprobado por comparación, sin imprimirlo).
- **Consecuencia:** cualquiera con acceso al repositorio puede firmar `{"id": <id de un admin>}`. El middleware hace `User.findByPk(payload.id)` y concede todos los permisos de ese usuario (admin), sin conocer su contraseña.
- **Reproducción:** firmar un JWT HS256 con el literal y enviarlo como `Authorization: Bearer ...` a `GET /api/users`.
- **Solución:** quitar el valor por defecto y **abortar el arranque si falta `JWT_SECRET`**. Generar un secreto aleatorio de 256 bits o más, **rotarlo** (todos los tokens actuales quedan invalidados) y fijar `algorithms: ['HS256']` en `jwt.verify`.

#### SEC-02 — Endpoints de depuración públicos que vuelcan toda la base de datos · **[VERIFICADO]**
- **Dónde:** `backend/index.js:137-151` (`/debug-models`) y `153-175` (`/debug-messages`). Se registran **antes** de cualquier middleware de autenticación.
- **Qué exponen:** hasta 5 filas de cada modelo (`Users` con emails y roles, `Contacts` con nombre, email y mensaje, `Messages` con el contenido privado, `Subscriptions` con endpoints y claves push), **todos** los mensajes con remitente y destinatario, y el `err.stack` si hay errores.
- **En producción:** `awtc.nginx.conf` reenvía `/admin/` → `http://localhost:8080/`, así que **`https://awilltochange.me/admin/debug-models` llega a esta ruta**. También es accesible directamente por `:8080` si el puerto está abierto (aparece en la lista de CORS). No se ha probado contra el servidor real, por norma de no atacar producción.
- **Solución:** eliminar ambas rutas, o como mínimo protegerlas con `NODE_ENV !== 'production'` **y** `isAdmin`.

#### SEC-03 — Suplantación de identidad en Socket.IO (chat interno) · **[VERIFICADO]**
- **Dónde:** `backend/config/socket.js:54-90`. El middleware confía en `socket.handshake.auth.userId` y `userRole` **enviados por el cliente**, sin token. El frontend los envía así en `Chat.tsx:110-114`.
- **Consecuencia:** cualquiera (sin cuenta) se conecta con `auth: {userId: <id de un admin>, userRole: 'x'}` y entonces:
  - envía mensajes **en nombre de ese administrador**;
  - **sustituye su socket** en `userSockets` (`socket.js:102`) y pasa a **recibir sus mensajes entrantes** (`receive_message`) y sus eventos de escritura;
  - puede marcar sus mensajes como leídos.
  - Además, los usuarios con `isRegularUser` (voluntarios) no tienen ninguna restricción en `send_message`, y `online_users` se emite a todos, incluidas las conexiones públicas.
- **Solución:** autenticar el handshake con el **JWT** (`socket.handshake.auth.token` y `jwt.verify`), tomar `userId` y `role` del servidor y comprobar el rol en cada evento.

#### SEC-04 — `PUT` y `DELETE /api/projects/:id` sin autenticación ni autorización · **[VERIFICADO]**
- **Dónde:** `backend/routes/project.routes.js:269-270`. No hay middleware de rol, y los controladores (`project.controller.js:73-183`) no comprueban `req.user`.
- **Consecuencia:** cualquier persona anónima puede **modificar o borrar cualquier proyecto**, **subir imágenes** y, al cambiar `status`, **enviar notificaciones push a todos los voluntarios inscritos** con un nombre de proyecto controlado por el atacante (phishing).
- **Reproducción:** `curl -X DELETE https://<host>/api/projects/1` (no se ha ejecutado contra el servidor real).
- **Solución:** añadir `authMiddleware` e `isAdminOrCoordinator` (y comprobar la propiedad del proyecto si aplica, ver SEC-17).

#### SEC-05 — XSS almacenado en el panel de administración (EJS), explotable sin cuenta · **[VERIFICADO]**
- **Dónde:**
  - `<%- JSON.stringify(...) %>` dentro de `<script>` en `views/incidents-dashboard.ejs:109` (contactos), `reviews-dashboard.ejs:88,97`, `projects-dashboard.ejs:87-89` y `categories-dashboard.ejs:87-89`. `JSON.stringify` **no escapa `</script>`**, así que un valor como `</script><script>…` rompe el bloque. Solo `users-dashboard.ejs:89-92` aplica `.replace(/<\//g, …)`.
  - Uso de `innerHTML` con datos de usuario sin escapar: `reviews-dashboard.ejs:149,274,278` (`review.content`, `user.name`) y `users-dashboard.ejs:112-118` (`user.name` y `email`).
- **Vectores:** `POST /api/contacts` es **público** (`contact.routes.js`), y el campo `message` acaba en `contactsData`. Las reseñas (cualquier voluntario) y el nombre del perfil (`PUT /api/users/dashboard`) también llegan a estas vistas.
- **Consecuencia:** el script se ejecuta en la sesión del administrador en el origen del backend. Puede llamar a la API con su cookie de sesión (por ejemplo, `PUT /api/categories`, aceptar o rechazar voluntarios...) y leer todo el dashboard.
- **Solución:** serializar con escape (`JSON.stringify(x).replace(/</g,'\\u003c')`, o mejor `<script type="application/json">` con escape), sustituir `innerHTML` por `textContent` o una función de escape, y añadir una **CSP** estricta.

#### SEC-06 — Subida de archivos arbitrarios en reseñas → XSS en el origen principal y robo de JWT · **[VERIFICADO]**
- **Dónde:** `backend/routes/reviews.routes.js:18-24`. Es un multer propio, **sin `fileFilter` ni límite de tamaño**, que conserva `path.extname(file.originalname)`. Los archivos se guardan en `public/images`, que se sirve de forma estática (`index.js:36-37`).
- **Consecuencia:** un usuario registrado sube `x.html` o `x.svg` con JavaScript, que se sirve como `text/html` o `image/svg+xml`. En producción, nginx expone `/images` **en el mismo origen que el frontend** (`awilltochange.me`), donde el **JWT vive en `localStorage`**: cualquiera que abra el enlace pierde su token, incluido el administrador. También permite subir archivos sin límite (DoS de disco).
- **Solución:** reutilizar `multer/upload.js` (lista blanca de MIME y límite de 5 MB), forzar la extensión según el tipo **detectado** (magic bytes), servir las subidas con `Content-Disposition`/`X-Content-Type-Options: nosniff` desde un dominio separado y aplicar CSP.

#### SEC-07 — Secretos y credenciales versionados en git · **[VERIFICADO]**
- **Archivos rastreados por git:** `backend/.env` (secreto JWT y clave **privada** VAPID), `backend/.env.development` (contraseñas de la base de datos y de LDAP, y otra clave privada VAPID), `backend/config/config.json` (**usuario, contraseña y host de la base de datos de producción en DigitalOcean**), `backend/docker-compose.yml` (contraseñas de admin y config de LDAP), `backend/scripts/sync-ldap-users.js:16-19` (contraseñas en claro de usuarios semilla, incluido un admin) y `frontend/.env*` (estos solo tienen claves públicas, sin riesgo).
- Si el repositorio de GitHub (`AWTC-V2`) es o ha sido público, hay que considerar **comprometidas** todas estas credenciales. No se ha podido comprobar su visibilidad (`gh` no está instalado).
- **Solución:** **rotar ya** la contraseña de la base de datos de producción, el secreto JWT, las claves VAPID y las contraseñas de LDAP. Sacar los archivos del índice (`git rm --cached`), añadirlos a `.gitignore`, limpiar el historial (`git filter-repo`/BFG) y usar `.env.example` con valores de ejemplo.

### HIGH

#### SEC-08 — Cualquier usuario con sesión accede a los datos del dashboard de administración · **[VERIFICADO]**
- **Dónde:** `backend/index.js:406-424`. `/projects/:id/volunteers` solo comprueba `req.user` (no `role === 'admin'`) y renderiza `index` con **todo** `getDashboardData()`: usuarios, emails, contactos, reseñas y relaciones.
- El login de EJS (`session.controller.js:15-50`) **acepta a cualquier usuario de LDAP**, no solo administradores.
- **Reproducción:** un voluntario inicia sesión en `/login` (o `/admin/login`) y visita `/projects/1/volunteers`.
- **Solución:** comprobar `isAdmin` en esta ruta y, preferiblemente, permitir el login de EJS solo a administradores.

#### SEC-09 — Sin rate limiting ni protección contra fuerza bruta · **[VERIFICADO]**
- No existe `express-rate-limit` ni nada equivalente. `POST /api/users/login`, `POST /login`, `POST /api/users/signup`, `POST /api/contacts` y Socket.IO no tienen límites.
- Las respuestas distintas (`401 Invalid credentials` frente a `404 User not found in database`, en `user.controller.js:75-80`) permiten **enumerar** cuentas.
- **Solución:** rate limit por IP y por cuenta, bloqueo progresivo, mensajes de error genéricos y CAPTCHA en registro y contacto.

#### SEC-10 — Errores internos expuestos en las respuestas · **[VERIFICADO]**
- `res.status(...).json({ ..., error })` devuelve el objeto de error de Sequelize (con SQL, campos y valores) en `project.controller.js:34,68,167,181`, `reviews.controller.js:48,60,109,178`, `category.controller.js:9,19,32,45`, y `error.message` en `subscription.controller.js` y `external.controller.js`. `/debug-messages` devuelve `err.stack`.
- **Solución:** un manejador de errores central que registre el detalle y devuelva un mensaje genérico.

#### SEC-11 — Contraseñas posiblemente guardadas en claro en LDAP · **[POTENCIAL]**
- `ldap.util.js:60-66` y `scripts/sync-ldap-users.js:53` envían `userPassword: password` en claro. OpenLDAP (osixia) **no aplica hash** salvo que esté activo `ppolicy` con `olcPPolicyHashCleartext`, cosa que no aparece en el repositorio.
- **Consecuencia:** quien acceda al directorio (phpLDAPadmin está expuesto en `:8081` en el compose, **sin HTTPS**) ve las contraseñas.
- **Solución:** aplicar hash `{SSHA}` o `{ARGON2}` antes de añadirla, o activar `ppolicy` con hash de texto plano. No exponer phpLDAPadmin.
- Tampoco hay **política de contraseñas** (longitud o complejidad) en el registro.

#### SEC-12 — Dependencias con vulnerabilidades conocidas · **[VERIFICADO con `npm audit`]**
- **Backend:** 27 en total (1 crítica, 16 altas, 9 moderadas). Destacan `proxy-addr` (crítica), `sequelize` (inyección SQL vía cast de columna JSON), `axios` (SSRF y bypass de NO_PROXY), `multer` (DoS), `mysql2` (fuga de credenciales por downgrade del plugin de autenticación), `socket.io-parser`, `engine.io` y `ws` (DoS), `path-to-regexp` y `body-parser` (DoS), y `form-data`.
- **Frontend:** 35 en total (3 críticas, 22 altas). Destacan `vitest` y `@vitest/coverage-v8` (críticas, solo afectan al entorno de desarrollo), `vite` (lectura de archivos desde el servidor de desarrollo), `react-router(-dom)`, **`serve` y `serve-handler`** (**se usan en producción**, en `npm start`), `axios` y `socket.io-parser`.
- **Solución:** `npm audit fix` y actualizar las dependencias directas, revisando los cambios incompatibles con los tests.

#### SEC-13 — Autenticación por cookie de sesión en rutas API sin CSRF, y rutas mixtas · **[VERIFICADO / impacto POTENCIAL]**
- `index.js:181-191` asigna `req.user` desde la sesión EJS para **todas** las rutas. Las rutas que **no** repiten `authMiddleware` (`category.routes.js` completas, `project.routes.js:69-229` y `/api/messages`) aceptan esa cookie como autenticación. Las que sí lo repiten la **anulan** (`auth.middlewares.js:11-13` pone `req.user = null`). Es inconsistente.
- No hay token CSRF ni en `login.ejs` ni en las rutas que aceptan cookie. `SameSite=Lax` lo mitiga en peticiones POST entre sitios, pero no frente a subdominios del mismo sitio ni frente a SEC-05 y SEC-06. El logout es por `GET` (`session.routes.js:51`).
- **Solución:** separar claramente la API (solo Bearer) del panel EJS (cookie + token CSRF con `csrf-sync` o similar). Logout por `POST`.

### MEDIUM

| ID | Hallazgo | Evidencia | Estado | Solución |
|---|---|---|---|---|
| SEC-14 | **Cookie de sesión sin `secure`** y secreto de sesión por defecto escrito en el código. | `index.js:95` (`'awtc_session_secret'` si falta `SESSION_SECRET`, que no está en `.env.development`) y `:101` (`secure: false` fijo). | VERIFICADO | `secure: true` en producción, `app.set('trust proxy', 1)` y secreto obligatorio. |
| SEC-15 | **Session fixation:** no se regenera la sesión al iniciar sesión. | `session.controller.js:38-39` asigna `userId` a la sesión existente sin `req.session.regenerate()`. | VERIFICADO (explotación POTENCIAL) | `regenerate()` antes de asignar los datos. |
| SEC-16 | **MemoryStore** de `express-session` en producción. `connect-session-sequelize` está instalado pero no se usa. | `index.js:93-104`. | VERIFICADO | Usar el store de Sequelize o Redis. Si no, hay fuga de memoria y las sesiones se pierden al reiniciar. |
| SEC-17 | **Autorización horizontal en proyectos:** cualquier coordinador gestiona voluntarios, aceptaciones, baneos e imágenes de **cualquier** proyecto. Los proyectos no tienen propietario. | `project.routes.js:121-229`, modelo `Project`. | VERIFICADO (decisión de diseño) | Añadir `ownerId`/`coordinatorId` y comprobarlo. |
| SEC-18 | **JWT de 24 h en `localStorage`, sin refresh ni revocación.** El logout es solo en el cliente. | `utils.js:15`, `AuthModal.tsx:54`, `NavBar.tsx:78`. | VERIFICADO | Tokens de acceso cortos (unos 15 min), refresh token en cookie `httpOnly; Secure; SameSite=Strict` con rotación, y lista de revocación. Positivo: el rol se vuelve a leer de la base de datos en cada petición, así que degradar un rol tiene efecto inmediato. |
| SEC-19 | **Inyección en el DN de LDAP:** el email se interpola sin escapar en `cn=${email},ou=users,...`. | `ldap.util.js:29,68`. En el registro se usa **antes** de validar el email (BUG-04). | POTENCIAL | Escapar el DN (RFC 4514) o buscar el DN con un filtro escapado. Validar el email antes. |
| SEC-20 | **SSRF limitado mediante suscripciones push:** el `endpoint` no se valida y el servidor hace POST a esa URL. | `subscription.controller.js:19-63` y `sendNotificationToUser`. | POTENCIAL | Lista blanca de dominios de servicios push (FCM, Mozilla, Apple, WNS) y solo `https`. |
| SEC-21 | **Secuestro de suscripción:** si el endpoint ya existe, se reasigna al usuario que lo envía. | `subscription.controller.js:45-55`. | VERIFICADO (requiere conocer el endpoint) | No reasignar o pedir prueba de posesión. |
| SEC-22 | **TLS sin verificar:** `rejectUnauthorized: false` en la API externa y en la conexión con la base de datos de producción. | `external.controller.js:5`, `config/config.json:26`, `db.config.js:18,29`, `sequelize.config.js:29`. | VERIFICADO | Verificar los certificados (con el CA de DigitalOcean). |
| SEC-23 | **No hay cabeceras de seguridad en Express** (helmet), ni CSP en ningún sitio, y `X-Powered-By` está activo. nginx añade HSTS, XFO y nosniff, pero no CSP. El puerto 8080 directo no tiene ninguna. | `index.js`, `awtc.nginx.conf:30-33`. | VERIFICADO | `helmet()` con CSP. Cerrar 8080 y 8443 en el firewall. |
| SEC-24 | **Asignación masiva:** `Category.create(req.body)` / `update(req.body)` y `Contact.update(req.body)`. | `category.controller.js:6,29`, `contact.controller.js:43`. | VERIFICADO (requiere ser coordinador o admin) | Lista blanca de campos. |
| SEC-25 | **Validación de entrada insuficiente en el servidor:** `status`, fechas, `capacity` y `categoryId` de proyectos sin validar. Reseñas y contactos sin límite de longitud. `parseInt` sin comprobar `NaN`. | Controladores de proyectos, reseñas y contacto. | VERIFICADO | Esquemas con `zod`/`joi`/`express-validator`. |

### LOW

| ID | Hallazgo | Evidencia |
|---|---|---|
| SEC-26 | Swagger UI público en producción (`/api-docs`), que enumera toda la superficie. | `index.js:76-80`, `awtc.nginx.conf` §4. Restringirlo a admin o a entornos que no sean producción. |
| SEC-27 | Logs con datos personales (emails, contenido de mensajes y payloads de notificaciones) en consola y archivo. | `socket.js:201`, `project.controller.js:118,132`, `session.controller.js`, `index.js:243-260`. |
| SEC-28 | El middleware Basic global sobrescribe `req.body.email/password` en **cualquier** ruta. | `auth.middlewares.js:17-30`. Limitarlo a `/login`. |
| SEC-29 | `X-XSS-Protection` está obsoleta, y `Cache-Control: public, immutable` en `/images` también se aplica a los avatares. | `awtc.nginx.conf`. |
| SEC-30 | La documentación (`docs/deploy-sprint-3.md:260`) parece incluir una contraseña de admin por defecto. | Revisar y eliminar. |

### INFO
- **TOTP / Google Authenticator:** no existe en el proyecto. Se recomienda 2FA para los roles admin y coordinator.
- **Recuperación y cambio de contraseña:** no existen ni en la API ni en el frontend.
- **SQL Injection:** **no se ha encontrado** inyección directa. Las consultas `sequelize.query` de `index.js` no interpolan datos de usuario (solo `tableName` del modelo). Sigue pendiente SEC-12 (vulnerabilidad de Sequelize con JSON).
- **XSS en el frontend React:** **no se ha encontrado** `dangerouslySetInnerHTML` ni `innerHTML` en `frontend/src`, y React escapa por defecto. El riesgo del frontend viene de SEC-06 (mismo origen) y de la falta de CSP.
- **IDOR:** reseñas (`update` y `delete`), mensajes (`markAsRead`, historial filtrado por el usuario actual) y suscripciones (`unsubscribe` filtrado por `userId`) **comprueban correctamente** la propiedad.
- **Hashing:** desde la migración `20251210100000-remove-password-from-users.js` la base de datos no guarda contraseñas (las delega en LDAP). `bcrypt` queda como dependencia sin usar en `models/user.js`.

---

## D. Problemas de arquitectura

1. **`backend/index.js` monolítico (unas 550 líneas):** mezcla CORS, sesión, rutas de depuración, lógica del dashboard (`getDashboardData`, unas 150 líneas con SQL), arranque HTTP/HTTPS y fallback de la SPA. Debería separarse en `app.js` (exporta `app`, imprescindible para testear con supertest), `server.js` (listen y sockets), `routes/dashboard.routes.js` y `services/dashboard.service.js`.
2. **Dos sistemas de autenticación entrelazados:** JWT para la SPA y sesión para EJS, con un middleware global que los mezcla y rutas que los anulan (SEC-13). Conviene definir dos routers con su propia cadena de middlewares y una función de autorización explícita por ruta (deny-by-default).
3. **Autorización dispersa:** a veces en la ruta, a veces en el controlador y a veces en ninguno de los dos (SEC-04). Mejor centralizarla con middlewares obligatorios y un test por endpoint.
4. **Sin capa de servicios ni validación:** los controladores acceden directamente a los modelos con `req.body`. Faltan servicios y esquemas de validación.
5. **LDAP y base de datos sin consistencia:** dos fuentes de verdad de usuarios, sin transacciones ni compensación (BUG-04, BUG-05). Hay que definir LDAP como fuente de verdad y sincronizar, o encapsular ambas en un `UserService`.
6. **Configuración duplicada:** tres configuraciones de base de datos (`config.json`, `db.config.js`, `sequelize.config.js`, y solo se usa la última), dos listas de CORS y dos configuraciones de multer.
7. **Vistas EJS con 500-800 líneas** de JavaScript en línea, d3 y plantillas `innerHTML`. Conviene extraer el JS a `public/js` y usar plantillas seguras.
8. **Frontend:** `Dashboard.tsx` (1108 líneas) y `Home.tsx` (749) son componentes enormes. La autenticación está repartida entre `localStorage`, eventos `authChanged` y el `storage` del navegador, sin un `AuthContext`. No hay **rutas protegidas** en el router: `/dashboard` y `/messages` se renderizan para todos, y la protección real depende de la API, cosa correcta pero con una UX pobre. La llamada `fetch` se repite en cada componente aunque existen `utils/auth.ts` (`authenticatedFetch`) y `api.ts`, que apenas se usan.
9. **Despliegue:** frontend servido con `serve` detrás de nginx (podría servirse estático directamente con nginx), backend expuesto en 8080 y 8443, phpLDAPadmin sin TLS y un servidor DNS propio (`dns-server/`) dentro del mismo backend.

---

## E. Mejoras recomendadas

- **Seguridad:** helmet y CSP; rate limiting; secretos obligatorios en la configuración (validar con `envalid`/`zod` al arrancar); access token corto y refresh token en cookie `httpOnly`; autenticación de sockets con JWT; CSRF en EJS; 2FA TOTP para admin y coordinador; recuperación de contraseña segura (token de un solo uso con caducidad); política de contraseñas; gestor de secretos; Dependabot o Renovate; escaneo de secretos en CI (gitleaks).
- **Rendimiento:** `getDashboardData` carga **todas** las tablas en cada petición del dashboard y hace `Message.findAll()` solo para contarlas (`index.js:240`). Mejor agregaciones SQL, paginación y caché. En `getAllProjects`, el conteo agrupado es correcto. Conviene servir estáticos con nginx y añadir compresión.
- **Mantenibilidad:** quitar los `console.log` de depuración (decenas en `index.js` y `socket.js`) y usar `logger` con niveles; ESLint y Prettier también en el backend; dejar de versionar `coverage/`; documentar las variables de entorno en `.env.example`.
- **Experiencia de usuario:** `ProtectedRoute` en React; gestión global de 401 (`handleAuthFetch` ya existe, pero hay que usarlo); cerrar el modal tras el registro (BUG-08); mensajes de error traducidos (hay mezcla de ES/EN en la API); soporte de contraseñas con caracteres no ASCII (BUG-03).
- **Arquitectura:** ver §D.
- **Testing:** tests de integración con supertest sobre `app` y una base de datos efímera, que cubran **cada endpoint × cada rol (anónimo, voluntario, coordinador, admin)**, sockets con autenticación y regresiones de SEC-01 a SEC-08. CI con `tsc`, lint, tests y `npm audit`.

---

## F. Plan de actuación

### 1. Crítico: hacerlo ya

| # | Tarea | Hallazgos | Dificultad | Archivos |
|---|---|---|---|---|
| 1.1 | **Rotar** la contraseña de la base de datos de producción, `JWT_SECRET`, `SESSION_SECRET`, las claves VAPID y las contraseñas de LDAP. Sacar los secretos de git y limpiar el historial. | SEC-07, SEC-01 | Media | `backend/.env*`, `config/config.json`, `docker-compose.yml`, `scripts/sync-ldap-users.js`, `.gitignore` |
| 1.2 | Quitar los valores por defecto de los secretos y abortar el arranque si faltan. | SEC-01, SEC-14 | Baja | `middlewares/auth.middlewares.js`, `utils/utils.js`, `index.js`, `utils/ldap.util.js` |
| 1.3 | Eliminar `/debug-models` y `/debug-messages`. | SEC-02 | Baja | `index.js` |
| 1.4 | Proteger `PUT` y `DELETE /api/projects/:id`. | SEC-04 | Baja | `routes/project.routes.js` |
| 1.5 | Autenticar Socket.IO con JWT. | SEC-03 | Media | `config/socket.js`, `frontend/src/components/Chat.tsx` |
| 1.6 | Escapar los datos de las vistas EJS y eliminar `innerHTML` con datos de usuario. | SEC-05 | Media | `views/*-dashboard.ejs` |
| 1.7 | Filtrar las subidas de reseñas (reutilizar `multer/upload.js`). | SEC-06 | Baja | `routes/reviews.routes.js` |
| 1.8 | Exigir admin en `/projects/:id/volunteers` (EJS). | SEC-08 | Baja | `index.js` |

### 2. Importante

| # | Tarea | Hallazgos | Dificultad | Archivos |
|---|---|---|---|---|
| 2.1 | Rate limiting y mensajes de login genéricos. | SEC-09 | Baja | `index.js`, `routes/user.routes.js`, `routes/session.routes.js`, `routes/contact.routes.js`, `controllers/user.controller.js` |
| 2.2 | Manejador de errores central sin filtrar detalles internos. | SEC-10 | Baja | todos los controladores, `index.js` |
| 2.3 | `npm audit fix` y actualizar las dependencias directas. | SEC-12 | Media | `package.json`, `package-lock.json` (ambos) |
| 2.4 | Separar la autenticación de API y EJS, CSRF en EJS y logout por POST. | SEC-13 | Media | `index.js`, `middlewares/*`, `routes/session.routes.js`, `views/login.ejs`, `views/header.ejs` |
| 2.5 | Cookie `secure`, `trust proxy`, `regenerate()` y store persistente. | SEC-14, SEC-15, SEC-16 | Baja | `index.js`, `controllers/session.controller.js` |
| 2.6 | Hash de contraseñas en LDAP, escape del DN y política de contraseñas. | SEC-11, SEC-19 | Media | `utils/ldap.util.js`, `controllers/user.controller.js`, `scripts/sync-ldap-users.js` |
| 2.7 | Consistencia entre LDAP y la base de datos al crear y borrar usuarios. | BUG-04, BUG-05 | Media | `controllers/user.controller.js`, `utils/ldap.util.js` |
| 2.8 | helmet, CSP y cerrar los puertos 8080 y 8443 al exterior. | SEC-23 | Baja-Media | `index.js`, `awtc.nginx.conf` |
| 2.9 | Verificar TLS con la base de datos y la API externa. | SEC-22 | Baja | `config/*.js`, `controllers/external.controller.js` |

### 3. Mejoras recomendadas

| # | Tarea | Hallazgos | Dificultad | Archivos |
|---|---|---|---|---|
| 3.1 | Validación con esquemas y lista blanca de campos. | SEC-24, SEC-25 | Media | controladores |
| 3.2 | Propiedad de proyectos por coordinador. | SEC-17 | Media | migración nueva, `models/project.js`, `controllers/project.controller.js` |
| 3.3 | Access y refresh token, y logout en el servidor. | SEC-18 | Alta | `utils/utils.js`, `controllers/user.controller.js`, frontend (`AuthModal.tsx`, `utils/auth.ts`, `NavBar.tsx`) |
| 3.4 | Lista blanca de endpoints push y no reasignar suscripciones. | SEC-20, SEC-21 | Baja | `controllers/subscription.controller.js` |
| 3.5 | Tests de autorización por rol con base de datos aislada; separar `app` de `server`. | BUG-12 | Alta | `backend/tests/*`, `index.js` |
| 3.6 | Corregir los errores de TypeScript y lint, y añadir `tsc` al build. | BUG-10, BUG-11 | Media | `frontend/src/**`, `frontend/package.json` |
| 3.7 | Corregir BUG-01, 02, 03, 06, 07, 08, 09. | — | Baja | `index.js`, `controllers/*`, `AuthModal.tsx`, `NavBar.tsx` |
| 3.8 | Refactorizar `index.js` y `Dashboard.tsx`; `AuthContext` y `ProtectedRoute`. | §D | Alta | varios |

### 4. Opcionales

- 2FA TOTP para admin y coordinador (Alta).
- Recuperación de contraseña (Media).
- Swagger solo en desarrollo o para admin (Baja).
- Limpiar datos personales de los logs (Baja).
- Unificar las configuraciones de base de datos, CORS y multer (Baja).
- `.gitignore` para `dist/` y `coverage/` (Baja).
- Servir el frontend estático desde nginx (Baja).

---

## G. Conclusión

**El proyecto NO está preparado para producción.** Hoy, un atacante sin cuenta puede: (1) **leer datos personales y mensajes privados** mediante `/admin/debug-models`, (2) **borrar o modificar proyectos** y enviar notificaciones push a los voluntarios, (3) **suplantar a administradores en el chat** y (4) **ejecutar JavaScript en la sesión del administrador** con el formulario de contacto. Cualquiera con acceso al repositorio puede, además, **falsificar un JWT de administrador** y **conectarse a la base de datos de producción** con las credenciales versionadas.

**Mínimo imprescindible para un despliegue seguro:** completar todo el bloque **F.1**, en especial la **rotación de credenciales**, que hay que hacer aunque el código se corrija, porque los secretos ya están en el historial de git. Además, del bloque **F.2**: rate limiting (2.1), errores genéricos (2.2), actualización de dependencias (2.3), cookie `secure` y store de sesión (2.5), y helmet con CSP (2.8). Por último, tests de autorización que impidan que estos fallos vuelvan a aparecer (3.5).

---

## H. Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npm audit --package-lock-only` (backend) | **Ejecutado:** 27 vulnerabilidades (1 crítica, 16 altas, 9 moderadas, 1 baja). |
| `npm audit` (frontend) | **Ejecutado:** 35 vulnerabilidades (3 críticas, 22 altas, 9 moderadas, 1 baja). |
| `tsc --noEmit` (frontend) | **Ejecutado:** 27 errores en `tsconfig.app.json`; `tsconfig.node.json` sin errores. |
| `eslint .` (frontend) | **Ejecutado:** 60 problemas (54 errores, 6 avisos). |
| Tests del frontend (`vitest`) | **No ejecutado.** Falló al cargar la configuración: `vitest` y `vite` no estaban disponibles en `node_modules` (ver nota). |
| Build de producción (`vite build`, con salida a un directorio temporal) | **No ejecutado**, por el mismo motivo. |
| Tests del backend (`jest`) | **No ejecutado.** `backend/node_modules` no existe (instalar dependencias requiere autorización) y, además, los tests **escriben en la base de datos real de desarrollo** (BUG-12), lo que choca con la norma de no modificar datos reales. |
| Pruebas dinámicas de autenticación y autorización contra el servidor | **No ejecutadas:** no había servidor local en marcha (faltan dependencias, MySQL y LDAP) y no se ataca producción. Los hallazgos marcados como VERIFICADO lo están por análisis del código y la configuración. |
| Visibilidad del repositorio en GitHub | **No comprobada** (`gh` no está instalado). |

**Nota sobre incidencias durante la auditoría:** mientras se ejecutaban las comprobaciones del frontend, la carpeta `frontend/node_modules` (no versionada) y el archivo `frontend/package-lock.json` (versionado) desaparecieron del disco. No se ha podido determinar la causa con certeza. El lockfile se ha **restaurado** desde git (`git checkout -- frontend/package-lock.json`) y el árbol de trabajo vuelve a estar limpio. `node_modules` **no se ha reinstalado** porque requiere autorización (`npm ci` en `frontend/`).
