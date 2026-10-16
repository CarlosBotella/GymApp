# GymApp

PWA para entrenar con tu entrenador personal: él asigna la rutina en un toque y tú entrenas sin fricción desde el móvil. Funciona sin conexión y se instala en la pantalla de inicio.

**Web:** https://carlosbotella.github.io/GymApp/

## Qué hace

**Cliente** (pestañas *Hoy · Rutina · Progreso*)

- **Hoy**: el día que toca, con los pesos ya calculados (sube cuando completaste todas las reps sin marcar «Duro»: +2,5 kg en máquina/barra, +1 rep en mancuernas). «Hoy prefiero otro día» si te apetece cambiar.
- **Entreno en vivo**: un botón grande «Serie hecha», descanso con aviso (vibración en Android, pitido y notificación), «¿Cómo fue?» opcional, calculadora de discos, deshacer, pantalla siempre encendida. Si se cierra la app, la sesión se retoma donde la dejaste.
- **Máquina ocupada**: adelanta el siguiente ejercicio compatible, usa una alternativa aprobada por tu entrenador o espera con contador.
- **Ficha del ejercicio**: cómo se hace, dibujo del tipo de máquina, tu foto y nota de la máquina (se quedan en el móvil; el gimnasio es una cadena y cada sala es distinta), vídeos de YouTube, ajustes del asiento.
- **Rutinas**: la del entrenador y las tuyas. Las tuyas se crean y editan de dos maneras, y puedes pasar de una a otra sin perder nada: **ejercicio a ejercicio** (eliges del catálogo y ajustas series, reps y kg con botones) o **como en notas** (`prensa 4x10 120`). También puedes partir de una plantilla. Las sugerencias del entrenador aparecen como «Sugerido por tu entrenador» y decides tú.
- **Progreso**: constancia, volumen por semana, gráficas de líneas por ejercicio con la línea de progresión lineal y aviso de estancamiento, récords, y evolución corporal (peso, grasa, músculo…) a partir de tus informes **Visbody**.
- **Visbody**: subes el PDF y saca los datos (composición, postura, perímetros, segmental). Toma la fecha del propio PDF, así que puedes subir informes antiguos y se colocan en su sitio del historial.
- **Exportar**: Excel, CSV, JSON e informe PDF.

**Entrenador** (pestañas *Clientes · Rutinas · Ejercicios*)

- **Clientes**: «Decide en un toque» — semana terminada → *Subir peso*; sin rutina → *Asignar*; rutina propia cambiada → *Revisar*; notas y máquinas ocupadas.
- **Rutinas**: biblioteca que crece con el uso. Asignar es elegir una; crear una nueva se hace ejercicio a ejercicio, como en notas o desde una plantilla. Semana siguiente en un toque (subir, repetir, nuevo ciclo, descarga).
- **Sugerir cambios** en las rutinas del cliente («Cambiar por»), sin chat.
- **Ejercicios**: catálogo, alternativas aprobadas y nombres que no se reconocieron.
- **Informe** de cada cliente, en móvil y en ordenador, imprimible a PDF y exportable.
- La app aprende qué grupo muscular hace cada cliente cada día de la semana y lo propone.

Hay un **modo demo** («Probar sin cuenta» en la pantalla de inicio) con datos de ejemplo como cliente o como entrenador; todo se guarda solo en el navegador.

## Puesta en marcha de Firebase (una vez)

En la consola de Firebase, proyecto `gymapp-cc19c`:

1. **Authentication → Sign-in method**: activa *Correo electrónico/contraseña* y *Google*.
2. **Authentication → Settings → Authorized domains**: añade `carlosbotella.github.io`.
3. **Firestore Database**: créala (modo producción, la región que quieras).
4. **Firestore → Reglas**: pega el contenido de [`firestore.rules`](firestore.rules) y publica. O con la CLI: `firebase deploy --only firestore:rules`.

No hace falta Storage (plan Blaze): los PDF originales y las fotos de máquinas se guardan en el propio móvil (IndexedDB); en la nube solo van los datos.

## Publicación

Cada push a `main` se publica en GitHub Pages con el workflow `.github/workflows/deploy.yml`. En *Settings → Pages* la fuente debe ser **GitHub Actions**.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run typecheck
```

Vite + React 19 + TypeScript, Firebase (Auth + Firestore con caché offline), pdf.js para leer el Visbody. Sin librerías de UI ni de gráficas.

```
src/
  lib/        datos (Firebase / demo local), progresión, estadísticas, Visbody, exportar, avisos
  data/       catálogo de ejercicios y plantillas de rutinas
  screens/    pantallas de cliente, entrenador y compartidas
  ui/         kit de componentes, iconos, gráficas, dibujos de máquinas
```

## Limitaciones conocidas

- El lector de Visbody está hecho para el informe en español (3 páginas). Si algo no se lee, se marca y se puede corregir a mano antes de guardar.
- En iPhone no hay vibración desde la web; el aviso de descanso es pitido y, con la app instalada, notificación.
- Las invitaciones son por código o enlace (WhatsApp), sin QR.
- Los vídeos de ejercicios abren una búsqueda en YouTube en vez de vídeos propios.
