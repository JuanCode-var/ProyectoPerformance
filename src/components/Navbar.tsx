// src/components/Navbar.tsx
import React from "react";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__container">
        <a href="/" className="navbar__logo">
          <img
            src="/LogoChoucair.png"        // 👈 viene de /public/LogoChoucair.png
            alt="Choucair Business Centric Testing"
            className="navbar__logo-img"
          />
        </a>
      </div>
    </header>
  );
}
