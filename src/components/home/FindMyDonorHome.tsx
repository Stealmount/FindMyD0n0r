import React from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { FAQ } from "./FAQ";
import { Footer } from "./Footer";
import { DirectoriesHubSection } from "./DirectoriesHubSection";
import { LiveDonorAvailability } from "./LiveDonorAvailability";

interface FindMyDonorHomeProps {
  onNavigate: (view: any) => void;
}

export function FindMyDonorHome({ onNavigate }: FindMyDonorHomeProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-ink-900 overflow-x-hidden">
      <Navbar onNavigate={onNavigate} />
      <main>
        <Hero onNavigate={onNavigate} />
        <LiveDonorAvailability />
        <DirectoriesHubSection onNavigate={onNavigate} />
        <Features />
        <FAQ />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
