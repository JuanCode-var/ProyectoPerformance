// src/components/Navbar.tsx
import React from "react";

export default function Navbar() {
  return (
    <header className="w-full border-b bg-white">
      <div className="w-full max-w-none h-14 flex items-center px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center">
          <img
            src="/LogoChoucair.png"
            alt="Choucair Business Centric Testing"
            className="h-8 w-auto"   // ← controla altura del logo
          />
        </a>
      </div>
    </header>
  );
}
