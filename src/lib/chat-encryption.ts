
// Simplified and robust chat encryption with proper error handling
export class ChatEncryption {
  private static keyCache = new Map<string, CryptoKey>();
  private static readonly CACHE_MAX_SIZE = 50;

  // Generate a consistent room-based key that works for all participants
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    // Use roomId as the primary key source for consistency across all users
    const cacheKey = `room_${roomId}`;
    
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    try {
      // Create deterministic key based on room ID only (not user-specific)
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(`${roomId}_secure_chat_key_v2`);
      
      // Use PBKDF2 for key derivation
      const baseKey = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.digest('SHA-256', keyMaterial),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const salt = encoder.encode('lovable_chat_salt_2024');
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // Manage cache size
      if (this.keyCache.size >= this.CACHE_MAX_SIZE) {
        const firstKey = this.keyCache.keys().next().value;
        this.keyCache.delete(firstKey);
      }

      this.keyCache.set(cacheKey, derivedKey);
      return derivedKey;
    } catch (error) {
      console.error('Failed to generate room key:', error);
      throw new Error('Encryption key generation failed');
    }
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }

      if (message.length > 10000) {
        throw new Error('Message too long');
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Return as base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Message encryption failed');
    }
  }

  static async decryptMessage(encryptedData: string, key: CryptoKey): Promise<string> {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      // Decode from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      if (combined.length < 12) {
        throw new Error('Invalid encrypted data length');
      }

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Message decryption failed');
    }
  }

  static clearCache(): void {
    this.keyCache.clear();
  }

  // Test encryption/decryption with a key
  static async testKey(key: CryptoKey): Promise<boolean> {
    try {
      const testMessage = 'test_message_' + Date.now();
      const encrypted = await this.encryptMessage(testMessage, key);
      const decrypted = await this.decryptMessage(encrypted, key);
      return decrypted === testMessage;
    } catch (error) {
      return false;
    }
  }
}
