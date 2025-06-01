
// Enhanced client-side encryption utilities with improved security
export class EnhancedChatEncryption {
  private static readonly ALGORITHM = "AES-GCM";
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 32; // Increased salt length
  private static readonly ITERATIONS = 200000; // Increased iterations
  private static readonly MAX_MESSAGE_LENGTH = 10000;

  // Cache for derived keys to improve performance
  private static keyCache = new Map<string, CryptoKey>();
  private static readonly CACHE_MAX_SIZE = 100;

  private static async generateSecureKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  private static async deriveKeyFromPassword(
    password: string, 
    salt: Uint8Array,
    iterations: number = this.ITERATIONS
  ): Promise<CryptoKey> {
    const cacheKey = `${password}_${Array.from(salt).join(',')}_${iterations}`;
    
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const passwordBuffer = new TextEncoder().encode(password);
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );

    // Manage cache size
    if (this.keyCache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.keyCache.keys().next().value;
      this.keyCache.delete(firstKey);
    }

    this.keyCache.set(cacheKey, derivedKey);
    return derivedKey;
  }

  // Generate room key with user-specific salt for better security
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    if (!userId) {
      throw new Error('User ID required for secure key generation');
    }

    // Create user-specific but deterministic salt
    const saltData = new TextEncoder().encode(`${roomId}-${userId}-chat-salt-2024`);
    const saltHash = await window.crypto.subtle.digest('SHA-256', saltData);
    const salt = new Uint8Array(saltHash.slice(0, this.SALT_LENGTH));

    // Use room ID as base password with user-specific entropy
    const basePassword = `secure-room-${roomId}-${userId}`;
    
    return await this.deriveKeyFromPassword(basePassword, salt);
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
      // Enhanced input validation
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }

      if (message.length > this.MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long (max ${this.MAX_MESSAGE_LENGTH} characters)`);
      }

      // Generate cryptographically secure IV
      const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // Add timestamp for replay attack prevention
      const timestamp = Date.now();
      const messageWithTimestamp = JSON.stringify({ message, timestamp });
      
      const encoder = new TextEncoder();
      const data = encoder.encode(messageWithTimestamp);

      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        data
      );

      // Create HMAC for message integrity and authenticity
      const hmacKey = await this.deriveHMACKey(key);
      const hmac = await this.createHMAC(hmacKey, new Uint8Array(encryptedData));

      // Create version byte for future compatibility
      const version = new Uint8Array([0x01]);

      // Combine version, IV, encrypted data, and HMAC
      const combined = new Uint8Array(
        version.length + iv.length + encryptedData.byteLength + hmac.byteLength
      );
      
      let offset = 0;
      combined.set(version, offset);
      offset += version.length;
      combined.set(iv, offset);
      offset += iv.length;
      combined.set(new Uint8Array(encryptedData), offset);
      offset += encryptedData.byteLength;
      combined.set(new Uint8Array(hmac), offset);

      // Convert to base64 with URL-safe encoding
      return btoa(String.fromCharCode(...combined))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  static async decryptMessage(encryptedMessage: string, key: CryptoKey): Promise<string> {
    try {
      // Enhanced input validation
      if (!encryptedMessage || typeof encryptedMessage !== 'string') {
        throw new Error('Invalid encrypted message input');
      }

      // Restore base64 padding and convert from URL-safe encoding
      const paddedMessage = encryptedMessage
        .replace(/-/g, '+')
        .replace(/_/g, '/') + 
        '='.repeat((4 - encryptedMessage.length % 4) % 4);

      // Convert from base64
      let combined: Uint8Array;
      try {
        combined = new Uint8Array(
          atob(paddedMessage)
            .split('')
            .map(char => char.charCodeAt(0))
        );
      } catch (error) {
        throw new Error('Invalid base64 encoding');
      }

      if (combined.length < 1 + this.IV_LENGTH + 32) {
        throw new Error('Message too short to be valid');
      }

      // Extract version
      const version = combined[0];
      if (version !== 0x01) {
        throw new Error('Unsupported message version');
      }

      // Extract components
      let offset = 1;
      const iv = combined.slice(offset, offset + this.IV_LENGTH);
      offset += this.IV_LENGTH;
      
      const hmac = combined.slice(-32);
      const encryptedData = combined.slice(offset, -32);

      // Verify HMAC for integrity and authenticity
      const hmacKey = await this.deriveHMACKey(key);
      const expectedHmac = await this.createHMAC(hmacKey, encryptedData);
      
      if (!this.constantTimeCompare(hmac, new Uint8Array(expectedHmac))) {
        throw new Error('Message integrity verification failed');
      }

      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedJson = decoder.decode(decryptedData);
      
      // Parse the message with timestamp
      const { message, timestamp } = JSON.parse(decryptedJson);
      
      // Check for replay attacks (message should not be older than 24 hours)
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (now - timestamp > maxAge) {
        console.warn('Message timestamp is too old, possible replay attack');
      }

      return this.sanitizeOutput(message);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }

  // Enhanced HMAC key derivation
  private static async deriveHMACKey(encryptionKey: CryptoKey): Promise<CryptoKey> {
    const keyData = await window.crypto.subtle.exportKey('raw', encryptionKey);
    
    // Use HKDF for key derivation
    const hkdfKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      'HKDF',
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('hmac-salt'),
        info: new TextEncoder().encode('message-auth')
      },
      hkdfKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  private static async createHMAC(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
    return await window.crypto.subtle.sign('HMAC', key, data);
  }

  // Enhanced constant time comparison
  private static constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  // Enhanced output sanitization
  private static sanitizeOutput(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .slice(0, this.MAX_MESSAGE_LENGTH);
  }

  // Key rotation functionality
  static async rotateRoomKey(oldKey: CryptoKey, roomId: string, userId: string): Promise<CryptoKey> {
    // Generate new key with current timestamp for uniqueness
    const timestamp = Date.now();
    const newBasePassword = `secure-room-${roomId}-${userId}-${timestamp}`;
    
    const saltData = new TextEncoder().encode(`${newBasePassword}-rotation-salt`);
    const saltHash = await window.crypto.subtle.digest('SHA-256', saltData);
    const salt = new Uint8Array(saltHash.slice(0, this.SALT_LENGTH));

    return await this.deriveKeyFromPassword(newBasePassword, salt);
  }

  // Clear sensitive data from memory
  static clearKeyCache(): void {
    this.keyCache.clear();
  }

  // Validate encryption key
  static async validateKey(key: CryptoKey): Promise<boolean> {
    try {
      const testMessage = 'test';
      const encrypted = await this.encryptMessage(testMessage, key);
      const decrypted = await this.decryptMessage(encrypted, key);
      return decrypted === testMessage;
    } catch (error) {
      return false;
    }
  }
}
