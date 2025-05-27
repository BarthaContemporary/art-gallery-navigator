
import React from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { CompleteStepProps } from './types';

export const CompleteStep: React.FC<CompleteStepProps> = ({ importStats, onClose }) => {
  return (
    <div className="space-y-4 text-center py-8">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
      <h3 className="text-xl font-medium">Import Complete!</h3>
      <p className="text-muted-foreground">
        Successfully imported {importStats.successful} artworks.
        {importStats.failed > 0 && ` Failed to import ${importStats.failed} artworks.`}
      </p>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
};
