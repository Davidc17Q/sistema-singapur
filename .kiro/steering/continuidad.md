# Continuidad entre sesiones

La documentación versionada y Git son la fuente de continuidad. No depender solo de la memoria de la conversación ni de la memoria de Kiro.

## Al iniciar una sesión

1. Leer el steering (`.kiro/steering/`).
2. Leer `docs/DEVELOPMENT_STATUS.md`.
3. Revisar el spec de la tarea: `.kiro/specs/<nombre>/` (`requirements.md`, `design.md`, `tasks.md`).
4. Leer las últimas entradas de `docs/DEVELOPMENT_LOG.md`.
5. Inspeccionar `git status`, `git log` y el código real para verificar el estado.
6. Señalar al usuario cualquier diferencia entre la documentación y el código antes de seguir.

## Al terminar una sesión

1. Actualizar `tasks.md`: marcar solo lo verificado contra su criterio de aceptación.
2. Actualizar `docs/DEVELOPMENT_STATUS.md`.
3. Añadir una entrada a `docs/DEVELOPMENT_LOG.md`.
4. Registrar las decisiones técnicas nuevas, con las alternativas descartadas.
5. Dejar el siguiente paso concreto en `DEVELOPMENT_STATUS.md`.

## Reglas de trabajo con el usuario

- El usuario es un ingeniero en formación: antes de cambiar código, explicar qué, por qué y cómo; después, cómo se verificó.
- No afirmar que algo funciona sin haberlo ejecutado. No marcar tareas sin verificar su criterio de aceptación.
- No ocultar pruebas fallidas. Si algo no se pudo probar, decirlo.
- No cambiar el alcance sin avisar. No inventar requisitos.
- Las capturas de pantalla se miran antes de usarlas como evidencia (una captura en blanco ya ocurrió).

## Spec activo

`.kiro/specs/mapa-interactivo/`
