
import React from "react";

interface PageHeaderProps {
  title: string; // Title prop is still here, but won't be rendered as h1
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  // Update component to render only description if present
  return (
    <div className="mb-6">
      {/* The h1 element that displayed the title has been removed */}
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

