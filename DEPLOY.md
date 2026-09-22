# Deployment Guide — Vercel + Supabase

This is the setup a white-label buyer follows to go live with their own
branding and their own API keys. No core code changes required.

## 1. Rebrand (optional but recommended)

Edit `config/brand.ts`:
- `name`, `tagline`, `subtagline`, `logoEmoji` (or set `logoSrc` to an image in `/public`)
- `colors` — the palette (RGB channels as `"R G B"`)

Edit `config/themes.ts` to adjust the story theme catalog if desired.

## 2. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. **Enable anonymous auth:** Authentication → Providers → **Anonymous** →
   Enable. (Each device gets a stable identity that owns its stories — no
   login screen.)
4. **Run the schema:** open the **SQL Editor** and run
   `supabase/migrations/0001_init.sql`. This single, idempotent file creates all
   tables (including per-page multi-image columns and opener audio), Row Level
   Security policies, and the two storage buckets (`child-photos` = private,
   `story-assets` = public). Safe to re-run on an existing database.

## 3. Get AI provider keys

- **Google AI Studio** (Gemini story/vision, Gemini image, Gemini TTS):
  https://aistudio.google.com/app/apikey → `GEMINI_API_KEY`

For smoother generation, you may set `GEMINI_API_KEYS` to a comma-separated
pool of legitimate Google AI Studio keys/projects that you own or are allowed
to use. The app starts each request on the next key and automatically tries the
next key if Google returns quota/rate-limit errors. Keep `GEMINI_API_KEY` for a
single-key setup.

If `GEMINI_API_KEYS` contains 3+ keys and no role-specific key pool is set, the
app splits them by role: key 1/4/7 for image, key 2/5/8 for story, and key
3/6/9 for audio. For explicit control, set `GEMINI_IMAGE_API_KEYS`,
`GEMINI_STORY_API_KEYS`, and `GEMINI_AUDIO_API_KEYS`.

If Vercel's env UI is easier one key per row, numbered variables work too:
`GEMINI_IMAGE_API_KEY_1`, `GEMINI_IMAGE_API_KEY_2`,
`GEMINI_STORY_API_KEY_1`, and `GEMINI_AUDIO_API_KEY_1`. The helper also accepts
JSON arrays in the `*_API_KEYS` variables.

The Google helper also paces requests and cools down keys after quota/rate-limit
responses. Tune these only if needed: `GOOGLE_AI_IMAGE_MIN_INTERVAL_MS`,
`GOOGLE_AI_STORY_MIN_INTERVAL_MS`, `GOOGLE_AI_AUDIO_MIN_INTERVAL_MS`,
`GOOGLE_AI_RATE_LIMIT_COOLDOWN_MS`, `GOOGLE_AI_MAX_KEY_WAIT_MS`, and
`GOOGLE_AI_BACKOFF_JITTER`.

For audio on Vercel, the app fails fast on temporary Gemini timeout/cooldown and
returns `202` to the browser, then the browser waits and retries the same audio
task. Useful knobs: `GOOGLE_AI_AUDIO_HTTP_TIMEOUT_MS`,
`GOOGLE_AI_AUDIO_MAX_KEY_WAIT_MS`, `NEXT_PUBLIC_GENERATE_AUDIO_RETRY_LIMIT`, and
`NEXT_PUBLIC_GENERATE_AUDIO_RETRY_DELAY_MS`.

```env
GOOGLE_AI_AUDIO_HTTP_TIMEOUT_MS=28000
GOOGLE_AI_AUDIO_MAX_KEY_WAIT_MS=8000
GOOGLE_AI_AUDIO_FAIL_FAST_ON_COOLDOWN=true
GOOGLE_AI_AUDIO_FAIL_FAST_ON_TRANSIENT=true
NEXT_PUBLIC_GENERATE_AUDIO_RETRY_LIMIT=10
NEXT_PUBLIC_GENERATE_AUDIO_RETRY_DELAY_MS=8000

# Illustrations: cheapest 1K (~1080px) resolution, plus free KIE Nano Banana overflow
IMAGE_RESOLUTION=1K
KIE_API_KEY=
# Optional: make KIE Nano Banana the primary illustrator
IMAGE_PROVIDER="kie"
IMAGE_MODEL="google/nano-banana"

# Give images their own dedicated key pool (best), or stop splitting so all keys
# can serve images, or enable billing on the Gemini keys (free-tier image quota is low)
GEMINI_IMAGE_API_KEYS="key1,key2,key3"
GEMINI_API_KEYS_SPLIT_BY_PURPOSE="false"
```

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project** → import the repo.
3. Add all environment variables from `.env.example` under
   **Settings → Environment Variables**.
4. Deploy.

> **Note:** Vercel's free *Hobby* plan is for non-commercial use. For a
> commercial white-label deployment, use a **Pro** plan.

## 5. Cost notes

Roughly per storybook (at each provider's own rates):

| Step | Calls | Provider |
|---|---|---|
| Story text (+ 1 photo analysis) | 1–2 | Google AI Studio Gemini |
| Illustrations | ~4–8 | Google AI Studio Gemini image |
| Narration (opener + each scene) | ~5–9 | Google AI Studio Gemini TTS |

Google AI Studio has free-tier quotas that can change by model and region.
Monitor usage in AI Studio / Google Cloud and adjust models or voices via
`config/providers.ts` or Vercel environment variables.

## 6. Go-live checklist

- [ ] Rebranded `config/brand.ts` (see `WHITELABEL.md`)
- [ ] Supabase project created; **Anonymous auth enabled**
- [ ] Schema run (`0001_init.sql`) — tables + RLS + buckets exist
- [ ] All env vars set in Vercel (Supabase + `GEMINI_API_KEY` or `GEMINI_API_KEYS`)
- [ ] `npm run build` passes locally
- [ ] Test end-to-end once: create a story → generates text/images/audio → flipbook plays → ending panel shows
- [ ] Vercel plan appropriate for commercial use (Pro, not Hobby)
- [ ] Reviewed generated doa/content quality for your audience

## Privacy note

Children's photos are uploaded to a **private** Supabase bucket and used only to
keep illustrations consistent. Deleting a story does not remove the child photo;
add a cleanup step or a "delete my data" flow if your jurisdiction requires it
(e.g. COPPA/GDPR). Obtain parental consent before collecting a child's photo.
