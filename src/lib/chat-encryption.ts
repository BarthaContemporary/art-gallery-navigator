
// Simplified and robust chat encryption with comprehensive error logging
export class ChatEncryption {
  private static keyCache = new Map<string, CryptoKey>();
  private static readonly CACHE_MAX_SIZE = 50;

  // Generate a consistent room-based key that works for all participants
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    console.log('ChatEncryption: Generating room key for:', { roomId, userId });
    
    if (!roomId || typeof roomId !== 'string') {
      console.error('ChatEncryption: Invalid roomId provided:', roomId);
      throw new Error('Valid roomId is required for key generation');
    }

    // Use roomId as the primary key source for consistency across all users
    const cacheKey = `room_${roomId}`;
    
    if (this.keyCache.has(cacheKey)) {
      console.log('ChatEncryption: Using cached key for room:', roomId);
      return this.keyCache.get(cacheKey)!;
    }

    try {
      console.log('ChatEncryption: Creating new encryption key for room:', roomId);
      
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

      // Test the key immediately after generation
      const testResult = await this.testKey(derivedKey);
      if (!testResult) {
        console.error('ChatEncryption: Generated key failed test for room:', roomId);
        throw new Error('Generated key failed validation test');
      }

      // Manage cache size
      if (this.keyCache.size >= this.CACHE_MAX_SIZE) {
        const firstKey = this.keyCache.keys().next().value;
        this.keyCache.delete(firstKey);
        console.log('ChatEncryption: Removed oldest key from cache');
      }

      this.keyCache.set(cacheKey, derivedKey);
      console.log('ChatEncryption: Successfully generated and cached key for room:', roomId);
      return derivedKey;
    } catch (error) {
      console.error('ChatEncryption: Failed to generate room key:', { roomId, userId, error });
      throw new Error(`Encryption key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    console.log('ChatEncryption: Attempting to encrypt message of length:', message?.length);
    
    try {
      if (!message || typeof message !== 'string') {
        console.error('ChatEncryption: Invalid message input:', typeof message);
        throw new Error('Invalid message input - must be a non-empty string');
      }

      if (message.length > 10000) {
        console.error('ChatEncryption: Message too long:', message.length);
        throw new Error('Message too long (max 10000 characters)');
      }

      if (!key) {
        console.error('ChatEncryption: No encryption key provided');
        throw new Error('No encryption key provided');
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      console.log('ChatEncryption: Encrypting with AES-GCM...');
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
      const result = btoa(String.fromCharCode(...combined));
      console.log('ChatEncryption: Successfully encrypted message, result length:', result.length);
      return result;
    } catch (error) {
      console.error('ChatEncryption: Encryption failed:', {
        messageLength: message?.length,
        messageType: typeof message,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Message encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async decryptMessage(encryptedData: string, key: CryptoKey): Promise<string> {
    console.log('ChatEncryption: Attempting to decrypt message of length:', encryptedData?.length);
    
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        console.error('ChatEncryption: Invalid encrypted data input:', typeof encryptedData);
        throw new Error('Invalid encrypted data - must be a non-empty string');
      }

      if (!key) {
        console.error('ChatEncryption: No decryption key provided');
        throw new Error('No decryption key provided');
      }

      // Decode from base64
      console.log('ChatEncryption: Decoding base64 data...');
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      if (combined.length < 12) {
        console.error('ChatEncryption: Encrypted data too short:', combined.length);
        throw new Error('Invalid encrypted data length (too short)');
      }

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      console.log('ChatEncryption: Decrypting with AES-GCM...');
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);
      console.log('ChatEncryption: Successfully decrypted message of length:', result.length);
      return result;
    } catch (error) {
      console.error('ChatEncryption: Decryption failed:', {
        dataLength: encryptedData?.length,
        dataType: typeof encryptedData,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Message decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static clearCache(): void {
    console.log('ChatEncryption: Clearing encryption cache, keys before:', this.keyCache.size);
    this.keyCache.clear();
    console.log('ChatEncryption: Cache cleared');
  }

  // Test encryption/decryption with a key
  static async testKey(key: CryptoKey): Promise<boolean> {
    try {
      const testMessage = 'test_message_' + Date.now();
      console.log('ChatEncryption: Testing key with message:', testMessage);
      
      const encrypted = await this.encryptMessage(testMessage, key);
      const decrypted = await this.decryptMessage(encrypted, key);
      const success = decrypted === testMessage;
      
      console.log('ChatEncryption: Key test result:', success);
      return success;
    } catch (error) {
      console.error('ChatEncryption: Key test failed:', error);
      return false;
    }
  }

  // Create fallback base64 encoding when encryption fails
  static createFallbackEncoding(message: string): string {
    console.log('ChatEncryption: Creating fallback encoding for message');
    try {
      return btoa(unescape(encodeURIComponent(message)));
    } catch (error) {
      console.error('ChatEncryption: Fallback encoding failed:', error);
      // Last resort: return original message with a prefix
      return 'UNENCRYPTED:' + message;
    }
  }

  // Decode fallback base64 encoding
  static decodeFallbackEncoding(encoded: string): string {
    console.log('ChatEncryption: Attempting to decode fallback encoding');
    try {
      if (encoded.startsWith('UNENCRYPTED:')) {
        return encoded.substring(12);
      }
      return decodeURIComponent(escape(atob(encoded)));
    } catch (error) {
      console.error('ChatEncryption: Fallback decoding failed:', error);
      return encoded; // Return as-is if decoding fails
    }
  }
}
