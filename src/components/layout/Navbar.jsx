// src/components/layout/Navbar.jsx
import React from "react";

export default function Navbar() {
  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🍫</span>
        <h1 className="text-2xl font-bold">Cocoa Cash</h1>
      </div>
      <p className="text-sm opacity-75">ecash wallet</p>
    </nav>
  );
}