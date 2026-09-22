# public/

Static assets served at the site root.

## Brand logo (required for the current branding)

`config/brand.ts` sets `logoSrc: "/logo.png"`, so the app expects a logo image
here:

```
public/logo.png
```

**Save the Genius Kids logo image as `public/logo.png`.**

It is used for:
- the landing-page hero
- the browser-tab favicon
- the PWA (home-screen) icon

To use a different filename or format (e.g. SVG), update `logoSrc` in
`config/brand.ts` to match. To fall back to the emoji mark instead of an image,
set `logoSrc: undefined`.
