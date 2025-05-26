import React from "react";

interface PageHeaderProps {
  title: string; // Title prop is still here, potentially for other uses, but won't be rendered as h1
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  // If there's no description, don't render anything.
  if (!description) {
    return null;
  }

  // Otherwise, render the description within a div that has a bottom margin.
  return (
    <div className="mb-6">
      {/* The h1 element that displayed the title has been removed in a previous change */}
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
