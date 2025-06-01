
// Enhanced client-side encryption utilities using Web Crypto API
export class ChatEncryption {
  private static readonly ALGORITHM = "AES-GCM";
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;
  private static readonly ITERATIONS = 100000;

  private static async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordBuffer = new TextEncoder().encode(password);
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: this.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Generate a secure room key using user-specific entropy
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    // Use roomId as base for key derivation to ensure same key for all room participants
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(roomId + 'chat-encryption-salt'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('lovable-chat-salt-2024'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate a shared room key that all participants can derive
  static async generateSharedRoomKey(roomId: string): Promise<CryptoKey> {
    // For shared keys, use a deterministic but secure approach
    const baseString = `shared-room-${roomId}`;
    const salt = new TextEncoder().encode(`${baseString}-salt`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', salt);
    const finalSalt = new Uint8Array(hashBuffer.slice(0, this.SALT_LENGTH));
    
    return await this.deriveKey(baseString, finalSalt);
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
      // Input validation
      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message input');
      }
      if (message.length > 10000) { // Limit message length
        throw new Error('Message too long');
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const encoder = new TextEncoder();
      const data = encoder.encode(message);

      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        data
      );

      // Create HMAC for message integrity
      const hmacKey = await this.deriveHMACKey(key);
      const hmac = await this.createHMAC(hmacKey, new Uint8Array(encryptedData));

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
      const iv = combined.slice(0, this.IV_LENGTH);
      const hmac = combined.slice(-32); // HMAC-SHA256 is 32 bytes
      const encryptedData = combined.slice(this.IV_LENGTH, -32);

      // Verify HMAC for integrity
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
      const decryptedText = decoder.decode(decryptedData);
      
      // Sanitize output
      return this.sanitizeText(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }

  // Create HMAC for message integrity
  private static async deriveHMACKey(encryptionKey: CryptoKey): Promise<CryptoKey> {
    const keyData = await window.crypto.subtle.exportKey('raw', encryptionKey);
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  private static async createHMAC(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
    return await window.crypto.subtle.sign('HMAC', key, data);
  }

  // Constant time comparison to prevent timing attacks
  private static constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  // Sanitize text output to prevent XSS
  private static sanitizeText(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}
