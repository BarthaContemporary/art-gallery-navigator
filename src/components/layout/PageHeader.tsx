
import React from "react";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  // Returning null effectively removes the header from where it's used.
  return null;
}

