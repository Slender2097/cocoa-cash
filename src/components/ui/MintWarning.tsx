// src/components/ui/MintWarning.tsx
// The "only use a mint you trust" warning on the wallet's Claim. It shows for mints the user has not added
// to their own mints list; cocoa.cash keeps no list of its own. A mint holds
// the sats behind every token it issued, so ecash is only as good as its mint.
// MIT License

export function MintWarning({
  mints,
  trusted,
  onTrust,
}: {
  mints: string[];
  trusted: boolean;
  onTrust: (trusted: boolean) => void;
}) {
  const list = mints.join(", ");
  return (
    <div className="text-sm text-yellow-200 bg-yellow-500/10 border border-yellow-400/30 rounded-2xl p-3 text-left break-words">
      ⚠️ {list} {mints.length > 1 ? "are" : "is"} not in your mints list.{" "}
      The mint holds the sats behind this token, so only claim from a mint you trust.
      <label className="flex items-center gap-2 mt-2">
        <input type="checkbox" checked={trusted} onChange={(e) => onTrust(e.target.checked)} /> I trust {mints.length > 1 ? "these mints" : "this mint"}
      </label>
    </div>
  );
}
