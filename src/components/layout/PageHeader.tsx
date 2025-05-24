
import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string; // Added optional description prop
}

export function PageHeader({ title, description }: PageHeaderProps) {
  // Update component to render title and description
  return (
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
