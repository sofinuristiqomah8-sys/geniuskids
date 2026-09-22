/**
 * Detects Apple HEIC/HEIF photos. iPhones save these by default, and desktop
 * browsers (Chrome/Firefox) can't decode them — the file's MIME type is often
 * empty too — so we sniff both the type and the extension.
 */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/**
 * Converts a HEIC/HEIF file to a JPEG File in the browser via `heic2any`
 * (libheif WASM). The library is imported lazily so its ~1.4 MB payload is only
 * fetched when a parent actually picks a HEIC photo. Falls back to the original
 * file if conversion fails (e.g. Safari, which decodes HEIC natively already).
 */
export async function heicToJpeg(file: File, quality = 0.85): Promise<File> {
  if (typeof window === "undefined" || !isHeic(file)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality });
    const blob = Array.isArray(out) ? out[0] : out;
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Browser-side image downscaling.
 *
 * Phone photos are often 3–8 MB / 4000px wide. The character-analysis and
 * illustration steps only need a face at ~768px, so shrinking before upload
 * saves the parent's data, speeds up the upload, and cuts AI processing time.
 * HEIC photos are transcoded to JPEG first (many browsers can't decode HEIC).
 * Falls back to the original file if anything is unsupported.
 */
export async function downscaleImage(
  file: File,
  maxEdge = 768,
  quality = 0.85
): Promise<File> {
  if (typeof window === "undefined") return file;

  // iPhone HEIC → JPEG before anything else, so createImageBitmap can decode it
  // and we never hand the Server Action a multi-MB file it can't downscale.
  if (isHeic(file)) file = await heicToJpeg(file, quality);

  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxEdge / longest);

    // Already small enough — don't re-encode (avoids quality loss).
    if (scale === 1 && file.size < 600_000) {
      bitmap.close?.();
      return file;
    }

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Replace the file inside an <input type="file"> (keeps native form submission). */
export function setInputFile(input: HTMLInputElement, file: File | null): void {
  const dt = new DataTransfer();
  if (file) dt.items.add(file);
  input.files = dt.files;
}
