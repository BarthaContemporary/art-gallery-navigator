
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { ImportingStepProps } from './types';

export const ImportingStep: React.FC<ImportingStepProps> = ({ importingProgress, importStats }) => {
  return (
    <div className="space-y-4 text-center py-8">
      <h3 className="text-lg font-medium">Importing Artworks...</h3>
      <Progress value={importingProgress} className="w-full" />
      <p className="text-sm text-muted-foreground">
        {importStats.successful + importStats.failed} / {importStats.total} processed
      </p>
      <p className="text-sm">Successful: {importStats.successful}, Failed: {importStats.failed}</p>
    </div>
  );
};
