
import React from "react";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="font-visby text-marine text-sm font-extrabold">{title}</h1>
    </div>
  );
}
