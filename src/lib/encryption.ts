
// Client-side encryption utilities using Web Crypto API
export class ChatEncryption {
  private static async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
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
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async generateRoomKey(roomId: string, userId: string): Promise<CryptoKey> {
    // Create a deterministic salt from room and user IDs
    const saltString = `${roomId}-${userId}-chat-encryption`;
    const salt = new TextEncoder().encode(saltString);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', salt);
    const finalSalt = new Uint8Array(hashBuffer.slice(0, 16));
    
    // Use room ID as password material
    return await this.deriveKey(roomId, finalSalt);
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  static async decryptMessage(encryptedMessage: string, key: CryptoKey): Promise<string> {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedMessage)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }
}
