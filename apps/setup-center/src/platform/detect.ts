// Runtime platform detection constants.
// Extracted to a separate file to avoid circular dependencies.

export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const IS_WEB = !IS_TAURI;
