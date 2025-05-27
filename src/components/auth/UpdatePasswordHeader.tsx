
import React from 'react';

export const UpdatePasswordHeader: React.FC = () => {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold">Set New Password</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Choose a strong password. Minimum 8 characters.
      </p>
    </div>
  );
};
