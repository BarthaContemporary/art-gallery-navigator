
import React from 'react';

interface ArtworkFieldProps {
  label: string;
  value?: string | number | null | React.ReactNode;
  className?: string;
  multiline?: boolean;
}

export const ArtworkField: React.FC<ArtworkFieldProps> = ({ label, value, className, multiline = false }) => {
  if (value === null || typeof value === 'undefined' || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  return (
    <div className={className || "mb-2"}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm mt-0.5">
        {multiline && typeof value === 'string' ? (
          <div className="whitespace-pre-wrap font-sans text-sm">{value}</div>
        ) : (
          value
        )}
      </dd>
    </div>
  );
};
