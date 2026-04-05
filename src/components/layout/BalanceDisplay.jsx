// src/components/layout/BalanceDisplay.jsx
import React, { useState, useEffect, useRef } from "react";

export default function BalanceDisplay({ balance }) {
  const [displayBalance, setDisplayBalance] = useState(0);
  const prevBalanceRef = useRef(balance);

  // Smooth Nixie-style count-up animation
  useEffect(() => {
    if (balance === prevBalanceRef.current) return;

    const start = prevBalanceRef.current;
    const end = balance;
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);

      setDisplayBalance(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayBalance(end);
      }
    };

    requestAnimationFrame(animate);
    prevBalanceRef.current = balance;
  }, [balance]);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
      <div className="glass neon-glow rounded-3xl p-8 mx-auto max-w-md">
        <p className="text-xs text-[#4ff4c6] tracking-widest mb-3">YOUR BALANCE</p>
        
        <div className="flex items-baseline justify-center gap-2">
          <div className="nixie-display text-7xl font-bold tracking-[-6px] text-[#4ff4c6]">
            {displayBalance.toLocaleString("en-US")}
          </div>
          <div className="text-3xl text-[#a3ffe0] font-light">sat</div>
        </div>
      </div>
    </div>
  );
}