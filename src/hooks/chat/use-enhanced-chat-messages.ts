
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatMessage } from './types';
import { EnhancedChatEncryption } from '@/lib/enhanced-encryption';
import { NotificationService } from '@/services/notification-service';
import { SecurityMonitor, logDataAccessEvent } from '@/utils/security-monitoring';

export function useEnhancedChatMessages(userId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const encryptionKeys = useRef<Map<string, CryptoKey>>(new Map());
  const messagesChannel = useRef<any>(null);
  const securityMonitor = SecurityMonitor.getInstance();

  // Enhanced encryption key management with user-specific keys
  const getRoomEncryptionKey = async (roomId: string): Promise<CryptoKey> => {
    if (!userId) {
      throw new Error('User ID required for secure messaging');
    }

    const keyId = `${roomId}_${userId}`;
    
    if (encryptionKeys.current.has(keyId)) {
      return encryptionKeys.current.get(keyId)!;
    }

    try {
      // Generate user-specific room key for enhanced security
      const key = await EnhancedChatEncryption.generateRoomKey(roomId, userId);
      
      // Validate the key before storing
      const isValidKey = await EnhancedChatEncryption.validateKey(key);
      if (!isValidKey) {
        throw new Error('Generated encryption key is invalid');
      }

      encryptionKeys.current.set(keyId, key);
      
      // Log key generation for security monitoring
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'low',
        userId,
        details: {
          action: 'encryption_key_generated',
          roomId: roomId.substring(0, 8) + '***' // Partial room ID for privacy
        }
      });

      return key;
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'high',
        userId,
        details: {
          action: 'encryption_key_generation_failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw new Error('Failed to generate secure encryption key');
    }
  };

  // Enhanced message decryption with security monitoring
  const decryptMessageWithProfile = async (message: any, key: CryptoKey, profilesMap: Map<string, any>) => {
    const senderProfile = profilesMap.get(message.sender_id);
    
    try {
      const decryptedContent = await EnhancedChatEncryption.decryptMessage(message.encrypted_content, key);
      
      // Log successful decryption
      logDataAccessEvent(userId!, 'chat_message', 'decrypt_success');
      
      return { 
        ...message, 
        decrypted_content: decryptedContent,
        sender_profile: senderProfile ? {
          display_name: senderProfile.display_name || 'Unknown User',
          avatar_url: senderProfile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      
      // Log decryption failure for security monitoring
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'medium',
        userId,
        details: {
          action: 'message_decryption_failed',
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      return { 
        ...message, 
        decrypted_content: '[Unable to decrypt message - possible tampering detected]',
        sender_profile: senderProfile ? {
          display_name: senderProfile.display_name || 'Unknown User',
          avatar_url: senderProfile.avatar_url
        } : { display_name: 'Unknown User' }
      };
    }
  };

  // Enhanced message fetching with security validation
  const fetchMessages = async (roomId: string) => {
    if (!userId) return;

    try {
      // Log data access attempt
      logDataAccessEvent(userId, 'chat_messages', 'fetch_attempt');

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        
        securityMonitor.logSecurityEvent({
          type: 'data_access',
          severity: 'medium',
          userId,
          details: {
            action: 'fetch_messages_failed',
            error: error.message,
            roomId: roomId.substring(0, 8) + '***'
          }
        });

        toast.error('Failed to load messages');
        return;
      }

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

      // Fetch profile data for all senders
      const senderIds = data.map(message => message.sender_id);
      const uniqueSenderIds = [...new Set(senderIds)];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueSenderIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create profiles map for efficient lookup
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Decrypt messages with enhanced security
      const key = await getRoomEncryptionKey(roomId);
      const decryptedMessages = await Promise.all(
        data.map(message => decryptMessageWithProfile(message, key, profilesMap))
      );

      setMessages(decryptedMessages);
      
      // Log successful message fetch
      logDataAccessEvent(userId, 'chat_messages', 'fetch_success');
      
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'high',
        userId,
        details: {
          action: 'fetch_messages_exception',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      toast.error('Failed to load messages');
    }
  };

  // Enhanced message sending with validation and monitoring
  const sendMessage = async (content: string, roomId: string, type: 'text' | 'file' | 'image' = 'text') => {
    if (!userId || !content.trim()) return;

    // Validate message content
    if (content.length > 10000) {
      toast.error('Message is too long');
      return;
    }

    // Check for suspicious content patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(content))) {
      securityMonitor.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'high',
        userId,
        details: {
          action: 'suspicious_message_content',
          roomId: roomId.substring(0, 8) + '***'
        }
      });

      toast.error('Message content not allowed');
      return;
    }

    setSending(true);
    
    try {
      // Encrypt message using enhanced encryption
      const key = await getRoomEncryptionKey(roomId);
      const encryptedContent = await EnhancedChatEncryption.encryptMessage(content, key);

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          encrypted_content: encryptedContent,
          message_type: type,
        });

      if (error) throw error;

      // Log successful message send
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'low',
        userId,
        details: {
          action: 'message_sent',
          messageType: type,
          messageLength: content.length
        }
      });

    } catch (error) {
      console.error('Error sending message:', error);
      
      securityMonitor.logSecurityEvent({
        type: 'data_access',
        severity: 'medium',
        userId,
        details: {
          action: 'send_message_failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Enhanced real-time subscription with security monitoring
  const subscribeToMessages = async (roomId: string) => {
    // Clean up existing subscription
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }

    messagesChannel.current = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const newMessage = payload.new as ChatMessage;
        
        try {
          // Validate message integrity
          if (!newMessage.encrypted_content || !newMessage.sender_id) {
            console.warn('Received invalid message structure');
            return;
          }

          // Fetch sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const profilesMap = new Map();
          if (senderProfile) {
            profilesMap.set(senderProfile.id, senderProfile);
          }

          // Decrypt the message with enhanced security
          const key = await getRoomEncryptionKey(roomId);
          const decryptedMessage = await decryptMessageWithProfile(newMessage, key, profilesMap);

          setMessages(prev => [...prev, decryptedMessage]);

          // Show notification if message is from another user
          if (newMessage.sender_id !== userId) {
            const notificationService = NotificationService.getInstance();
            const senderName = senderProfile?.display_name || 'Unknown User';
            const messageContent = decryptedMessage.decrypted_content || 'New message';
            
            // Show in-app notification
            notificationService.showInAppNotification(
              'New Message',
              messageContent,
              senderName
            );

            // Show push notification if the app is in background or not on chat page
            if (document.hidden || !window.location.pathname.includes('/chat')) {
              notificationService.showPushNotification(
                `Message from ${senderName}`,
                messageContent,
                { roomId, senderId: newMessage.sender_id }
              );
            }
          }

          // Log real-time message received
          logDataAccessEvent(userId!, 'chat_message', 'realtime_received');

        } catch (error) {
          console.error('Error handling real-time message:', error);
          
          securityMonitor.logSecurityEvent({
            type: 'data_access',
            severity: 'medium',
            userId,
            details: {
              action: 'realtime_message_error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
          
          // Add message without decryption as fallback
          setMessages(prev => [...prev, {
            ...newMessage,
            decrypted_content: '[Unable to decrypt message]',
            sender_profile: { display_name: 'Unknown User' }
          }]);
        }
      })
      .subscribe();
  };

  // Enhanced cleanup with key clearing
  const cleanup = () => {
    if (messagesChannel.current) {
      supabase.removeChannel(messagesChannel.current);
    }
    
    // Clear encryption keys for security
    encryptionKeys.current.clear();
    
    // Clear any cached decrypted content
    setMessages([]);
  };

  return {
    messages,
    sending,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    cleanup,
  };
}
