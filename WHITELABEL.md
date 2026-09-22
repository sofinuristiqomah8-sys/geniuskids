# White-Label Rebranding Guide

This app is designed so a buyer can fully rebrand it by editing a small set of
config files — **no changes to core code**. Everything below is optional; sane
defaults ship out of the box.

## 1. Brand identity — `config/brand.ts`

| Field | What it controls |
|---|---|
| `name` | App name (header, landing hero, tab title, PWA name) |
| `tagline` / `subtagline` | Landing hero subtitle |
| `logoEmoji` | Logo mark **and** the browser-tab favicon |
| `logoSrc` | Set to an image path in `/public` (e.g. `"/logo.png"`) to use a real logo instead of the emoji |
| `colors` | The full palette (RGB channels as `"R G B"`). Flows into CSS variables → Tailwind → every screen, plus the PWA theme color |
| `defaultLocale` | UI + content language (default `id`) |
| `links.website` / `links.support` | Optional footer links on the landing page |

Changing `colors.primary`, `colors.accent`, and `colors.surface` alone
re-skins the entire app.

## 2. Story themes — `config/themes.ts`

Add, remove, or rename **Tema Utama** and **Sub Tema** entries and story-length
options. The creation wizard reads this file directly. `id` values are stored in
the database, so keep them stable once live.

## 3. AI providers — `config/providers.ts` + `.env.local`

Defaults use Google AI Studio: Gemini Flash for story/vision, Gemini image for
illustrations, and Gemini TTS for narration. Override per part via env vars — see
`.env.example`:

- `STORY_PROVIDER` / `STORY_MODEL`
- `IMAGE_PROVIDER` / `IMAGE_MODEL` / `IMAGE_ASPECT_RATIO`
- `TTS_PROVIDER` / `TTS_MODEL` / `TTS_VOICE` / `TTS_LANGUAGE_CODE` / `TTS_SPEAKING_RATE`

Change the narration voice, for example, by setting `TTS_VOICE=Sulafat`.

## 4. UI copy — `messages/id.json`

Every visible string lives here. To add another language, drop
`messages/<locale>.json`, register it in `src/lib/i18n.ts` (`catalogs`), and set
`brand.defaultLocale`.

## 5. Keys — `.env.local`

Each buyer supplies **their own** keys (Supabase and Google AI Studio). See
`.env.example` and `DEPLOY.md`.

---

### Rebrand checklist

- [ ] Edit `config/brand.ts` (name, tagline, logo, colors)
- [ ] (Optional) drop a logo image in `/public` and set `brand.logoSrc`
- [ ] Review `config/themes.ts` for your audience
- [ ] Adjust `messages/id.json` copy / voice/tone
- [ ] Set all keys in `.env.local`
- [ ] `npm run build` to confirm it compiles
- [ ] Deploy per `DEPLOY.md`
