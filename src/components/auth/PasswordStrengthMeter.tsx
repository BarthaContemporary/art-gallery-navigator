
import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password?: string;
}

type StrengthLevel = 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';

interface Strength {
  level: StrengthLevel;
  score: number; // 0-4
  color: string;
  widthClass: string;
}

const calculateStrength = (password?: string): Strength => {
  if (!password) {
    return { level: 'Very Weak', score: 0, color: 'bg-red-500', widthClass: 'w-0' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++; // Bonus for longer passwords
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; // Lower and Upper
  if (/\d/.test(password)) score++; // Numbers
  if (/[^A-Za-z0-9]/.test(password)) score++; // Special characters

  // Adjust score to be out of 4 for levels
  let displayScore = 0;
  if (password.length < 8) {
    displayScore = 0;
  } else {
    displayScore = 1; // Base for meeting min length
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) displayScore++;
    if (/\d/.test(password)) displayScore++;
    if (/[^A-Za-z0-9]/.test(password)) displayScore++;
  }


  switch (displayScore) {
    case 0:
      return { level: 'Very Weak', score: 0, color: 'bg-red-500', widthClass: 'w-1/4' };
    case 1:
      return { level: 'Weak', score: 1, color: 'bg-orange-500', widthClass: 'w-1/2' };
    case 2:
      return { level: 'Medium', score: 2, color: 'bg-yellow-500', widthClass: 'w-3/4' };
    case 3:
      return { level: 'Strong', score: 3, color: 'bg-green-500', widthClass: 'w-full' };
    case 4:
      return { level: 'Very Strong', score: 4, color: 'bg-green-600', widthClass: 'w-full' };
    default:
      return { level: 'Very Weak', score: 0, color: 'bg-red-500', widthClass: 'w-1/4' };
  }
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const strength = calculateStrength(password);

  return (
    <div className="mt-2">
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-in-out', strength.color, strength.widthClass)}
        />
      </div>
      <p className={cn('text-xs mt-1', {
        'text-red-500': strength.score <= 1,
        'text-yellow-600': strength.score === 2,
        'text-green-600': strength.score >= 3,
      })}>
        Password strength: {strength.level}
      </p>
      {password && password.length > 0 && password.length < 8 && (
        <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters long.</p>
      )}
    </div>
  );
};

