import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Phone,
  Send,
  Paperclip,
  Mic,
  CheckCheck,
  Lock,
  Camera
} from 'lucide-react';
import { Message, UserSession } from '../types';
import { realtimeSocket } from '../services/websocket';
import { soundEffects } from '../services/sound';
import { notificationService } from '../services/notification';
import { GoogleAuthModal } from './GoogleAuthModal';
import { AudioRecorder } from './AudioRecorder';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { FileViewerModal } from './FileViewerModal';
import { AppInstallBar } from './AppInstallBar';
import { SensorPrivacyShield } from './SensorPrivacyShield';
import { AvatarModal } from './AvatarModal';

interface VisitorChatPortalProps {
  onStartCall: (callType: 'audio' | 'video', targetRoomId: string, remoteName: string) => void;
  onGoToOperator: () => void;
}

export const VisitorChatPortal: React.FC<VisitorChatPortalProps> = ({
  onStartCall,
  onGoToOperator,
}) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [isInitialTyping, setIsInitialTyping] = useState(true);
  const [isVanishedBySensor, setIsVanishedBySensor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ url: string; name: string; isImage: boolean; size?: number } | null>(null);
  const [adminAvatar, setAdminAvatar] = useState('https://api.dicebear.com/7.x/bottts/svg?seed=SakibHasanOfficial');
  const [facebookUrl, setFacebookUrl] = useState('https://facebook.com');
  const [whatsappNumber, setWhatsappNumber] = useState('+8801700000000');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Persistent visitor room ID
  const [roomId] = useState(() => {
    let stored = localStorage.getItem('nexus_visitor_room_id');
    if (!stored) {
      stored = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      localStorage.setItem('nexus_visitor_room_id', stored);
    }
    return stored;
  });

  // Restore saved session & load settings
  useEffect(() => {
    const saved = localStorage.getItem('nexus_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
      } catch (e) {}
    }
    // Fetch settings for admin avatar, facebook profile link and whatsapp
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings.admin_avatar) setAdminAvatar(data.settings.admin_avatar);
          if (data.settings.facebook_url) setFacebookUrl(data.settings.facebook_url);
          if (data.settings.whatsapp_number) setWhatsappNumber(data.settings.whatsapp_number);
        }
      })
      .catch(() => {});

    notificationService.requestPermission();
  }, []);

  // Connect WebSocket
  useEffect(() => {
    const userName = session?.name || 'Visitor';
    const userEmail = session?.email || 'visitor@gmail.com';
    const userAvatar = session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`;

    realtimeSocket.connect('user', roomId, userName, userEmail, userAvatar);

    // Initial simulated typing on visitor entry
    setIsInitialTyping(true);
    const typingTimer = setTimeout(() => {
      setIsInitialTyping(false);
      fetch(`/api/rooms/${roomId}/messages`)
        .then((r) => r.json())
        .then((data) => {
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages([
              {
                id: 'welcome_' + roomId,
                room_id: roomId,
                sender_type: 'admin',
                sender_name: 'Sakib Hasan',
                sender_email: 'mesakibu4@gmail.com',
                sender_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SakibAdmin',
                message_type: 'text',
                text: 'Please ask if you have any questions.',
                created_at: new Date().toISOString(),
              },
            ]);
          }
        })
        .catch(() => {
          setMessages([
            {
              id: 'welcome_' + roomId,
              room_id: roomId,
              sender_type: 'admin',
              sender_name: 'Sakib Hasan',
              sender_email: 'mesakibu4@gmail.com',
              sender_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SakibAdmin',
              message_type: 'text',
              text: 'Please ask if you have any questions.',
              created_at: new Date().toISOString(),
            },
          ]);
        });
    }, 1200);

    const unsubMsg = realtimeSocket.onMessage((msg) => {
      if (msg.room_id === roomId) {
        setMessages((prev) => [...prev, msg]);
        // Trigger 100% active Real-Time Push Notification & Vibration to Display
        if (msg.sender_type === 'admin') {
          notificationService.show(
            'Sakib Hasan',
            msg.text || (msg.message_type === 'audio' ? '🎙️ Voice message' : '📎 Attachment'),
            msg.sender_avatar || '/icon.svg'
          );
        } else {
          soundEffects.playMessageReceived();
        }
      }
    });

    const unsubHistory = realtimeSocket.onHistory((history) => {
      if (history && history.length > 0) {
        setMessages(history);
      }
    });

    const unsubTyping = realtimeSocket.onTyping((data) => {
      if (data.roomId === roomId) {
        setIsRemoteTyping(data.isTyping);
      }
    });

    const unsubSignals = realtimeSocket.onSignal((signal) => {
      if (signal.type === 'avatar_updated' && signal.roomId === roomId) {
        setSession((prev) => (prev ? { ...prev, avatar: signal.avatarUrl } : null));
      }
      if (signal.type === 'admin_avatar_updated' && signal.avatarUrl) {
        setAdminAvatar(signal.avatarUrl);
      }
    });

    return () => {
      clearTimeout(typingTimer);
      unsubMsg();
      unsubHistory();
      unsubTyping();
      unsubSignals();
    };
  }, [roomId, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isInitialTyping, isRemoteTyping]);

  const requireAuth = (callback: () => void) => {
    if (!session || !session.isGoogleAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    callback();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    realtimeSocket.sendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      realtimeSocket.sendTyping(false);
    }, 1200);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    requireAuth(() => {
      realtimeSocket.sendTyping(false);
      realtimeSocket.sendMessage({
        roomId,
        sender_type: 'user',
        sender_name: session!.name,
        sender_email: session!.email,
        sender_avatar: session!.avatar,
        message_type: 'text',
        text: inputText.trim(),
      });

      soundEffects.playMessageSent();
      setInputText('');
    });
  };

  const handleSendAudio = (audioData: { base64Data: string; duration: number }) => {
    requireAuth(() => {
      setIsRecordingAudio(false);

      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: audioData.base64Data,
          fileName: `voice_${Date.now()}.webm`,
          mimeType: 'audio/webm',
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.url) {
            realtimeSocket.sendMessage({
              roomId,
              sender_type: 'user',
              sender_name: session!.name,
              sender_email: session!.email,
              sender_avatar: session!.avatar,
              message_type: 'audio',
              media_url: res.url,
              file_name: `Voice Note (${audioData.duration}s)`,
              file_size: res.fileSize,
            });
            soundEffects.playMessageSent();
          }
        });
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    requireAuth(() => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const isImg = file.type.startsWith('image/');

        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            fileName: file.name,
            mimeType: file.type,
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.url) {
              realtimeSocket.sendMessage({
                roomId,
                sender_type: 'user',
                sender_name: session!.name,
                sender_email: session!.email,
                sender_avatar: session!.avatar,
                message_type: isImg ? 'image' : 'file',
                media_url: res.url,
                file_name: file.name,
                file_size: file.size,
              });
              soundEffects.playMessageSent();
            }
          });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCallClick = (type: 'audio' | 'video') => {
    requireAuth(() => {
      notificationService.requestPermission();
      onStartCall(type, roomId, 'Sakib Hasan');
    });
  };

  const handleSaveAvatar = (newAvatarUrl: string) => {
    if (session) {
      const updated = { ...session, avatar: newAvatarUrl };
      setSession(updated);
      localStorage.setItem('nexus_user_session', JSON.stringify(updated));
    }
    // Update server & broadcast
    fetch(`/api/rooms/${roomId}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: newAvatarUrl }),
    });
    realtimeSocket.sendSignal({
      type: 'update_avatar',
      roomId,
      avatarUrl: newAvatarUrl,
    });
  };

  const cleanWhatsAppNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanWhatsAppNumber}`;

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden secure-screen-content">
      {/* Top Header: Left: Sakib Hasan Photo + Connected Visitor Photo + 'Sakib Hasan' Logo | Right: Audio & Video Call Icons */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-black border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* Side-by-side Photos: Sakib Hasan's photo + Connected Visitor's photo */}
          <div className="flex items-center -space-x-2 shrink-0">
            {/* Sakib Hasan's Photo */}
            <div
              className="relative w-9 h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-900 shrink-0"
              title="Sakib Hasan (Online)"
            >
              <img
                src={adminAvatar}
                alt="Sakib Hasan"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
            </div>

            {/* Connected Visitor's Photo */}
            <button
              onClick={() => {
                if (session && session.isGoogleAuthenticated) {
                  setIsAvatarModalOpen(true);
                } else {
                  setIsAuthModalOpen(true);
                }
              }}
              className="relative w-9 h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-800 hover:ring-white/50 transition-all shrink-0 group"
              title={session?.name ? `${session.name} (Click to set photo)` : 'Sign in / Set Photo'}
            >
              <img
                src={session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`}
                alt="Connected Visitor"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </button>
          </div>

          {/* Logo strictly 'Sakib Hasan' */}
          <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            Sakib Hasan
          </span>
        </div>

        {/* Right side: Audio Call & Video Call Icons (pure icons, no text) */}
        <div className="flex items-center gap-2">
          {/* Audio Call Icon */}
          <button
            onClick={() => handleCallClick('audio')}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/15"
            title="Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call Icon */}
          <button
            onClick={() => handleCallClick('video')}
            className="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md"
            title="Video Call"
          >
            <Video className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onGoToOperator}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all text-xs font-mono ml-1"
            title="Switch"
          >
            /
          </button>
        </div>
      </header>

      {/* Sensor Privacy Shield (Silent Background Protection, No Text Clutter) */}
      <SensorPrivacyShield
        isVisitor={true}
        onVanishStateChange={(vanished) => setIsVanishedBySensor(vanished)}
      />

      {/* Main Chat Feed with Pure Dark Glossy Card Body */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-3 sm:p-5 pb-1 overflow-hidden bg-black">
        {/* Messages Feed Container: Dark Glossy Glassmorphic Card */}
        <div className="flex-1 overflow-y-auto space-y-3.5 p-3.5 sm:p-5 rounded-2xl glossy-card mb-2.5">
          {messages.map((msg) => {
            const isSelf = msg.sender_type === 'user';
            const isSystem = msg.sender_type === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono border border-white/5">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {/* Pure Glossy Card Message Bubble */}
                <div
                  className={`p-3 sm:p-3.5 max-w-[85%] sm:max-w-md ${
                    isSelf ? 'glossy-bubble-user' : 'glossy-bubble-operator'
                  }`}
                >
                  {!isSelf && (
                    <div className="text-[11px] font-semibold text-emerald-400 mb-1 leading-none">
                      {msg.sender_name}
                    </div>
                  )}

                  {/* Text Message: 100% Stark Pure White */}
                  {msg.message_type === 'text' && (
                    <p className="text-[13px] sm:text-sm text-white whitespace-pre-wrap leading-relaxed select-none font-normal">
                      {msg.text}
                    </p>
                  )}

                  {/* Audio Voice Note */}
                  {msg.message_type === 'audio' && (
                    <VoiceMessagePlayer mediaUrl={msg.media_url || ''} isSelf={isSelf} />
                  )}

                  {/* Image (Mobile Friendly with Anti-Download Shield) */}
                  {msg.message_type === 'image' && (
                    <div className="space-y-1.5 select-none pointer-events-auto">
                      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                        <img
                          src={msg.media_url}
                          alt={msg.file_name || 'Protected Image'}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-full max-h-72 object-cover rounded-xl"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-zinc-300 font-mono flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Protected</span>
                        </div>
                      </div>
                      {msg.file_name && (
                        <p className="text-[11px] text-zinc-300 font-mono truncate">{msg.file_name}</p>
                      )}
                    </div>
                  )}

                  {/* Document Card (Protected View) */}
                  {msg.message_type === 'file' && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/10 select-none">
                      <div className="p-2 rounded-lg bg-white/10 text-white shrink-0">
                        <Lock className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate max-w-[190px]">
                          {msg.file_name}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {Math.round((msg.file_size || 0) / 1024)} KB · Protected File
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timestamp & WhatsApp Double Checkmarks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-zinc-400 font-mono">
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isSelf && (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-400 ml-0.5 inline-block" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator: Appears on entry and live when typing */}
          {(isInitialTyping || isRemoteTyping) && (
            <div className="flex flex-col items-start animate-in fade-in duration-150">
              <div className="p-3 px-4 rounded-2xl glossy-bubble-operator flex items-center gap-2.5">
                <span className="text-xs text-white">Sakib Hasan is typing</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Messenger-Style Chat Dock */}
        <div className="p-2 sm:p-2.5 rounded-2xl glossy-card shrink-0">
          {isRecordingAudio ? (
            <AudioRecorder
              onSendAudio={handleSendAudio}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
              {/* File / Image Share */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors"
                title="Share photo or file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Voice Note Mic */}
              <button
                type="button"
                onClick={() => setIsRecordingAudio(true)}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors"
                title="Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Message Input Box */}
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 min-w-0"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Underneath Chat: Facebook (Left) | Google (Middle - Login) | WhatsApp (Right) */}
        <div className="flex items-center justify-between px-6 py-2.5 mt-1 shrink-0">
          {/* Left: Facebook Logo linking to profile */}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group"
            title="Sakib Hasan Facebook Profile"
          >
            <svg className="w-5 h-5 fill-[#1877F2] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>

          {/* Middle: Google Logo (Click to Login) */}
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group p-2"
            title="Google Sign-In"
          >
            <svg className="w-full h-full group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </button>

          {/* Right: WhatsApp Logo */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group"
            title="Chat on WhatsApp"
          >
            <svg className="w-5 h-5 fill-[#25D366] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M12.031 0C5.397 0 .016 5.382.016 12.016c0 2.12.553 4.192 1.606 6.012L.004 24l6.167-1.616c1.758.958 3.738 1.464 5.86 1.464 6.634 0 12.016-5.382 12.016-12.016S18.665 0 12.031 0zm0 21.996c-1.802 0-3.568-.484-5.109-1.398l-.367-.218-3.795.995 1.013-3.698-.239-.38a9.96 9.96 0 0 1-1.534-5.28c0-5.512 4.484-9.996 9.996-9.996 5.513 0 9.996 4.484 9.996 9.996 0 5.513-4.483 9.996-9.996 9.996zm5.474-7.491c-.3-.15-1.774-.875-2.049-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.266-.467-2.411-1.488-.891-.795-1.493-1.777-1.668-2.077-.175-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525s-.675-1.625-.925-2.225c-.244-.583-.492-.504-.675-.513l-.575-.01c-.2 0-.525.075-.8.375s-1.05 1.025-1.05 2.5 1.075 2.9 1.225 3.1c.15.2 2.116 3.231 5.127 4.532.716.31 1.275.495 1.71.633.72.229 1.375.197 1.893.12.577-.086 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
            </svg>
          </a>
        </div>
      </main>

      {/* Self-Hosted Android & Apple Webview Add to Home Screen Bar */}
      <AppInstallBar />

      {/* Profile Photo Customization Modal */}
      {session && (
        <AvatarModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          currentAvatar={session.avatar}
          userName={session.name}
          onSaveAvatar={handleSaveAvatar}
        />
      )}

      {/* Google Sign-in Modal */}
      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newSession) => {
          setSession(newSession);
        }}
      />

      {/* File Lightbox Modal */}
      {selectedFile && (
        <FileViewerModal
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          fileUrl={selectedFile.url}
          fileName={selectedFile.name}
          fileSize={selectedFile.size}
          isImage={selectedFile.isImage}
        />
      )}
    </div>
  );
};
