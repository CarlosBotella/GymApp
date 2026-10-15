# GymApp

PWA para entrenadores y clientes de gimnasio. El entrenador pone rutinas; el cliente las sigue, registra pesos y repeticiones y ve su progreso. Si el cliente no tiene rutina del entrenador, se monta la suya. Al elegir ejercicios, la app solo enseña los de la parte del cuerpo que toca ese día, con las máquinas reales de On Air (Hammer Strength, gym80, Technogym…).

Todo es gratis: GitHub Pages para la web y Firebase en el plan Spark para cuentas y datos.

## Qué hace

**Cliente**
- Hoy: su rutina de la semana, el día que le toca y un botón para continuar un entreno a medias.
- Entreno en vivo: series precargadas con lo que hizo la última vez, ✓ para marcar cada serie, descanso automático con vibración y pitido, calculadora de discos, cambiar una máquina ocupada por otra del mismo músculo, ajustes de máquina guardados ("asiento en 4") y pantalla siempre encendida.
- Entreno libre: elige pierna, pecho, etc. y solo salen esos ejercicios.
- Rutinas propias cuando el entrenador no le ha puesto ninguna.
- Progreso: calendario de constancia, series por grupo muscular esta semana, gráfica por ejercicio (peso máximo, 1RM estimado, volumen), récords e historial con los comentarios del entrenador.

**Entrenador**
- Lista de clientes ordenada por quién necesita algo: sin rutina, días sin entrenar, notas sin responder, récords recientes.
- Crear y editar rutinas por días (en blanco, desde plantilla o copiando la de otro cliente).
- Ver entrenos y progreso de cada cliente y comentar cada sesión.
- Código de 6 letras que el cliente escribe para vincularse.

**Modo demo**: botón "Probar sin cuenta" en la pantalla de entrada. Trae un entrenador (Ángel) y dos clientes (Carlos con tres semanas de historial y Lucía sin rutina). Los datos se quedan en ese móvil.

## Puesta en marcha de Firebase (una sola vez)

La configuración web ya está en `src/firebaseConfig.ts`. Falta activar dos cosas en la [consola de Firebase](https://console.firebase.google.com/project/gymapp-cc19c):

1. **Authentication › Sign-in method** → activa **Correo electrónico/contraseña**.
2. **Firestore Database** → **Crear base de datos** (modo producción, región `eur3` o `europe-southwest1`).
3. **Firestore Database › Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) y pulsa **Publicar**. Sin este paso nadie puede leer ni escribir.
4. **Authentication › Settings › Dominios autorizados** → añade `carlosbotella.github.io`.

No hace falta el plan Blaze ni Cloud Functions.

## Publicar en GitHub Pages

Cada push a `main` compila y publica la web con GitHub Actions. La primera vez, en el repo ve a **Settings › Pages** y en *Source* elige **GitHub Actions**. Quedará en `https://carlosbotella.github.io/gymapp/`.

En el iPhone: ábrela en Safari, Compartir → **Añadir a pantalla de inicio**.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # comprueba tipos y genera dist/
```

## Estructura

```
src/
  data/catalog.ts     máquinas, ejercicios y grupos musculares (edítalo para añadir máquinas)
  data/seed.ts        plantilla de 6 días sacada de las rutinas reales
  lib/repo/           acceso a datos: firebase.ts (real) y demo.ts (localStorage)
  lib/stats.ts        1RM, récords, volumen, constancia
  lib/workout.ts      entreno en curso (se guarda en el móvil hasta terminar)
  pages/              pantallas de cliente, entrenador y comunes
firestore.rules       reglas de seguridad
public/sw.js          service worker (funciona sin cobertura)
```

### Datos en Firestore

| Colección | Contenido |
|---|---|
| `users/{uid}` | nombre, rol, entrenador, centro, código, ajustes de máquina |
| `trainerCodes/{código}` | `{ trainerId }` para vincularse |
| `routines/{id}` | rutina con sus días y ejercicios |
| `workouts/{id}` | entreno con todas sus series |

Rutinas y entrenos llevan `trainerId` copiado para que las reglas dejen al entrenador leerlos sin consultas extra.

## Ideas para lo siguiente

- Fotos o vídeos de cada máquina en el catálogo.
- QR pegado en cada máquina que abra ese ejercicio.
- Notificaciones push (con Firebase Cloud Messaging, gratuito) cuando el entrenador cambia la rutina.
- Mesociclos con semana de descarga.
