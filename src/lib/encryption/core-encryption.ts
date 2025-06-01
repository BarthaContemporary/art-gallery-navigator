
import { ENCRYPTION_CONSTANTS } from './constants';
import { KeyManager } from './key-management';
import { SecurityUtils } from './security-utils';

export class CoreEncryption {
  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }
      if (message.length > 10000) { // Limit message length
        throw new Error('Message too long');
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONSTANTS.IV_LENGTH));
      const encoder = new TextEncoder();
      const data = encoder.encode(message);

      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: ENCRYPTION_CONSTANTS.ALGORITHM,
          iv: iv,
        },
        key,
        data
      );

      // Create HMAC for message integrity
      const hmacKey = await KeyManager.deriveHMACKey(key);
      const hmac = await KeyManager.createHMAC(hmacKey, new Uint8Array(encryptedData));

      // Combine IV, encrypted data, and HMAC
      const combined = new Uint8Array(iv.length + encryptedData.byteLength + hmac.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);
      combined.set(new Uint8Array(hmac), iv.length + encryptedData.byteLength);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  static async decryptMessage(encryptedMessage: string, key: CryptoKey): Promise<string> {
    try {
      // Input validation
      if (!encryptedMessage || typeof encryptedMessage !== 'string') {
        throw new Error('Invalid encrypted message input');
      }

      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedMessage)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract components
      const iv = combined.slice(0, ENCRYPTION_CONSTANTS.IV_LENGTH);
      const hmac = combined.slice(-32); // HMAC-SHA256 is 32 bytes
      const encryptedData = combined.slice(ENCRYPTION_CONSTANTS.IV_LENGTH, -32);

      // Verify HMAC for integrity
      const hmacKey = await KeyManager.deriveHMACKey(key);
      const expectedHmac = await KeyManager.createHMAC(hmacKey, encryptedData);
      
      if (!SecurityUtils.constantTimeCompare(hmac, new Uint8Array(expectedHmac))) {
        throw new Error('Message integrity verification failed');
      }

      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: ENCRYPTION_CONSTANTS.ALGORITHM,
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedData);
      
      // Sanitize output
      return SecurityUtils.sanitizeText(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }
}
