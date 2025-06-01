
import { KeyManager } from './key-management';
import { CoreEncryption } from './core-encryption';

// Enhanced client-side encryption utilities using Web Crypto API
export class ChatEncryption {
  // Generate a secure room key using user-specific entropy
  static async generateRoomKey(roomId: string, userId?: string): Promise<CryptoKey> {
    return KeyManager.generateRoomKey(roomId, userId);
  }

  // Generate a shared room key that all participants can derive
  static async generateSharedRoomKey(roomId: string): Promise<CryptoKey> {
    return KeyManager.generateSharedRoomKey(roomId);
  }

  static async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    return CoreEncryption.encryptMessage(message, key);
  }

  static async decryptMessage(encryptedMessage: string, key: CryptoKey): Promise<string> {
    return CoreEncryption.decryptMessage(encryptedMessage, key);
  }
}
