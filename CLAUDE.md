# Auditoría completa del proyecto – Código, seguridad y autenticación

Actúa como un **Senior Full Stack Developer, Software Architect y especialista en ciberseguridad**. 

Quiero que realices una auditoría exhaustiva de TODO el proyecto, tanto del frontend como del backend, prestando especial atención al sistema de inicio de sesión, autenticación, autorización y gestión de sesiones.

## 1. Inspección completa del proyecto

Antes de realizar cualquier cambio:

- Analiza toda la estructura de carpetas y archivos.
- Identifica las tecnologías, frameworks, librerías y versiones utilizadas.
- Examina todos los componentes, páginas, servicios, controladores, modelos, middlewares y endpoints.
- Revisa los archivos de configuración y variables de entorno.
- Analiza las dependencias y posibles paquetes obsoletos o vulnerables.
- Comprueba cómo se comunican frontend y backend.
- Identifica código duplicado, innecesario, obsoleto o mal organizado.

No te limites a revisar los archivos principales. Sigue el flujo completo de ejecución de cada funcionalidad importante.

## 2. Auditoría de autenticación y sesiones

Esta sección es prioritaria.

Revisa exhaustivamente:

- Registro de usuarios, si existe.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación y cambio de contraseñas.
- Almacenamiento y protección de contraseñas.
- Hashing y salt de contraseñas.
- Gestión de sesiones.
- Cookies de autenticación.
- Tokens JWT, refresh tokens y expiración, si se utilizan.
- Persistencia de sesiones.
- Protección de rutas privadas.
- Middleware de autenticación.
- Control de acceso y permisos.
- Protección contra fuerza bruta.
- Rate limiting.
- Protección CSRF.
- Protección XSS.
- Seguridad CORS.
- Prevención de session fixation.
- Invalidación de sesiones al cerrar sesión.
- Renovación y expiración de credenciales.
- Posibles problemas de escalada de privilegios.

Comprueba que un usuario no pueda acceder a información o funcionalidades privadas sin estar autenticado y autorizado.

Si existe un sistema de autenticación mediante Google Authenticator o TOTP, revisa también su implementación y almacenamiento seguro de secretos.

## 3. Auditoría de seguridad general

Busca vulnerabilidades y malas prácticas como:

- SQL Injection y NoSQL Injection.
- Cross-Site Scripting (XSS).
- Cross-Site Request Forgery (CSRF).
- Broken Access Control.
- IDOR.
- Exposición de información sensible.
- Secretos o credenciales dentro del código.
- Endpoints sin protección.
- Validaciones insuficientes en el servidor.
- Manipulación de parámetros y peticiones.
- Configuraciones inseguras.
- Errores que revelen información interna.
- Falta de cabeceras HTTP de seguridad.
- Dependencias con vulnerabilidades conocidas.

No confíes en las validaciones del frontend: comprueba que las operaciones sensibles también estén protegidas en el backend.

## 4. Auditoría del frontend

Revisa:

- Organización y reutilización de componentes.
- Gestión del estado.
- Validaciones de formularios.
- Manejo de errores.
- Estados de carga.
- Protección de rutas.
- Gestión de datos sensibles.
- Almacenamiento en localStorage, sessionStorage o cookies.
- Comunicación con la API.
- Experiencia de usuario durante el inicio y cierre de sesión.
- Diseño responsive y accesibilidad.
- Posibles errores de renderizado y rendimiento.

## 5. Auditoría del backend y API

Revisa:

- Arquitectura y separación de responsabilidades.
- Controladores, servicios y modelos.
- Validación y sanitización de datos.
- Autorización en cada endpoint.
- Gestión de errores y excepciones.
- Consultas a bases de datos.
- Transacciones y consistencia de datos.
- Protección de información sensible.
- Logs y monitorización.
- Configuración de producción.
- Manejo de variables de entorno.

Comprueba que ningún endpoint permita realizar operaciones que el usuario autenticado no debería poder realizar.

## 6. Calidad y mantenimiento del código

Busca:

- Errores lógicos.
- Bugs potenciales.
- Tipos incorrectos.
- Código duplicado.
- Funciones demasiado complejas.
- Problemas de rendimiento.
- Dependencias innecesarias.
- Malas prácticas.
- Código difícil de mantener.
- Falta de documentación.
- Ausencia de pruebas.

Comprueba también si los scripts de desarrollo, compilación y producción funcionan correctamente.

## 7. Pruebas y verificaciones

Ejecuta, cuando sea posible y sin modificar datos reales:

- Tests existentes.
- Comprobaciones de TypeScript.
- Linter.
- Build de producción.
- Auditoría de dependencias.
- Pruebas de autenticación.
- Pruebas de autorización.
- Pruebas de acceso a endpoints privados.
- Pruebas de validación de datos.

No realices pruebas destructivas ni ataques contra servicios externos o sistemas de producción.

Si alguna comprobación no puede realizarse, indica el motivo.

## 8. Informe final obligatorio

NO MODIFIQUES NINGÚN ARCHIVO DURANTE ESTA PRIMERA AUDITORÍA.

Quiero que generes un informe llamado `AUDIT_REPORT.md` con la siguiente estructura:

### A. Resumen ejecutivo
- Estado general del proyecto.
- Nivel de seguridad.
- Calidad del código.
- Principales problemas encontrados.

### B. Errores encontrados
Para cada error indica:
- Identificador.
- Archivo y ubicación exacta.
- Descripción del problema.
- Por qué ocurre.
- Consecuencias.
- Cómo reproducirlo, si procede.
- Solución recomendada.

### C. Vulnerabilidades de seguridad

Clasifica cada hallazgo según su gravedad:

- CRITICAL: vulnerabilidad crítica.
- HIGH: riesgo elevado.
- MEDIUM: riesgo moderado.
- LOW: riesgo bajo.
- INFO: recomendación informativa.

Indica también si el problema ha sido verificado o es solamente potencial.

### D. Problemas de arquitectura
Explica qué partes deberían reorganizarse y por qué.

### E. Mejoras recomendadas
Propón mejoras de:
- Seguridad.
- Rendimiento.
- Mantenibilidad.
- Experiencia de usuario.
- Arquitectura.
- Testing.

### F. Plan de actuación

Organiza las mejoras por prioridad:

1. Problemas críticos que deben solucionarse inmediatamente.
2. Problemas importantes.
3. Mejoras recomendadas.
4. Mejoras opcionales.

Para cada tarea, indica la dificultad estimada y los archivos que habría que modificar.

### G. Conclusión

Indica si consideras que el proyecto está preparado para producción y qué falta para poder desplegarlo de forma segura.

## 9. Reglas de trabajo

- No modifiques archivos durante la auditoría.
- No elimines código.
- No instales dependencias sin autorización.
- No cambies configuraciones.
- No inventes vulnerabilidades: aporta evidencias.
- No marques como seguro algo que no hayas podido comprobar.
- Diferencia claramente entre errores confirmados y recomendaciones.
- Si encuentras un problema, analiza también sus posibles efectos secundarios.
- No expongas secretos, contraseñas ni tokens en el informe.
- No hagas commits ni pushes.
- No crees ramas ni PR durante esta fase.

**IMPORTANTE:** Quiero una auditoría real, no una simple revisión superficial. Analiza el flujo completo de la aplicación, especialmente cómo se autentican los usuarios, cómo se mantienen sus sesiones y cómo se protegen los datos privados.

Al terminar, presenta un resumen de los hallazgos más importantes y espera mi autorización antes de empezar a corregirlos.