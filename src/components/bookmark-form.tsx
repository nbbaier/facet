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
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
        />
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          name="note"
          placeholder="Add a note (optional)"
          className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
