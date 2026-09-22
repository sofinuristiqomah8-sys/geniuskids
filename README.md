# Mykarakids — White-Label Personalized Kids' Storybook Generator

Generate a **personalized flipbook storybook** where the child is the hero:
AI illustrations (consistent character from the child's photo), narration text
with **karaoke word-highlighting**, audio, and an ending with a moral, a doa,
and a parent guide. Built to be **rebranded and resold** (white-label) and
deployed to **Vercel + Supabase**.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS (theme via CSS variables) |
| DB / Auth / Storage | Supabase |
| Story text | Google AI Studio Gemini Flash |
| Illustrations | Google AI Studio Gemini image |
| Narration + karaoke timing | Google AI Studio Gemini TTS |
| Hosting | Vercel |

## White-label: what a buyer edits

| File | Purpose |
|---|---|
| `config/brand.ts` | App name, tagline, logo, **color palette** |
| `config/themes.ts` | Story theme & sub-theme catalog |
| `config/providers.ts` | Which AI providers power each step |
| `messages/id.json` | All UI copy (i18n-ready) |
| `.env.local` | API keys (Supabase, Google AI Studio) |

No core code changes are needed to rebrand. See [`WHITELABEL.md`](./WHITELABEL.md)
for the full rebranding guide and checklist.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000.

### Verify your AI keys (no Supabase needed)

After filling `.env.local`, run the live smoke test — it calls Gemini text,
Gemini image, and Gemini TTS with your Google AI Studio key and saves samples to
`scripts/out/`:

```bash
npm run test:live
```

Use `GEMINI_API_KEY` for one key, or `GEMINI_API_KEYS` for a legitimate
comma-separated key pool. Green `[ok]` on all three means the AI pipeline works
end-to-end.

With 3+ keys in `GEMINI_API_KEYS`, the app splits them by role by default:
key 1 for image, key 2 for story, key 3 for audio, then repeats that pattern.
You can also set explicit `GEMINI_IMAGE_API_KEYS`, `GEMINI_STORY_API_KEYS`, and
`GEMINI_AUDIO_API_KEYS`, or numbered env vars like `GEMINI_IMAGE_API_KEY_1` and
`GEMINI_IMAGE_API_KEY_2`.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for the Vercel + Supabase setup.

## Build status (phased)

- [x] **Phase 0** — Scaffold + white-label config
- [x] **Phase 1** — Supabase schema, storage, RLS
- [x] **Phase 2** — Creation wizard (character + theme)
- [x] **Phase 3** — Story text generation (Google AI Studio Gemini)
- [x] **Phase 4** — Illustration generation (Google AI Studio Gemini image)
- [x] **Phase 5** — Narration + word timings (Google AI Studio Gemini TTS)
- [x] **Phase 6** — Flipbook player with karaoke
- [x] **Phase 7** — Ending panel (moral / doa / parent guide)
- [x] **Phase 8** — Collection library
- [x] **Phase 9** — White-label polish + deploy guide

**All phases complete.** ✅ End-to-end flow: landing → wizard → generation
(text → images → audio, with progress) → opener → karaoke flipbook → ending
panel (moral / doa / parent guide) → collection.
