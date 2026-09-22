"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createStory, type CreateStoryState } from "@/app/actions/createStory";
import { themes, storyLengths, findTheme } from "../../../config/themes";
import { downscaleImage, isHeic, setInputFile } from "@/lib/image-utils";
import { t } from "@/lib/i18n";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const initialCreateStoryState: CreateStoryState = {
  error: null,
  storyId: null,
};

export default function CreateWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createStory, initialCreateStoryState);

  // On success the action returns the new story id; navigate there client-side
  // so the story page can surface its own errors (instead of a server-action
  // redirect that turns any downstream error into an opaque 500 on /create).
  useEffect(() => {
    if (state.storyId) router.push(`/story/${state.storyId}`);
  }, [state.storyId, router]);

  // Step 1 state
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const ageInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [themeId, setThemeId] = useState(themes[0]?.id ?? "");
  const subThemes = useMemo(() => findTheme(themeId)?.subThemes ?? [], [themeId]);
  const [subThemeId, setSubThemeId] = useState(subThemes[0]?.id ?? "");
  const [lengthId, setLengthId] = useState(storyLengths[0]?.id ?? "auto");

  // Per-field errors (inline) instead of one opaque banner.
  const [errors, setErrors] = useState<{ name?: string; age?: string; photo?: string }>({});

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setErrors((p) => ({ ...p, photo: undefined }));

    // HEIC files often arrive with an empty MIME type, so accept them by
    // extension too — downscaleImage() transcodes them to JPEG.
    if (!file.type.startsWith("image/") && !isHeic(file)) {
      setErrors((p) => ({ ...p, photo: t("wizard.errPhotoType") }));
      setInputFile(input, null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((p) => ({ ...p, photo: t("wizard.errPhotoSize") }));
      setInputFile(input, null);
      return;
    }

    setPhotoBusy(true);
    try {
      // Shrink in the browser so we upload ~100KB instead of several MB.
      const optimized = await downscaleImage(file);
      setInputFile(input, optimized);
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(optimized);
      });
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    if (fileInputRef.current) setInputFile(fileInputRef.current, null);
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors((p) => ({ ...p, photo: undefined }));
  }

  function goNext() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("wizard.errNameRequired");
    if (age !== "" && (Number(age) < 0 || Number(age) > 17)) {
      next.age = t("wizard.errAgeInvalid");
    }
    setErrors((p) => ({ ...p, ...next, name: next.name, age: next.age }));

    if (next.name) return nameInputRef.current?.focus();
    if (next.age) return ageInputRef.current?.focus();
    setStep(2);
  }

  function onThemeChange(id: string) {
    setThemeId(id);
    setSubThemeId(findTheme(id)?.subThemes[0]?.id ?? "");
  }

  return (
    <form action={formAction} className="relative mx-auto w-full max-w-md px-5 py-6">
      <SubmitOverlay pending={pending || !!state.storyId} />

      {/* Step navigation / progress (the app header handles going Home). */}
      <div className="mb-6 flex items-center justify-between text-sm">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="font-semibold text-ink-soft transition hover:text-ink"
          >
            {t("wizard.back")}
          </button>
        ) : (
          <span />
        )}
        <span className="font-semibold text-ink-faint">
          {t("wizard.step", { current: step, total: 2 })}
        </span>
      </div>
      <div
        className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={2}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-accent via-brand-secondary to-brand-primary transition-all duration-500"
          style={{ width: step === 1 ? "50%" : "100%" }}
        />
      </div>

      {state.error && (
        <div
          role="alert"
          className="anim-fade-up mb-5 rounded-card bg-red-50 px-4 py-3 text-sm font-semibold leading-relaxed text-red-700 ring-1 ring-red-100"
        >
          {state.error}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 1 — Tokoh Utama                                              */}
      {/* Kept mounted (hidden on step 2) so all inputs submit with the form */}
      {/* ----------------------------------------------------------------- */}
      <section className={step === 1 ? "block anim-fade-up" : "hidden"}>
        <h1 className="text-2xl font-extrabold text-ink">
          <span className="inline-block bounce-soft">⭐</span> {t("wizard.characterTitle")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{t("wizard.characterSubtitle")}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="child-name" className="field-label">
              {t("wizard.nameLabel")}
            </label>
            <input
              id="child-name"
              ref={nameInputRef}
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder={t("wizard.namePlaceholder")}
              className={`field-input ${errors.name ? "field-error" : ""}`}
              autoComplete="off"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "child-name-err" : undefined}
            />
            {errors.name && (
              <p id="child-name-err" className="mt-1 text-xs font-medium text-red-600">
                {errors.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="child-age" className="field-label">
                {t("wizard.ageLabel")}
              </label>
              <input
                id="child-age"
                ref={ageInputRef}
                name="age"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 2));
                  if (errors.age) setErrors((p) => ({ ...p, age: undefined }));
                }}
                inputMode="numeric"
                placeholder={t("wizard.agePlaceholder")}
                className={`field-input ${errors.age ? "field-error" : ""}`}
                aria-invalid={!!errors.age}
              />
              {errors.age && (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.age}</p>
              )}
            </div>
            <div>
              <label htmlFor="child-gender" className="field-label">
                {t("wizard.genderLabel")}
              </label>
              <select
                id="child-gender"
                name="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female")}
                className="field-input"
              >
                <option value="male">{t("wizard.genderMale")}</option>
                <option value="female">{t("wizard.genderFemale")}</option>
              </select>
            </div>
          </div>

          <div>
            <span className="field-label">
              {t("wizard.photoLabel")}{" "}
              <span className="font-normal text-ink-faint">({t("wizard.photoHint")})</span>
            </span>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              aria-label={photoUrl ? t("wizard.changePhoto") : t("wizard.photoUpload")}
              className={`relative mx-auto flex h-40 w-40 flex-col items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-dashed border-brand-primary/40 bg-brand-primary/5 text-center transition hover:scale-105 hover:bg-brand-primary/10 ${
                photoUrl || photoBusy ? "" : "breathe"
              }`}
            >
              {photoBusy ? (
                <span className="text-xs font-semibold text-brand-primary">
                  {t("wizard.compressing")}
                </span>
              ) : photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Foto anak" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span className="text-3xl">📷</span>
                  <span className="text-sm font-semibold text-brand-primary">
                    {t("wizard.photoUpload")}
                  </span>
                  <span className="text-xs text-ink-faint">{t("wizard.photoUploadSub")}</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              name="photo"
              type="file"
              accept="image/*,.heic,.heif"
              onChange={onPhotoChange}
              className="hidden"
            />

            {photoUrl && !photoBusy && (
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink-soft transition active:scale-95"
                >
                  🔄 {t("wizard.changePhoto")}
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition active:scale-95"
                >
                  🗑 {t("wizard.removePhoto")}
                </button>
              </div>
            )}

            {errors.photo ? (
              <p className="mt-2 text-center text-xs font-medium text-red-600">{errors.photo}</p>
            ) : (
              <p className="mt-2 text-center text-xs text-ink-faint">{t("wizard.photoNote")}</p>
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={photoBusy}
            className="btn-primary mt-2 w-full"
          >
            {t("wizard.next")}
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* STEP 2 — Tema Cerita                                              */}
      {/* ----------------------------------------------------------------- */}
      <section className={step === 2 ? "block anim-fade-up" : "hidden"}>
        <div className="anim-pop mb-5 flex items-center gap-3 rounded-card bg-brand-primary/5 p-4 ring-1 ring-brand-primary/10">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-surface-card ring-2 ring-brand-accent">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🧒</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-ink">🎉 {t("wizard.characterReady")}</p>
            <p className="text-sm text-ink-soft">
              {t("wizard.characterReadyHint", { name: name || "anak" })}{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-semibold text-brand-primary underline"
              >
                {t("wizard.regenerate")}
              </button>
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-ink">📚 {t("wizard.themeTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("wizard.themeSubtitle")}</p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="theme" className="field-label">
                {t("wizard.mainThemeLabel")}
              </label>
              <select
                id="theme"
                name="themeId"
                value={themeId}
                onChange={(e) => onThemeChange(e.target.value)}
                className="field-input"
              >
                {themes.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subtheme" className="field-label">
                {t("wizard.subThemeLabel")}
              </label>
              <select
                id="subtheme"
                name="subThemeId"
                value={subThemeId}
                onChange={(e) => setSubThemeId(e.target.value)}
                className="field-input"
              >
                {subThemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="length" className="field-label">
              {t("wizard.lengthLabel")}{" "}
              <span className="font-normal text-ink-faint">({t("wizard.lengthHint")})</span>
            </label>
            <select
              id="length"
              name="lengthId"
              value={lengthId}
              onChange={(e) => setLengthId(e.target.value)}
              className="field-input"
            >
              {storyLengths.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="situation" className="field-label">
              {t("wizard.situationLabel")}
            </label>
            <textarea
              id="situation"
              name="situation"
              rows={3}
              placeholder={t("wizard.situationPlaceholder")}
              className="field-input resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
              {t("wizard.back")}
            </button>
            <SubmitButton pending={pending} />
          </div>
        </div>
      </section>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="btn-primary flex-1">
      {pending ? "Membuat…" : `✨ ${t("wizard.create")}`}
    </button>
  );
}

/** Full-screen feedback while the server action saves + redirects. */
function SubmitOverlay({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-surface/90 backdrop-blur-sm">
      <div className="float text-5xl">✨</div>
      <p className="text-lg font-extrabold text-ink">{t("wizard.creatingTitle")}</p>
      <p className="max-w-xs text-center text-sm text-ink-soft">{t("wizard.creatingBody")}</p>
      <div className="mt-1 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-primary"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
