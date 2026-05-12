# /public/icons — PWA Icon Placeholder

This directory must contain the following icon files before deploying to production.
Generate them from the darkTunes brand asset using a tool like
[RealFaviconGenerator](https://realfavicongenerator.net/) or
[Maskable.app](https://maskable.app/editor).

## Required files

| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192×192 px | Standard app icon |
| `icon-512.png` | 512×512 px | Standard app icon (high-res) |
| `icon-192-maskable.png` | 192×192 px | Maskable — must have ≥10 % safe-zone padding |
| `icon-512-maskable.png` | 512×512 px | Maskable — must have ≥10 % safe-zone padding |
| `screenshot-desktop.png` | 1280×720 px | Optional — PWA install sheet preview |
| `screenshot-mobile.png` | 390×844 px | Optional — PWA install sheet preview |

## Apple Touch Icon

`icon-192.png` is also used as the `apple-touch-icon` (referenced in
`app/layout.tsx`). It must be a non-transparent PNG with a solid dark
background (`#101010`) so it looks correct on iOS.
