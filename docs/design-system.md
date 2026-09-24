# Sistema visual — HC Integral (del prototipo aprobado)

Fuente: prototipo Artifact "Prototipos HC Interdisciplinaria" (login, dashboard,
historias, detalle, reportes). Tailwind: definir estos tokens en `tailwind.config.ts`
bajo `theme.extend`.

## Color

```
primary:        #0E6E66   (acciones principales, activo en sidebar)
primary-soft:   #E3F0EE   (fondos activos suaves, avatar)
primary-hover:  #0B5952
bg:             #F3F6F5   (fondo de app)
surface:        #FFFFFF
border:         #DCE4E2
text:           #1C2B2E
text-muted:     #5A6B6F
text-soft:      #3F5055
danger:         #A9392A   (botón archivar/eliminar)
danger-soft-bg: #FBE6E2
danger-soft-fg: #9E3322
```

Badges `eval_estado` (SI/NO/PARCIAL):
```
SI:      bg #E3F1E6  fg #256B40
NO:      bg #FBE6E2  fg #9E3322
PARCIAL: bg #E3EBF8  fg #2B559A
```

Badges `estado_revision`:
```
en_revision:         bg #FBF0D6  fg #7A560C   (etiqueta: "En revisión")
requiere_propuesta:  bg #DDEEF9  fg #1B5A86   (etiqueta: "Requiere propuesta")
completo:            bg #F1E4F2  fg #7E3579   (etiqueta: "Completo")
```

Colores de gráficos (validados para daltonismo, usar siempre con leyenda/etiqueta,
nunca solo color): `#0A8F80` `#3E6FC2` `#C27A1A` `#2B7FD0` `#A04A9C`.

## Tipografía

- Títulos: `'Source Serif 4', Georgia, serif` — pesos 500/600.
- Interfaz y datos: `'Figtree', system-ui, sans-serif`.
- Google Fonts: `Figtree:wght@400;500;600;700` y `Source+Serif+4:opsz,wght@8..60,500;8..60,600`.

## Componentes base

- Radios: 10px inputs/botones, 14px tarjetas, 999px píldoras/badges/avatares.
- Altura mínima de controles interactivos: 44px (accesibilidad táctil).
- Sombra de tarjeta flotante (modal/toast): `0 12px 30px rgba(15,40,38,.14)`.
- Foco visible: borde `#0E6E66` + `box-shadow: 0 0 0 3px rgba(14,110,102,.15)`.
- Modales de confirmación destructiva: SweetAlert2, icono ámbar de advertencia,
  texto "no se borra de forma definitiva, se puede restaurar desde Auditoría".
- Toast de éxito: check verde `#256B40` sobre `#E3F1E6`, esquina inferior derecha,
  auto-cierre ~2.5-2.8 s.
- Animaciones: 150-220ms ease-out, sin rebote exagerado. Nada de spinners genéricos
  largos; usar skeletons para listas/tablas mientras cargan.

## Layout adaptable

- Escritorio: sidebar fijo de 240px con navegación y sesión. Contenido centrado, ancho máximo 1200px y padding 28-32px.
- Móvil: barra superior compacta y navegación fija inferior; reserva padding inferior para que controles y contenido no queden debajo.
- Usa `100dvh`/áreas seguras donde haga falta. Los diálogos móviles se presentan como panel inferior con scroll interno.
- Tarjetas `surface` con borde `border` de 1px. Reduce padding en móvil sin perder separación entre secciones.
- Tablas solo cuando haya ancho legible. En listas de pacientes e historias, conserva paginación de servidor y muestra tarjetas en pantallas estrechas.
- En tarjetas, prioriza identidad y estado; presenta otros campos como pares etiqueta/valor. No ocultes acciones necesarias.
- Controles y acciones táctiles: mínimo 44px. Mantén búsqueda/filtros a ancho completo en móvil y apílalos en orden de uso.
- Tablas: encabezado `#F7FAF9`, fila 56px, borde inferior sutil `#EEF2F1`. Limita scroll horizontal a gráficos o controles horizontales deliberados.
