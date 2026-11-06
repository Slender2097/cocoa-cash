// src/components/ui/MintWarning.tsx
// The "only use a mint you trust" warning, shared by the tip board's mint
// settings and the wallet's Claim. A mint holds the sats behind every token it
// issued, so ecash from an unknown mint is only as good as that mint.
// MIT License

import { isKnownMint } from "@/lib/tip/config";

export function MintWarning({
  mints,
  context,
  trusted,
  onTrust,
}: {
  mints: string[];
  /** "tip": picking mints for the tip button. "claim": a token from a mint not in your list. */
  context: "tip" | "claim";
  trusted: boolean;
  onTrust: (trusted: boolean) => void;
}) {
  const list = mints.join(", ");
  return (
    <div className="text-sm text-yellow-200 bg-yellow-500/10 border border-yellow-400/30 rounded-2xl p-3 text-left break-words">
      {context === "tip" ? (
        <>
          ⚠️ {list} {mints.length > 1 ? "are" : "is"} not in cocoa.cash&apos;s short list of known mints. The mint holds the
          sats behind every tip, so only use a mint you trust.
        </>
      ) : (
        <>
          ⚠️ {list} is not in your mints list{mints.every(isKnownMint) ? "" : " or in cocoa.cash's short list of known mints"}.
          The mint holds the sats behind this token, so only claim from a mint you trust.
        </>
      )}
      <label className="flex items-center gap-2 mt-2">
        <input type="checkbox" checked={trusted} onChange={(e) => onTrust(e.target.checked)} /> I trust this mint
      </label>
    </div>
  );
}
