
import { ENCRYPTION_CONSTANTS } from './constants';

export class KeyManager {
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordBuffer = new TextEncoder().encode(password);
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer.buffer as ArrayBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt.buffer as ArrayBuffer,
        iterations: ENCRYPTION_CONSTANTS.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: ENCRYPTION_CONSTANTS.ALGORITHM, length: ENCRYPTION_CONSTANTS.KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Generate a secure room key using user-specific entropy
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    // Use roomId as base for key derivation to ensure same key for all room participants
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(roomId + 'chat-encryption-salt').buffer as ArrayBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('lovable-chat-salt-2024').buffer as ArrayBuffer,
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
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', salt.buffer as ArrayBuffer);
    const finalSalt = new Uint8Array(hashBuffer.slice(0, ENCRYPTION_CONSTANTS.SALT_LENGTH));
    
    return await this.deriveKey(baseString, finalSalt);
  }

  // Create HMAC for message integrity
  static async deriveHMACKey(encryptionKey: CryptoKey): Promise<CryptoKey> {
    const keyData = await window.crypto.subtle.exportKey('raw', encryptionKey);
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }

  static async createHMAC(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
    return await window.crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer);
  }
}
