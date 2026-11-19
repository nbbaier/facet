"use client";

import { createBookmark } from "@/app/actions";
import { useActionState, useRef, useEffect } from "react";

type FormState = {
  message: string;
  type: "success" | "error" | "duplicate" | null;
  saveCount?: number;
} | null;

async function createBookmarkAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const result = await createBookmark(formData);
    if (result.duplicate) {
      return {
        message: `Already saved (×${result.saveCount})`,
        type: "duplicate",
        saveCount: result.saveCount,
      };
    }
    return { message: "Bookmark saved!", type: "success" };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Failed to save",
      type: "error",
    };
  }
}

export function BookmarkForm() {
  const [state, formAction, isPending] = useActionState(
    createBookmarkAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.type === "success" || state?.type === "duplicate") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <input
          type="url"
          name="url"
          placeholder="Paste a URL to save..."
          required
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-transparent focus:ring-2 focus:ring-zinc-700 focus:outline-none"
        />
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          name="note"
          placeholder="Add a note (optional)"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-transparent focus:ring-2 focus:ring-zinc-700 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-white px-6 py-2 font-medium text-black transition-colors hover:bg-zinc-200 focus:ring-2 focus:ring-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>

      {state && (
        <p
          className={`text-sm ${
            state.type === "error"
              ? "text-red-400"
              : state.type === "duplicate"
                ? "text-yellow-400"
                : "text-green-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
