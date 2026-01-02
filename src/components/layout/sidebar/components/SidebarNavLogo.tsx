import React from 'react';
import { Link } from 'react-router-dom';

export function SidebarNavLogo() {
  const LOGO_SRC = "https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg";

  return (
    <div className="flex items-center justify-start pl-4 h-16 mb-2">
      <Link to="/">
        <img
          className="h-9 w-auto"
          src={LOGO_SRC}
          alt="Gallery Logo"
          style={{ maxWidth: 120 }}
        />
      </Link>
    </div>
  );
}
