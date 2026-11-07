// src/components/wallet/LightningSheet.tsx
// The way out to Lightning, behind the doorway glyph in the header: Mint
// (Lightning in) and Melt (pay Lightning) in one panel. It first offers the
// two orbs; picking one runs that action's usual steps (FlowBody) in place.
// Like the action panels, it sits above the phone keyboard.
// MIT License

import Sheet from "./Sheet";
import Orbs from "./Orbs";
import { FlowBody, TITLES, type FlowProps } from "./FlowSheet";

export type LightningType = "mint" | "melt";

export default function LightningSheet({
  type,
  onPick,
  onBack,
  resting,
  still,
  ...flow
}: Omit<FlowProps, "type"> & {
  /** The action picked, or none yet. */
  type?: LightningType;
  onPick: (type: LightningType) => void;
  onBack: () => void;
  resting?: boolean;
  still?: boolean;
}) {
  return (
    <Sheet title="Lightning in / out" onClose={flow.onClose} busy={flow.isProcessing} keyboard>
      {type ? (
        <>
          <button
            type="button"
            onClick={onBack}
            disabled={flow.isProcessing}
            aria-label={`Back to Lightning in / out (now: ${TITLES[type]})`}
            className="-mt-2 mb-4 flex items-center gap-2 text-sm text-[#a3ffe0]/80 transition hover:text-[#a3ffe0] disabled:opacity-40"
          >
            <span aria-hidden className="text-lg leading-none">‹</span>
            {TITLES[type]}
          </button>
          {/* a fresh flow for each pick */}
          <FlowBody key={type} type={type} {...flow} />
        </>
      ) : (
        <div className="py-4">
          <Orbs types={["mint", "melt"]} disabled={false} resting={resting} still={still} onPick={(t) => onPick(t as LightningType)} />
        </div>
      )}
    </Sheet>
  );
}
