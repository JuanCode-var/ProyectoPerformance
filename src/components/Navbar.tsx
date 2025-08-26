// src/components/Navbar.tsx
import React from "react";

export default function Navbar() {
  return (
    <header className="w-full border-b bg-white">
      <div className="container h-14 flex items-center">
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
