# Mi Cartera — contexto del proyecto

Cartera personal de inversión sobre la Google Sheet "Inversiones" (ID `1Yr5xY3F9Ajbu_DgCtjrunsAAu7U5CPX5EEomd9LnOsA`). Usuario: español (Badajoz, Europe/Madrid), usa iPhone 16 + PC Windows con Chrome. Responder siempre en español, conciso.

## Arquitectura
- `src/Code_v3.gs`: backend Apps Script (web app). `doGet` es una API JSON protegida con `API_KEY` (Script Property). Acciones: `loadAll`, `loadLogos`, `loadTvLogos`, `loadBench` (ETFs de Yahoo, semanal adjclose), `buildHistory`. Dividendos SIEMPRE brutos.
- `src/Index_v3.html`: cliente único (HTML+CSS+JS). Lo pega el usuario a mano en su proyecto de Apps Script (yo no tengo acceso a él).
- `tools/build_pwa.py`: genera la PWA (`index.html`, `sw.js`, manifest, iconos) a partir de `src/Index_v3.html`: shim `google.script.run`→fetch, caché IndexedDB, pull-to-refresh, etc. Ejecutar desde la raíz: `python3 -I tools/build_pwa.py`. NO editar `index.html` a mano.
- Publicación: GitHub Pages (`javierhurtado/mi-cartera`), URL `https://javierhurtado.github.io/mi-cartera/#u=<url apps script>&k=<api key>`.

## Flujo de trabajo
1. Editar `src/Index_v3.html` (y `src/Code_v3.gs` solo si cambia el backend).
2. `python3 -I tools/build_pwa.py`, comprobar sintaxis JS (extraer `<script>` y `new Function`), probar con Playwright/Chromium (viewport 1300 y 390).
3. Commit + push a `main` → se publica solo en Pages.
4. Avisar al usuario: PC → Ctrl+F5; iOS → reabrir app; Apps Script → volver a pegar `Index_v3.html` (y `Code_v3.gs` + nueva implementación solo si cambió).

## Preferencias del usuario
- Usar siempre los colores PAL existentes; tamaños de texto coherentes con el resto de la UI.
- Móvil (iPhone) ya está perfecto: no cambiar su render al tocar estilos de PC (`@media(min-width:860px)` / `isWide()`).
- Le gustan los mocks (imagen) antes de cambios visuales grandes.
- Sin saltos de altura al cambiar de pestaña/año; leyendas abajo a la derecha; textos de ejes 12px en PC.
- En ACS bruto==neto: dejarlo como está.

## Notas técnicas de gráficos
`bars()`/`line()`/`hbars()`/`donut()` generan SVG con ancho real del contenedor (`clientWidth`); `reg(sel,fn)` registra y redibuja con ResizeObserver al cambiar el ancho; `chartH()` fija alturas en PC; tarjetas `.r1/.r2` con min-height para filas estables; `WX` = vista expandida.
