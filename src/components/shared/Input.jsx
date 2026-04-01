// src/components/shared/Input.jsx

import React from "react";

export default function Input({ label, name, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div className="mb-6">
      {label && <label className="block text-sm text-[#050505] mb-3 tracking-wider">{label}</label>}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}