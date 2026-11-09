import { Message, Room } from '../types';

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

  private messageListeners: Set<MessageCallback> = new Set();
  private signalListeners: Set<SignalCallback> = new Set();
  private roomStatusListeners: Set<RoomStatusCallback> = new Set();
  private typingListeners: Set<(data: any) => void> = new Set();
  private historyListeners: Set<(messages: Message[]) => void> = new Set();

  connect(role: 'user' | 'admin', roomId: string, name: string, email: string, avatar: string = '') {
    this.role = role;
    this.roomId = roomId;
    this.userName = name;
    this.userEmail = email;
    this.userAvatar = avatar;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.identify();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
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
        // Schedule auto reconnect
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect(this.role, this.roomId, this.userName, this.userEmail, this.userAvatar);
          }, 3000);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WS error', err);
      };
    } catch (e) {
      console.error('Failed to create WebSocket', e);
    }
  }

  private identify() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'identify',
        role: this.role,
        roomId: this.roomId,
        name: this.userName,
        email: this.userEmail,
        avatar: this.userAvatar
      }));

      if (this.roomId) {
        this.socket.send(JSON.stringify({
          type: 'join_room',
          roomId: this.roomId,
          role: this.role,
          name: this.userName,
          email: this.userEmail
        }));
      }
    }
  }

  switchRoom(newRoomId: string) {
    this.roomId = newRoomId;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'join_room',
        roomId: newRoomId,
        role: this.role,
        name: this.userName,
        email: this.userEmail
      }));
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
    const payload = {
      type: 'chat_message',
      roomId: message.roomId || this.roomId,
      sender_type: message.sender_type || this.role,
      sender_name: message.sender_name || this.userName,
      sender_email: message.sender_email || this.userEmail,
      sender_avatar: message.sender_avatar || this.userAvatar,
      ...message
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      // Fallback to HTTP API
      fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(console.error);
    }
  }

  sendSignal(signal: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(signal));
    }
  }

  sendTyping(isTyping: boolean) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.roomId) {
      this.socket.send(JSON.stringify({
        type: 'typing',
        roomId: this.roomId,
        isTyping
      }));
    }
  }

  private handleIncoming(data: any) {
    switch (data.type) {
      case 'new_message':
        this.messageListeners.forEach(fn => fn(data.message));
        break;
      case 'room_history':
        this.historyListeners.forEach(fn => fn(data.messages));
        break;
      case 'room_status_changed':
        this.roomStatusListeners.forEach(fn => fn(data.rooms));
        break;
      case 'typing':
        this.typingListeners.forEach(fn => fn(data));
        break;
      case 'incoming_call':
      case 'call_response':
      case 'call_ended':
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_candidate':
      case 'email_dispatched':
        this.signalListeners.forEach(fn => fn(data));
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
