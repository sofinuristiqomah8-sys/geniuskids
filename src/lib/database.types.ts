/**
 * Database types matching supabase/migrations/0001_init.sql.
 * Hand-authored (kept in sync with the SQL). If you later run
 * `supabase gen types typescript`, you can replace this file.
 */

export type StoryStatus =
  | "pending"
  | "generating_text"
  | "generating_assets"
  | "ready"
  | "error";

export type SceneStatus =
  | "pending"
  | "image_ready"
  | "audio_ready"
  | "ready"
  | "error";

export type Gender = "male" | "female";

/** One karaoke timing entry for a spoken word. */
export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
};

export type ChildRow = {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  photo_path: string | null;
  character_description: string | null;
  created_at: string;
  updated_at: string;
};

export type StoryRow = {
  id: string;
  user_id: string;
  child_id: string;
  theme_id: string;
  theme_label: string | null;
  subtheme_id: string;
  subtheme_label: string | null;
  situation: string | null;
  length_id: string | null;
  language: string;
  status: StoryStatus;
  error_message: string | null;
  title: string | null;
  opener_text: string | null;
  moral_text: string | null;
  doa_arabic: string | null;
  doa_latin: string | null;
  doa_translation: string | null;
  parent_activity: string | null;
  parent_questions: string[];
  character_snapshot: string | null;
  opener_audio_path: string | null;
  opener_word_timings: WordTiming[];
  created_at: string;
  updated_at: string;
};

export type SceneRow = {
  id: string;
  story_id: string;
  index: number;
  narration_text: string | null;
  image_prompt: string | null;
  image_path: string | null;
  /** Ordered 2-3 sequential visual prompts for the scene (multi-image pages). */
  image_prompts: string[];
  /** Ordered stored image paths, parallel to image_prompts (null = pending slot). */
  image_paths: (string | null)[];
  audio_path: string | null;
  word_timings: WordTiming[];
  status: SceneStatus;
  created_at: string;
  updated_at: string;
};

export type ChildInsert = {
  name: string;
  id?: string;
  user_id?: string;
  age?: number | null;
  gender?: Gender | null;
  photo_path?: string | null;
  character_description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StoryInsert = {
  child_id: string;
  theme_id: string;
  subtheme_id: string;
  id?: string;
  user_id?: string;
  theme_label?: string | null;
  subtheme_label?: string | null;
  situation?: string | null;
  length_id?: string | null;
  language?: string;
  status?: StoryStatus;
  error_message?: string | null;
  title?: string | null;
  opener_text?: string | null;
  moral_text?: string | null;
  doa_arabic?: string | null;
  doa_latin?: string | null;
  doa_translation?: string | null;
  parent_activity?: string | null;
  parent_questions?: string[];
  character_snapshot?: string | null;
  opener_audio_path?: string | null;
  opener_word_timings?: WordTiming[];
  created_at?: string;
  updated_at?: string;
};

export type SceneInsert = {
  story_id: string;
  index: number;
  id?: string;
  narration_text?: string | null;
  image_prompt?: string | null;
  image_path?: string | null;
  image_prompts?: string[];
  image_paths?: (string | null)[];
  audio_path?: string | null;
  word_timings?: WordTiming[];
  status?: SceneStatus;
  created_at?: string;
  updated_at?: string;
};

/** Minimal Database shape for the supabase-js client generic. */
export type Database = {
  public: {
    Tables: {
      children: {
        Row: ChildRow;
        Insert: ChildInsert;
        Update: Partial<ChildRow>;
        Relationships: [];
      };
      stories: {
        Row: StoryRow;
        Insert: StoryInsert;
        Update: Partial<StoryRow>;
        Relationships: [];
      };
      scenes: {
        Row: SceneRow;
        Insert: SceneInsert;
        Update: Partial<SceneRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      story_status: StoryStatus;
      scene_status: SceneStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
