import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Activity, BarChart3 } from 'lucide-react';
import '../styles/navbar.css';
import choucairLogo from '../../public/LogoChoucair.png'; // Ajusta la ruta según donde pongas tu imagen

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__container">
        {/* Logo */}
        <NavLink to="/" className="navbar__logo">
          <img
            src={choucairLogo}
            alt="Choucair Business Centric Testing"
            className="navbar__logo-img"
          />
          <div className="navbar__logo-text">
            <span className="navbar__logo-registered"></span>
            <span className="navbar__logo-subtitle">
      
            </span>
          </div>
        </NavLink>
      </div>
    </header>
  );
}