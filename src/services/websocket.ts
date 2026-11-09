import { Message, Room } from '../types';
import { db } from './firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

type MessageCallback = (msg: Message) => void;
type SignalCallback = (data: any) => void;
type RoomStatusCallback = (rooms: Room[]) => void;

class RealtimeSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private roomId: string = '';
  private role: 'user' | 'admin' = 'user';
  private userName: string = '';
  private userEmail: string = '';
  private userAvatar: string = '';
  public sessionId: string = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  private messageListeners: Set<MessageCallback> = new Set();
  private signalListeners: Set<SignalCallback> = new Set();
  private roomStatusListeners: Set<RoomStatusCallback> = new Set();
  private typingListeners: Set<(data: any) => void> = new Set();
  private historyListeners: Set<(messages: Message[]) => void> = new Set();

  private firestoreSignalUnsub: Unsubscribe | null = null;
  private firestoreMessageUnsub: Unsubscribe | null = null;
  private processedSignals: Set<string> = new Set();
  private processedMessages: Set<string> = new Set();

  connect(role: 'user' | 'admin', roomId: string, name: string, email: string, avatar: string = '') {
    this.role = role;
    this.roomId = roomId;
    this.userName = name;
    this.userEmail = email;
    this.userAvatar = avatar;

    // 1. Setup Firestore Realtime Listeners (Dual Signaling for Vercel & PWA)
    this.setupFirestoreListeners(roomId);

    // 2. Setup WebSocket connection (if local dev / Node server available)
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.identify();
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.identify();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncoming(data);
        } catch (e) {
          console.error('WS Parse error', e);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        // Schedule auto reconnect for WebSocket
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect(this.role, this.roomId, this.userName, this.userEmail, this.userAvatar);
          }, 4000);
        }
      };

      this.socket.onerror = () => {
        // WebSocket error is expected on serverless/Vercel platforms; Firestore real-time seamlessly handles traffic
      };
    } catch {
      // Handled via Firestore fallback
    }
  }

  private setupFirestoreListeners(roomId: string) {
    if (!roomId) return;

    // Clean previous Firestore listeners
    if (this.firestoreSignalUnsub) {
      this.firestoreSignalUnsub();
      this.firestoreSignalUnsub = null;
    }
    if (this.firestoreMessageUnsub) {
      this.firestoreMessageUnsub();
      this.firestoreMessageUnsub = null;
    }

    try {
      // Listen to signals for this room (handles Audio/Video calling on Vercel)
      const signalsColl = collection(db, 'rooms', roomId, 'signals');
      this.firestoreSignalUnsub = onSnapshot(
        signalsColl,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const signal = change.doc.data();
              const docId = change.doc.id;

              // Don't process self-generated signals or duplicate signals
              if (signal.fromSessionId !== this.sessionId && !this.processedSignals.has(docId)) {
                this.processedSignals.add(docId);
                // Only process signals created within the last 45 seconds to avoid old stale triggers
                const now = Date.now();
                if (!signal.timestamp || (now - signal.timestamp < 45000)) {
                  this.signalListeners.forEach((fn) => fn(signal));
                }
              }
            }
          });
        },
        (error) => {
          console.warn('Firestore signals listener notice:', error.message);
        }
      );

      // Listen to messages for this room (handles Realtime Chat on Vercel)
      const messagesColl = collection(db, 'rooms', roomId, 'messages');
      this.firestoreMessageUnsub = onSnapshot(
        messagesColl,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const msgData = change.doc.data();
              const docId = change.doc.id;

              if (msgData.fromSessionId !== this.sessionId && !this.processedMessages.has(docId)) {
                this.processedMessages.add(docId);
                const normalized: Message = {
                  id: docId,
                  room_id: roomId,
                  sender_type: msgData.sender_type || msgData.senderType || 'user',
                  sender_name: msgData.sender_name || msgData.senderName || 'Anonymous',
                  sender_email: msgData.sender_email || msgData.senderEmail || '',
                  sender_avatar: msgData.sender_avatar || msgData.senderAvatar,
                  message_type: msgData.message_type || msgData.messageType || 'text',
                  text: msgData.text,
                  media_url: msgData.media_url || msgData.mediaUrl,
                  file_name: msgData.file_name || msgData.fileName,
                  file_size: msgData.file_size || msgData.fileSize,
                  created_at: msgData.created_at || msgData.createdAt || new Date().toISOString(),
                };
                this.messageListeners.forEach((fn) => fn(normalized));
              }
            }
          });
        },
        (error) => {
          console.warn('Firestore messages listener notice:', error.message);
        }
      );
    } catch (err) {
      console.warn('Firestore real-time sync setup warning:', err);
    }
  }

  private identify() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'identify',
          role: this.role,
          roomId: this.roomId,
          name: this.userName,
          email: this.userEmail,
          avatar: this.userAvatar,
        })
      );

      if (this.roomId) {
        this.socket.send(
          JSON.stringify({
            type: 'join_room',
            roomId: this.roomId,
            role: this.role,
            name: this.userName,
            email: this.userEmail,
          })
        );
      }
    }
  }

  switchRoom(newRoomId: string) {
    this.roomId = newRoomId;
    this.setupFirestoreListeners(newRoomId);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'join_room',
          roomId: newRoomId,
          role: this.role,
          name: this.userName,
          email: this.userEmail,
        })
      );
    }
  }

  sendMessage(message: {
    roomId?: string;
    sender_type?: 'user' | 'admin';
    sender_name?: string;
    sender_email?: string;
    sender_avatar?: string;
    message_type: 'text' | 'audio' | 'image' | 'file';
    text?: string;
    media_url?: string;
    file_name?: string;
    file_size?: number;
  }) {
    const targetRoomId = message.roomId || this.roomId;
    const payload = {
      type: 'chat_message',
      roomId: targetRoomId,
      sender_type: message.sender_type || this.role,
      sender_name: message.sender_name || this.userName,
      sender_email: message.sender_email || this.userEmail,
      sender_avatar: message.sender_avatar || this.userAvatar,
      fromSessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      ...message,
    };

    // 1. Send via WebSocket if active
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      // Fallback to HTTP API
      fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    // 2. Dual Write to Firestore (Guarantees Real-time Delivery on Vercel)
    if (targetRoomId) {
      try {
        addDoc(collection(db, 'rooms', targetRoomId, 'messages'), {
          roomId: targetRoomId,
          senderType: payload.sender_type,
          sender_type: payload.sender_type,
          senderName: payload.sender_name,
          sender_name: payload.sender_name,
          senderEmail: payload.sender_email,
          sender_email: payload.sender_email,
          senderAvatar: payload.sender_avatar || '',
          sender_avatar: payload.sender_avatar || '',
          messageType: payload.message_type,
          message_type: payload.message_type,
          text: payload.text || '',
          mediaUrl: payload.media_url || '',
          media_url: payload.media_url || '',
          fileName: payload.file_name || '',
          file_name: payload.file_name || '',
          fileSize: payload.file_size || 0,
          file_size: payload.file_size || 0,
          createdAt: payload.createdAt,
          fromSessionId: this.sessionId,
          timestamp: Date.now(),
        }).catch((e) => console.warn('Firestore message write notice:', e.message));
      } catch (err) {
        console.warn('Firestore message err:', err);
      }
    }
  }

  sendSignal(signal: any) {
    const targetRoomId = signal.roomId || this.roomId;
    const enrichedSignal = {
      ...signal,
      roomId: targetRoomId,
      fromSessionId: this.sessionId,
      timestamp: Date.now(),
    };

    // 1. Send via WebSocket if connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(enrichedSignal));
    }

    // 2. Dual Write to Firestore (Ensures WebRTC calling works 100% on Vercel)
    if (targetRoomId) {
      try {
        addDoc(collection(db, 'rooms', targetRoomId, 'signals'), enrichedSignal).catch((e) =>
          console.warn('Firestore signal write notice:', e.message)
        );
      } catch (err) {
        console.warn('Firestore signal err:', err);
      }
    }
  }

  sendTyping(isTyping: boolean) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.roomId) {
      this.socket.send(
        JSON.stringify({
          type: 'typing',
          roomId: this.roomId,
          isTyping,
        })
      );
    }
  }

  private handleIncoming(data: any) {
    switch (data.type) {
      case 'new_message':
        this.messageListeners.forEach((fn) => fn(data.message));
        break;
      case 'room_history':
        this.historyListeners.forEach((fn) => fn(data.messages));
        break;
      case 'room_status_changed':
        this.roomStatusListeners.forEach((fn) => fn(data.rooms));
        break;
      case 'typing':
        this.typingListeners.forEach((fn) => fn(data));
        break;
      case 'incoming_call':
      case 'call_response':
      case 'call_ended':
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_candidate':
      case 'email_dispatched':
        this.signalListeners.forEach((fn) => fn(data));
        break;
    }
  }

  onMessage(callback: MessageCallback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onSignal(callback: SignalCallback) {
    this.signalListeners.add(callback);
    return () => this.signalListeners.delete(callback);
  }

  onRoomStatus(callback: RoomStatusCallback) {
    this.roomStatusListeners.add(callback);
    return () => this.roomStatusListeners.delete(callback);
  }

  onTyping(callback: (data: any) => void) {
    this.typingListeners.add(callback);
    return () => this.typingListeners.delete(callback);
  }

  onHistory(callback: (messages: Message[]) => void) {
    this.historyListeners.add(callback);
    return () => this.historyListeners.delete(callback);
  }

  disconnect() {
    if (this.firestoreSignalUnsub) {
      this.firestoreSignalUnsub();
      this.firestoreSignalUnsub = null;
    }
    if (this.firestoreMessageUnsub) {
      this.firestoreMessageUnsub();
      this.firestoreMessageUnsub = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const realtimeSocket = new RealtimeSocketService();
