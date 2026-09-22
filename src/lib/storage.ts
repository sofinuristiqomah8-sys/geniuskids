/**
 * Storage path conventions. All object paths are prefixed with the owner's
 * user id so the RLS folder policies in 0001_init.sql apply.
 *
 *   child-photos (private):  <user_id>/<child_id>.<ext>
 *   story-assets (public):   <user_id>/<story_id>/scene-<index>.<ext>
 */

export const BUCKET_CHILD_PHOTOS = "child-photos";
export const BUCKET_STORY_ASSETS = "story-assets";

export function childPhotoPath(userId: string, childId: string, ext = "jpg"): string {
  return `${userId}/${childId}.${ext}`;
}

export function sceneImagePath(
  userId: string,
  storyId: string,
  index: number,
  ext = "png",
  imageIndex?: number
): string {
  // imageIndex undefined → legacy single-image path; >=0 → one of a scene's
  // 2-3 sequential images (scene-<index>-<imageIndex>.<ext>).
  const suffix = imageIndex === undefined ? "" : `-${imageIndex}`;
  return `${userId}/${storyId}/scene-${index}${suffix}.${ext}`;
}

export function sceneAudioPath(
  userId: string,
  storyId: string,
  index: number,
  ext = "mp3"
): string {
  return `${userId}/${storyId}/scene-${index}.${ext}`;
}

export function openerAudioPath(userId: string, storyId: string, ext = "mp3"): string {
  return `${userId}/${storyId}/opener.${ext}`;
}

/**
 * Build the public URL for an object in the PUBLIC story-assets bucket.
 * (Private child photos must use createSignedUrl instead.)
 */
export function storyAssetPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum di-set.");
  return `${base}/storage/v1/object/public/${BUCKET_STORY_ASSETS}/${path}`;
}
