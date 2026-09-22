/**
 * ============================================================================
 *  AI PROVIDER CONFIG (white-label / pluggable)
 * ============================================================================
 *  Selects which AI service powers each part of the pipeline. Defaults are the
 *  Google AI Studio stack requested for this deployment:
 *    - Story text   : Gemini Flash via AI Studio API key
 *    - Illustrations: Nano Banana / Gemini image via AI Studio API key
 *    - Narration    : Gemini TTS via AI Studio API key
 *
 *  A buyer can override any of these via environment variables WITHOUT touching
 *  core code. The actual API keys live in .env (never commit them).
 *  See .env.example.
 * ============================================================================
 */

export type StoryProvider = "kie" | "gemini" | "claude";
export type ImageProvider = "kie" | "gemini";
export type TtsProvider = "elevenlabs" | "google" | "webspeech";

export type ProviderConfig = {
  story: {
    provider: StoryProvider;
    model: string;
  };
  image: {
    provider: ImageProvider;
    model: string;
    /** Aspect ratio requested by the image provider. */
    aspectRatio: string;
    /**
     * Output resolution tier ("1K" | "2K" | "4K" on Nano Banana). "1K" (~1080px)
     * is the cheapest and free-tier friendly; higher tiers cost more per image.
     */
    resolution: string;
  };
  tts: {
    provider: TtsProvider;
    model: string;
    /** Voice name or ID understood by the active TTS provider. */
    voice: string;
    /** Language code for narration. */
    languageCode: string;
    /** Playback speed (1.0 = normal). Kids' narration is usually a touch slower. */
    speakingRate: number;
    stability: number;
    similarityBoost: number;
    style: number;
  };
};

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

export const providers: ProviderConfig = {
  story: {
    provider: env("STORY_PROVIDER", "gemini") as StoryProvider,
    model: env("STORY_MODEL", "gemini-3.5-flash"),
  },
  image: {
    provider: env("IMAGE_PROVIDER", "gemini") as ImageProvider,
    model: env("IMAGE_MODEL", "gemini-3.1-flash-lite-image"),
    aspectRatio: env("IMAGE_ASPECT_RATIO", "4:3"),
    // Default to the cheapest 1K (~1080px) tier so generation stays free/low-cost.
    resolution: env("IMAGE_RESOLUTION", "1K"),
  },
  tts: {
    provider: env("TTS_PROVIDER", "google") as TtsProvider,
    model: env("TTS_MODEL", "gemini-3.1-flash-tts-preview"),
    voice: env("TTS_VOICE", "Kore"),
    languageCode: env("TTS_LANGUAGE_CODE", "id"),
    speakingRate: Number(env("TTS_SPEAKING_RATE", "0.95")),
    stability: Number(env("TTS_STABILITY", "0.5")),
    similarityBoost: Number(env("TTS_SIMILARITY_BOOST", "0.75")),
    style: Number(env("TTS_STYLE", "0")),
  },
};
