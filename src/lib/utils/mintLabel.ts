// src/lib/utils/mintLabel.ts
// Display form of a mint URL (no scheme, no trailing slash).
// MIT License

export const mintLabel = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
