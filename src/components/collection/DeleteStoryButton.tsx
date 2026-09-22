"use client";

import { deleteStory } from "@/app/actions/deleteStory";
import { t } from "@/lib/i18n";

export default function DeleteStoryButton({ id }: { id: string }) {
  return (
    <form
      action={deleteStory}
      onSubmit={(e) => {
        if (!window.confirm(t("collection.confirmDelete"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={t("collection.delete")}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-card/90 text-sm text-ink-soft ring-1 ring-black/[0.06] backdrop-blur transition hover:text-red-500"
      >
        🗑
      </button>
    </form>
  );
}
