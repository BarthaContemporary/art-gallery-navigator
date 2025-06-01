
// Simplified chat encryption with better error handling
export class ChatEncryption {
  private static keyCache = new Map<string, CryptoKey>();

  // Generate a consistent room-based key
  static async generateRoomKey(roomId: string): Promise<CryptoKey> {
    const cacheKey = `room_${roomId}`;
    
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    try {
      // Create deterministic key based on room ID
      const encoder = new TextEncoder();
      const data = encoder.encode(roomId + '_chat_key_v1');
      
      // Import as raw key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.digest('SHA-256', data),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      this.keyCache.set(cacheKey, keyMaterial);
      return keyMaterial;
    } catch (error) {
      console.error('Failed to generate room key:', error);
      throw new Error('Encryption key generation failed');
    }
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
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
      // Decode from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

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
}
