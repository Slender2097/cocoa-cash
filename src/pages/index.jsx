/*

// src/pages/index.jsx
import React, { useState } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import MintSection from "@/components/operations/MintSection";
import MeltSection from "@/components/operations/MeltSection";
import SwapSendSection from "@/components/operations/SwapSendSection";
import SwapClaimSection from "@/components/operations/SwapClaimSection";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    activeMint,
    hydrated,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
  } = useCashu();

  const { proofsByMint } = useProofStorage();

  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        <BalanceDisplay balance={balance} activeMint={activeMint} proofsByMint={proofsByMint} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
          />
        </div>

        <pre className="mt-12 p-6 bg-gray-900 text-white rounded-3xl text-sm overflow-auto">
          {JSON.stringify(dataOutput, null, 2)}
        </pre>
      </main>
      <Footer />
    </>
  );
}

// src/pages/index.jsx
import React, { useState } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import MintSection from "@/components/operations/MintSection";
import MeltSection from "@/components/operations/MeltSection";
import SwapSendSection from "@/components/operations/SwapSendSection";
import SwapClaimSection from "@/components/operations/SwapClaimSection";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    activeMint,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
  } = useCashu();

  const { proofsByMint } = useProofStorage();

  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <Navbar activeMint={activeMint} />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">

        // === ALL IMPORTANT INFO AT THE TOP === 
        <BalanceDisplay balance={balance || 0} />

        {activeMint && (
          <div className="text-center mb-8">
            <p className="text-xs text-[#4ff4c6] tracking-widest">CONNECTED TO</p>
            <p className="text-sm text-[#e8fff7] font-medium">{activeMint.replace("https://", "").replace(/\/$/, "")}</p>
          </div>
        )}

        // Status / Last Action 
        {dataOutput && (
          <div className="mb-10 p-5 glass rounded-3xl border border-[#4ff4c6]/30">
            <pre className="text-xs text-[#e8fff7] whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(dataOutput, null, 2)}
            </pre>
          </div>
        )}

        // Operations Grid 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    <Footer />
    </>
  );
}*/

// src/pages/index.jsx
import React, { useState } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import MintSection from "@/components/operations/MintSection";
import MeltSection from "@/components/operations/MeltSection";
import SwapSendSection from "@/components/operations/SwapSendSection";
import SwapClaimSection from "@/components/operations/SwapClaimSection";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    //activeMint,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
  } = useCashu();

  const { activeMint, switchMint } = useProofStorage();

  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // NEW: When user clicks a mint in the navbar
  const handleSelectMint = (mintUrl) => {
    setFormData((prev) => ({ ...prev, mintUrl }));   
    handleSetMint(mintUrl);                           
    switchMint(mintUrl);                              
  };

  return (
    <>
      <Navbar 
        activeMint={activeMint} 
        onSwitchMint={handleSelectMint}     
      />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">

        {/* Top Information Area */}
        <BalanceDisplay balance={balance || 0} />

        {dataOutput && (
          <div className="mb-10 p-5 glass rounded-3xl border border-[#4ff4c6]/30">
            <pre className="text-xs text-[#e8fff7] whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(dataOutput, null, 2)}
            </pre>
          </div>
        )}

        {/* Operations - Lighter cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
            className="light-card"
          />
        </div>
      </div>
    <Footer />

    </>
  );
}