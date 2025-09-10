// src/components/Navbar.tsx
import React from "react";

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="w-full max-w-none h-14 flex items-center px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center mx-auto">
          <img
            src="/LogoChoucair.png"
            alt="Choucair Business Centric Testing"
            className="h-8 w-auto"
          />
        </a>
      </div>
    </header>
  );
}
