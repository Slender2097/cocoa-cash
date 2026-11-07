// src/components/wallet/LightningSheet.tsx
// The way out to Lightning, behind the doorway glyph in the header. It offers
// the Mint (Lightning in) and Melt (pay Lightning) orbs; picking one opens
// that action's usual panel (FlowSheet), unchanged. Like the action panels,
// it sits above the phone keyboard.
// MIT License

import Sheet from "./Sheet";
import Orbs from "./Orbs";
import type { FlowType } from "./Orbs";

export default function LightningSheet({
  onPick,
  onClose,
  resting,
  still,
}: {
  onPick: (type: FlowType) => void;
  onClose: () => void;
  resting?: boolean;
  still?: boolean;
}) {
  return (
    <Sheet title="Lightning in / out" onClose={onClose} keyboard>
      <div className="py-4">
        <Orbs types={["mint", "melt"]} disabled={false} resting={resting} still={still} onPick={onPick} />
      </div>
    </Sheet>
  );
}
