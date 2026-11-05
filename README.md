# Mi Secretaria IA

Aplicación privada de uso personal para organizar tareas, proyectos, recordatorios y notas desde un chat en español. Diseñada para una sola persona, con dos espacios separados: **Profesional** y **Personal**.

**Estado:** versión inicial compilada y desplegada en Vercel, con estado READY. URL de producción: https://mi-secretaria-ia.vercel.app. La protección de acceso de Vercel sigue activa; en caso necesario inicia sesión con tu cuenta. Publicación realizada subiendo una copia de los archivos a Vercel: el repositorio **todavía no está enlazado automáticamente** con Vercel. Supabase y OpenAI siguen pendientes de configuración; el modo inicial es local.

## Qué incluye

- Interfaz adaptable a móvil y ordenador, instalable como aplicación web mediante el navegador.
- Chat con propuestas de tareas, proyectos y notas que **siempre requieren aprobación**.
- Modo local sin IA, con interpretación limitada de frases como «Recuérdame...» y «Crea un proyecto llamado...».
- API segura para OpenAI al conectar Supabase y configurar una cuenta propietaria autorizada.
- Tareas con prioridad, vencimiento, estado y vinculación opcional a proyectos.
- Panel de atención con próximos vencimientos y tareas atrasadas.
- Agenda de vencimientos y botón que prepara la ficha de evento en Google Calendar para revisión manual; **no crea eventos automáticamente**.
- Memoria de notas contextualizada en el chat.
- Guardado local y sincronización entre dispositivos **cuando se configura Supabase y se inicia sesión**.
- No necesita acceso a Gmail, Google Calendar ni software clínico.

### Qué no está incluido todavía

- Notificaciones push con la aplicación cerrada (previstas para la siguiente fase).
- Integraciones con correo electrónico o gestión de pacientes.
- Transcripción de voz, adjuntos, automatizaciones externas.
- Sincronización en modo local: los datos locales permanecen solo en ese navegador.

## Seguridad y privacidad

- Los secretos de OpenAI van **solo en el servidor**, nunca en el repositorio ni en variables NEXT_PUBLIC.
- Las peticiones a la IA exigen un inicio de sesión de Supabase cuyo correo coincida con OWNER_EMAIL.
- Supabase tiene políticas RLS que solo permiten a cada cuenta acceder a su propia fila.
- En el modo local, los datos se almacenan en localStorage del navegador. No equivale a una copia de seguridad.
- Si activas la IA, el contenido de la petición y el contexto necesario se envían a OpenAI según sus condiciones y configuración de API.
- No introduzcas información clínica ni datos identificables de pacientes.
- Para un uso exclusivamente personal, conviene mantener el repositorio **Private** y controlar los registros permitidos en Supabase. GitHub Free admite repositorios privados.

## Desarrollo local

Requisitos: Node.js 22 y npm.

1. Copia .env.example a .env.local y configura las variables que uses (sin compartirlas).
2. Ejecuta npm install
3. Ejecuta npm run dev
4. Abre http://localhost:3000

Sin credenciales, la aplicación funciona en modo local y el chat utiliza un organizador por reglas (no IA).

## Base de datos: Supabase

1. Crea un proyecto Supabase.
2. Ejecuta el SQL de supabase/schema.sql en el SQL Editor (una vez).
3. Copia **Project URL** y la **anon / publishable key** a estas variables de Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
4. En **Authentication → URL Configuration**, indica como Site URL la URL final de tu Vercel y añádela también entre las Redirect URLs permitidas. En local, añade http://localhost:3000.
5. Para uso individual, crea tu cuenta y deshabilita nuevas inscripciones. La aplicación permite el acceso mediante enlace enviado a tu correo.

Si ya tienes datos locales en el mismo navegador, en el primer acceso a una cuenta sin datos se subirá esa copia. Si la cuenta ya tiene información, prevalecerá la copia de Supabase.

## IA: OpenAI

Configura **solo en Vercel**, en variables de entorno del servidor:

- OPENAI_API_KEY = clave privada creada en platform.openai.com
- OPENAI_MODEL = gpt-4.1-mini (opcional)
- OWNER_EMAIL = correo exacto con el que inicias sesión en Supabase

El uso de la API tiene facturación independiente de la suscripción de ChatGPT. No copies estas claves en el código ni las envíes en mensajes.

La API rechaza las peticiones cuando falta la autenticación, el correo propietario o la clave de servidor. Si no está disponible, el chat continúa en modo local con funciones limitadas y un aviso.

## Publicar en Vercel

1. Conecta GitHub con Vercel e importa armandmu/mi-secretaria-ia como **New Project**.
2. Selecciona el framework Next.js (Vercel suele detectarlo).
3. Configura las variables de entorno anteriores en **Settings → Environment Variables**. Es posible publicar antes en modo local, sin ellas.
4. Pulsa Deploy. La plataforma asignará una dirección web HTTPS.
5. Configura la URL de producción en Supabase Auth. Haz una prueba de inicio de sesión, guarda una tarea y comprueba la sincronización desde otro navegador.
6. Cada actualización de main podrá generar un despliegue nuevo con la integración Git.

La primera publicación de producción ya se ha efectuado mediante un despliegue directo. Aún falta enlazar GitHub para que los cambios posteriores en main generen despliegues automáticamente.

## Licencia

Código desarrollado para este proyecto, sin reutilizar el código de repositorios de terceros.
