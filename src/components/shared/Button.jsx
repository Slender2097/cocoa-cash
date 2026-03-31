// src/components/shared/Button.jsx
import React from "react";

export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  ...props
}) {
  const base = "px-6 py-3 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-400",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}