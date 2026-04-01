// src/components/shared/QRScanner.jsx
import React, { useState } from "react";

export default function QRScanner({ onScan }) {
  const [scanning, setScanning] = useState(false);

  const startScan = () => {
    setScanning(true);
    alert(" QR Scanner coming soon (you can add html5-qrcode later)");
    // Example: onScan("cashuA...fakeToken123");
    setScanning(false);
  };

  return (
    <div className="text-center">
      <button
        onClick={startScan}
        disabled={scanning}
        className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-medium flex items-center gap-2 mx-auto"
      >
        {scanning ? " Scanning..." : " Scan QR Code"}
      </button>
    </div>
  );
}