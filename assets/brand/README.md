# Nuevos íconos — Smart Inventory

Concepto: un **cubo/caja** (inventario) rodeado por un **aro de escaneo** (OCR / código de barras) y un **destello** (inteligencia / predicción).
Colores de la app (`src/constants/colors.ts`): celeste-verde `#2CC4B4`, azul `#1B3A8F`, intermedio `#237FA1`. Gris notificación `#8A8F98`.

| Carpeta | Contenido | Reemplaza en el repo |
|---|---|---|
| `android_app_icon/` | `icon.png`, `adaptive-icon.png`, `adaptive-icon-foreground/background/monochrome.png`, `icon-playstore-512.png`, `res/mipmap-*` (legacy, round, foreground, monochrome), previews, `alternativo_azul/` | `app_frontend/assets/icon.png`, `adaptive-icon.png` |
| `android_notificacion/` | `notification-icon.png` (96px, gris, fondo transparente), versión blanca, `res/drawable-*/notification_icon.png` | `app_frontend/assets/notification-icon.png` |
| `logo_principal/` | Símbolo sin texto (color, reverso, mono gris/negro/blanco, simple) | — |
| `logo_con_texto/` | "SMART INVENTORY" horizontal y vertical (color, reverso, fondo blanco/azul) | — |
| `web/` | favicons 16–512, `favicon.ico` | `app_frontend/assets/favicon.png` |
| `splash/` | `splash-icon.png` (logo vertical con texto) | `app_frontend/assets/splash-icon.png` |
| `backoffice/` | `logo.png` | `backoffice_frontend/assets/logo.png` |
| `svg/` | Fuentes vectoriales (texto convertido a trazados) | — |

Nota: el color de acento de notificaciones en `app.json` es `#00B5A5`; Android pinta el ícono con ese color, el gris es solo el archivo base (Android usa solo el canal alfa).
