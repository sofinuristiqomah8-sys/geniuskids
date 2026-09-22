import { MAX_IMAGES_PER_SCENE } from "@/lib/ai/story";

/**
 * Helpers for reading a scene's illustration data while tolerating both the new
 * multi-image columns (image_prompts / image_paths) and the legacy singular
 * columns (image_prompt / image_path) on rows created before the feature.
 */

type SceneImageFields = {
  image_prompt?: string | null;
  image_prompts?: unknown;
  image_path?: string | null;
  image_paths?: unknown;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Ordered visual prompts for a scene (falls back to the singular prompt). */
export function sceneImagePrompts(scene: SceneImageFields): string[] {
  const many = toStringArray(scene.image_prompts).slice(0, MAX_IMAGES_PER_SCENE);
  if (many.length > 0) return many;
  const single = typeof scene.image_prompt === "string" ? scene.image_prompt.trim() : "";
  return single ? [single] : [""];
}

/** How many illustrations this scene page shows. */
export function sceneImageCount(scene: SceneImageFields): number {
  return sceneImagePrompts(scene).length;
}

/**
 * Ordered stored image paths for a scene, length matched to the prompt count.
 * Missing slots are null. Falls back to the singular image_path at slot 0.
 */
export function sceneImagePaths(scene: SceneImageFields): Array<string | null> {
  const count = sceneImageCount(scene);
  const stored = Array.isArray(scene.image_paths) ? scene.image_paths : [];
  const paths: Array<string | null> = [];
  for (let i = 0; i < count; i++) {
    const p = stored[i];
    if (typeof p === "string" && p.trim() !== "") paths.push(p);
    else if (i === 0 && typeof scene.image_path === "string" && scene.image_path.trim() !== "")
      paths.push(scene.image_path);
    else paths.push(null);
  }
  return paths;
}

/** A saved ".svg" is the quota-outage placeholder, not a real illustration. */
export function isPlaceholderPath(path: string | null | undefined): boolean {
  return !!path && path.endsWith(".svg");
}
