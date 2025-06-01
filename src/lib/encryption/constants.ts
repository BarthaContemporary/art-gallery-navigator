
// Encryption constants
export const ENCRYPTION_CONSTANTS = {
  ALGORITHM: "AES-GCM" as const,
  KEY_LENGTH: 256,
  IV_LENGTH: 12,
  SALT_LENGTH: 16,
  ITERATIONS: 100000,
} as const;
