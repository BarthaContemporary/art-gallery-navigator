
import React from "react";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {/* Updated to use theme's h1 styling, which defaults to font-sans now.
          Explicit font-visby removed. Retained other styles like text-marine. */}
      <h1 className="text-marine text-sm font-extrabold">{title}</h1>
    </div>
  );
}
