# Rotación de credenciales filtradas (tarea 1.1 de la auditoría)

Varias credenciales estuvieron **versionadas en git** (y por tanto siguen en el historial, en
cualquier clon y en las copias de GitHub). Hay que considerarlas **públicas**: dejar de
versionarlas no basta, hay que **cambiarlas**. Este documento no contiene ningún valor.

## Qué se filtró y dónde

| Credencial | Dónde estuvo | Riesgo |
|---|---|---|
| Usuario y contraseña de la **base de datos de producción** (MySQL gestionado en DigitalOcean, usuario administrador) | `backend/config/config.json` (historial) | Acceso total a los datos de producción |
| `JWT_SECRET` | `backend/.env` y valores por defecto en el código (historial) | Forjar tokens de cualquier usuario, incluido admin |
| `SESSION_SECRET` | Valor por defecto en el código (historial) | Forjar sesiones del panel EJS |
| Claves **VAPID** (pública y privada) | `backend/.env`, `backend/.env.development` | Enviar notificaciones push en nombre de la app |
| Contraseña de admin de **LDAP** y de configuración | `backend/.env.development`, `backend/docker-compose.yml`, docs (historial) | Leer y modificar el directorio de usuarios |
| Contraseñas de los usuarios semilla de LDAP | `backend/scripts/sync-ldap-users.js` (historial) | Iniciar sesión como esos usuarios |

`config/secrets.js` ya rechaza al arrancar los valores que estaban escritos en el código.

> **Estado (2026-11-26):** el despliegue antiguo en DigitalOcean (`awilltochange.me`) está **retirado**. La demo actual ([demo-runbook.md](demo-runbook.md)) usa credenciales nuevas: `JWT_SECRET` y `SESSION_SECRET` generados por Render, claves VAPID nuevas, base de datos en Aiven y una clave de Cloudinary ya rotada. Para el servidor retirado basta con **destruir** el Droplet y el clúster MySQL gestionado en el panel de DigitalOcean (eso invalida a la vez sus credenciales filtradas, secciones 1 y 2). Las secciones 3-5 solo aplican a entornos que sigan usando aquellos valores (por ejemplo, tu `.env.development` local).

## Checklist de rotación

Marca cada paso cuando esté hecho **en todos los entornos** (producción, demo y local).

### 1. Base de datos de producción
- [ ] En el panel de DigitalOcean (Databases → tu clúster → Users & Databases) **restablece la
      contraseña** del usuario administrador, o crea un usuario nuevo con permisos solo sobre la
      base de la app y elimina el antiguo.
- [ ] Restringe *Trusted sources* a la IP del servidor de la app.
- [ ] Actualiza `DB_USER`/`DB_PASS` en `backend/.env.production.local` del servidor y reinicia.
- [ ] Revisa los logs de conexión de la base de datos por si hubo accesos desconocidos.

### 2. `JWT_SECRET` y `SESSION_SECRET`
- [ ] Genera valores nuevos (uno por variable y por entorno):
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- [ ] Ponlos en el entorno de cada despliegue y reinicia.
- Efecto: todos los usuarios cierran sesión (tokens y sesiones antiguas dejan de valer). Es lo esperado.

### 3. Claves VAPID
- [ ] `npx --yes web-push generate-vapid-keys`
- [ ] Backend: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Frontend: `VITE_VAPID_PUBLIC_KEY`
      (misma clave pública) en `frontend/.env*` y en Vercel; vuelve a desplegar el frontend.
- [ ] Borra las suscripciones antiguas (ya no funcionarán): `DELETE FROM Subscriptions;`
- Efecto: los usuarios vuelven a suscribirse solos al iniciar sesión.

### 4. LDAP (si se usa `AUTH_PROVIDER=ldap`)
- [ ] Cambia la contraseña de admin del directorio y la de configuración (`slappasswd` +
      `ldapmodify` sobre `olcRootPW`, o recrea el contenedor con
      `LDAP_ADMIN_PASSWORD`/`LDAP_CONFIG_PASSWORD` nuevas si los datos son desechables).
- [ ] Cambia la contraseña de los usuarios semilla con `ldappasswd`, o bórralos si no se usan.
- [ ] Actualiza `LDAP_ADMIN_PASSWORD` en el entorno de la app.

### 5. Local
- [ ] En tu `backend/.env.development` (ya no versionado) cambia también la contraseña de LDAP
      y las claves VAPID, o mejor: borra ese archivo y usa `.env.development.local` creado a
      partir de `.env.example`.

## Limpiar el historial de git (opcional, después de rotar)

Rotar es lo que protege: un historial limpio solo evita que sigan apareciendo valores viejos.
Reescribirlo **cambia todos los hashes de commits**, obliga a hacer *force push* y a que cada
colaborador vuelva a clonar. Las PRs antiguas de GitHub pueden seguir mostrando los archivos
hasta que el soporte de GitHub limpie sus copias en caché.

```bash
# En un clon nuevo y sin trabajo pendiente
pip install git-filter-repo
git filter-repo --invert-paths \
  --path backend/.env --path backend/.env.development --path backend/config/config.json
git push --force --all && git push --force --tags
```

Después: pide a GitHub Support que purgue las vistas en caché de esos archivos y que todos los
colaboradores borren y vuelvan a clonar el repositorio.
