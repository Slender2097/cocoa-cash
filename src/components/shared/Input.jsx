// src/components/shared/Input.jsx
import React from "react";

export default function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  className = "",
  ...props
}) {
  return (
    <div className="mb-4">
      {label && <label htmlFor={name} className="block text-sm font-medium mb-1">{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 ${className}`}
        {...props}
      />
    </div>
  );
}