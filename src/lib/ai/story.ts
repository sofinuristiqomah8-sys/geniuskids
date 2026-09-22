import { providers } from "../../../config/providers";
import { callGoogleText, parseJsonFromText } from "./google";
import { callKieChatCompletion } from "./kie";

/** Structured story script returned by the LLM. */
export type StoryScript = {
  title: string;
  /** Intro paragraph ("Kenalkan, ini Adit…"). */
  opener: string;
  scenes: {
    /** Narration text read aloud on this page. */
    narration: string;
    /**
     * 2-3 English visual prompts describing this page as a CONTINUOUS sequence
     * (beginning → middle → end of the moment), one prompt per illustration.
     */
    imagePrompts: string[];
  }[];
  moral: string;
  doa: {
    arabic: string;
    latin: string;
    translation: string;
  };
  parentGuide: {
    activity: string;
    questions: string[];
  };
};

export type StoryInput = {
  childName: string;
  age: number | null;
  gender: "male" | "female" | null;
  themeLabel: string;
  subThemeLabel: string;
  situation: string | null;
  /** Visual description of the child, kept consistent across all scenes. */
  characterDescription: string;
  sceneCount: number;
};

function buildPrompt(input: StoryInput): string {
  const genderWord =
    input.gender === "female" ? "perempuan" : input.gender === "male" ? "laki-laki" : "anak";
  const ageWord = input.age != null ? `${input.age} tahun` : "usia dini";

  return `Buatkan sebuah cerita anak Islami dalam Bahasa Indonesia yang mendidik, hangat, dan menyenangkan.

TOKOH UTAMA (WAJIB jadi karakter utama dan pahlawan cerita):
- Nama: ${input.childName}
- Jenis kelamin: ${genderWord}
- Usia: ${ageWord}
- Penampilan (jaga KONSISTEN di semua adegan): ${input.characterDescription}

TEMA: ${input.themeLabel}
SUB TEMA (nilai yang ingin ditanamkan): ${input.subThemeLabel}
${input.situation ? `SITUASI NYATA yang ingin diperbaiki: ${input.situation}` : ""}

ALUR CERITA (WAJIB, bagi rata ke ${input.sceneCount} adegan sebagai satu kisah utuh):
1) Pembuka yang mengait: kenalkan ${input.childName} dan suasananya dengan hangat + rasa penasaran.
2) Muncul MASALAH/tantangan yang relevan dengan sub tema; naikkan ketegangan sedikit demi sedikit.
3) PUNCAK (klimaks): ${input.childName} menghadapi pilihan atau keputusan penting.
4) PENYELESAIAN yang hangat dan memuaskan: ${input.childName} belajar, berubah, dan semua terasa lega serta bahagia.
- Hadirkan 1-2 tokoh pendukung BERNAMA (mis. Ibu, Ayah, atau seorang sahabat dengan nama) yang konsisten dari awal sampai akhir.

KETENTUAN:
- Buat TEPAT ${input.sceneCount} adegan (scenes) yang mengalir mengikuti alur di atas menjadi satu kisah utuh.
- "title": judul singkat, khas, dan menggugah rasa penasaran (jangan datar/klise).
- Bahasa sederhana, positif, tanpa menggurui, sesuai anak ${ageWord}.
- Setiap "narration" harus PANJANG, KAYA, dan SERU: tulis 4-6 kalimat yang hidup di TIAP halaman. Munculkan emosi tokoh, detail suasana (suara, warna, gerakan, perasaan), sedikit ketegangan/kejutan yang bikin anak penasaran, dan momen lucu atau mengharukan. Hindari kalimat datar atau ringkasan.
- Buat SERU & LUCU: sisipkan efek suara/onomatope secukupnya (mis. "Wush!", "Deg!", "Hihi!"), humor ringan yang bersih, dan bila pas gunakan SATU frasa BERULANG (refrain) yang muncul di beberapa adegan agar mudah diingat anak. Jangan berlebihan.
- WAJIB ada PERCAKAPAN di sebagian besar adegan: tampilkan ${input.childName} berbicara langsung memakai tanda kutip ("..."), dan boleh ada dialog singkat dengan tokoh lain. Buat gaya bicara ${input.childName} natural, ceria, dan sopan seperti anak ${genderWord} berusia ${ageWord} — cara ${input.childName} berbicara dan cara tokoh lain menyapanya harus sesuai jenis kelaminnya (${genderWord}).
- Nilai Islami & ADAB dijalin ALAMI lewat perbuatan dan percakapan, bukan ceramah: tunjukkan contoh konkret seperti mengucap salam, "Bismillah" sebelum mulai, "Alhamdulillah" saat senang, jujur, sabar, meminta maaf & memaafkan, berbakti pada orang tua, atau berbagi. Sebut Allah dengan wajar sesuai konteks, dan tampilkan momen ${input.childName} berdoa/berdzikir pendek di saat yang pas dalam cerita.
- "opener" memperkenalkan ${input.childName} dengan hangat dan menggugah rasa ingin tahu (seperti "Kenalkan, ini ${input.childName}...").
- Setiap adegan punya "imagePrompts": array berisi 2 sampai 3 prompt BAHASA INGGRIS yang menggambarkan PERSIS peristiwa yang diceritakan di "narration" adegan itu, dipecah menjadi SATU RANGKAIAN BERKESINAMBUNGAN (awal → tengah → akhir dari momen yang sama), satu prompt untuk satu ilustrasi yang berurutan. Prompt WAJIB selaras dengan isi narasi: tokoh, aksi, benda, dan latar yang muncul di gambar harus yang disebut di narasi tersebut (jangan menambah adegan/objek yang tidak ada di narasi). Setiap prompt mendeskripsikan apa yang dilakukan ${input.childName}, ekspresi wajahnya, dan latar tempatnya, sambil menjaga latar/lokasi yang sama dan penampilan ${input.childName} tetap sama persis di seluruh rangkaian. Jadikan ${input.childName} satu-satunya tokoh anak utama yang jelas. Jangan ada teks/tulisan/angka di dalam gambar.
- "moral": pesan moral singkat yang selaras dengan nilai Islami.
- "doa": pilih SATU doa/dzikir pendek yang sahih dan relevan dengan tema. Sertakan teks Arab, transliterasi latin, dan terjemahan Indonesia yang akurat.
- "parentGuide.activity": satu aktivitas bermain peran/percakapan untuk orang tua & anak.
- "parentGuide.questions": tepat 3 pertanyaan reflektif singkat untuk anak.

Balas HANYA JSON valid dengan struktur:
{
  "title": "string",
  "opener": "string",
  "scenes": [
    { "narration": "string", "imagePrompts": ["string", "string", "string"] }
  ],
  "moral": "string",
  "doa": { "arabic": "string", "latin": "string", "translation": "string" },
  "parentGuide": { "activity": "string", "questions": ["string", "string", "string"] }
}`;
}

const storyJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    opener: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          narration: { type: "string" },
          imagePrompts: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3,
          },
        },
        required: ["narration", "imagePrompts"],
      },
    },
    moral: { type: "string" },
    doa: {
      type: "object",
      properties: {
        arabic: { type: "string" },
        latin: { type: "string" },
        translation: { type: "string" },
      },
      required: ["arabic", "latin", "translation"],
    },
    parentGuide: {
      type: "object",
      properties: {
        activity: { type: "string" },
        questions: { type: "array", items: { type: "string" } },
      },
      required: ["activity", "questions"],
    },
  },
  required: ["title", "opener", "scenes", "moral", "doa", "parentGuide"],
};

/** Calls the configured Gemini provider to produce the structured story script. */
export async function generateStoryScript(input: StoryInput): Promise<StoryScript> {
  const prompt = buildPrompt(input);
  let text: string;

  if (providers.story.provider === "gemini") {
    text = await callGoogleText({
      model: providers.story.model,
      input: prompt,
      temperature: 0.9,
      maxTokens: 8192,
      responseJsonSchema: storyJsonSchema,
    });
  } else if (providers.story.provider === "kie") {
    text = await callKieChatCompletion({
      model: providers.story.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      maxTokens: 8192,
      jsonMode: true,
    });
  } else {
    throw new Error(`Provider cerita "${providers.story.provider}" belum didukung.`);
  }

  let parsed: StoryScript;
  try {
    parsed = parseJsonFromText<StoryScript>(text);
  } catch {
    throw new Error("Gagal membaca hasil cerita dari Gemini (format JSON tidak valid).");
  }

  if (!parsed.scenes || parsed.scenes.length === 0) {
    throw new Error("Gemini tidak menghasilkan adegan cerita.");
  }

  // Defensive: some responses return a single string (or a legacy `imagePrompt`).
  // Normalize every scene to a 2-3 item prompt sequence.
  parsed.scenes = parsed.scenes.map((scene) => ({
    ...scene,
    imagePrompts: normalizeImagePrompts(scene),
  }));

  return parsed;
}

/** Max illustrations rendered per scene page. */
export const MAX_IMAGES_PER_SCENE = 3;

/**
 * Coerce a scene's visual prompt(s) into a clean array of 1-3 strings, tolerating
 * models that return a single string or the legacy singular `imagePrompt` field.
 */
export function normalizeImagePrompts(scene: {
  imagePrompts?: unknown;
  imagePrompt?: unknown;
}): string[] {
  const raw = Array.isArray(scene.imagePrompts)
    ? scene.imagePrompts
    : scene.imagePrompts != null
      ? [scene.imagePrompts]
      : scene.imagePrompt != null
        ? [scene.imagePrompt]
        : [];

  const cleaned = raw
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0)
    .slice(0, MAX_IMAGES_PER_SCENE);

  return cleaned.length > 0 ? cleaned : [""];
}

/** A sensible default look description when no photo has been analyzed yet. */
export function fallbackCharacterDescription(input: {
  name: string;
  age: number | null;
  gender: "male" | "female" | null;
}): string {
  const g = input.gender === "female" ? "seorang anak perempuan" : "seorang anak laki-laki";
  const age = input.age != null ? ` berusia sekitar ${input.age} tahun` : "";
  return `${g}${age} bernama ${input.name}, ceria, dengan pakaian rapi dan ramah.`;
}
