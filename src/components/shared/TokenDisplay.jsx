// src/components/shared/TokenDisplay.jsx
import React from "react";
import Button from "./Button";

export default function TokenDisplay({ token, label = "Cashu Token" }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
    alert("✅ Token copied to clipboard!");
  };

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
      <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
      <pre className="text-xs bg-white p-3 rounded-xl overflow-x-auto break-all font-mono">
        {token.length > 120 ? token.substring(0, 120) + "..." : token}
      </pre>
      <Button onClick={copyToClipboard} variant="secondary" className="mt-3 w-full">
        📋 Copy Token
      </Button>
    </div>
  );
}