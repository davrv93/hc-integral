# Dirección visual y pautas de interfaz

## Marca

HC Integral es una herramienta clínica interdisciplinaria para profesionales de salud y personal administrativo. Debe transmitir calma, claridad y rigor durante tareas clínicas y de gestión.

Dirección: **clínico editorial**. Conserva identidad existente: verde azulado como acento, fondos claros, bordes suaves, Figtree para interfaz y Source Serif 4 para títulos. Evita apariencia hospitalaria fría, adornos que compitan con información clínica y densidad innecesaria en móvil.

La referencia completa de colores, tipografía, estados, radios y sombras vive en `docs/design-system.md`. Usa tokens de Tailwind definidos en `web/tailwind.config.ts`; no introduzcas valores visuales aislados sin motivo.

## Patrones de interfaz

- Diseña móvil primero. Apila filtros y controles; permite filtros de ancho completo y botones primarios fáciles de alcanzar.
- Mantén controles táctiles con altura mínima de 44 px, foco visible, etiquetas asociadas y estados disabled/loading claros.
- Muestra listas paginadas como tarjetas legibles en pantallas estrechas. Mantén tablas solo donde haya espacio; conserva paginación existente y no reemplaces listas grandes por carga ilimitada.
- En tarjetas, prioriza nombre o identificador y muestra metadatos como pares etiqueta/valor. No uses solo color para comunicar estado.
- Permite desplazamiento horizontal solo en controles horizontales deliberados, como pestañas; evita que tablas fuercen scroll de página.
- En formularios, conserva orden lógico, etiquetas persistentes, campos de ancho completo en móvil y acciones visibles sin tapar navegación ni contenido.
- Presenta diálogos como panel inferior en móvil y centrados en escritorio. Limita altura, permite scroll interno y respeta área segura del dispositivo.
- Usa badges con texto para estados; gráficas con leyenda o etiquetas. Conserva las confirmaciones de acciones destructivas.
- Mantén el idioma de interfaz en español y usa copy corto, claro y consistente.

## Datos clínicos

Reduce ruido visual sin truncar información necesaria para identificar paciente, estado o próxima acción. Conserva jerarquía, contexto y mensajes de error. Trata datos de pacientes como sensibles; no agregues datos reales a capturas, logs ni ejemplos.
