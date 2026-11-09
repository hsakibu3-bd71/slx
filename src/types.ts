export interface Room {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  ip: string;
  is_online: number;
  unread_admin: number;
  unread_user: number;
  created_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_type: 'user' | 'admin' | 'system';
  sender_name: string;
  sender_email?: string;
  sender_avatar?: string;
  message_type: 'text' | 'audio' | 'image' | 'file' | 'call_log';
  text?: string;
  media_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
}

export interface EmailLog {
  id: string;
  message_id?: string;
  room_id?: string;
  recipient: string;
  sender_name: string;
  subject: string;
  content_preview: string;
  status: 'sent' | 'simulated' | 'error';
  details?: string;
  created_at: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isGoogleAuthenticated: boolean;
  role: 'user' | 'admin';
}

export interface CallState {
  isActive: boolean;
  isRinging: boolean;
  isIncoming: boolean;
  callType: 'audio' | 'video';
  roomId: string;
  remoteName: string;
  remoteAvatar?: string;
  startTime?: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}
