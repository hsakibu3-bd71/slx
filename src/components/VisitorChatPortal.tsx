import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Phone,
  Send,
  Paperclip,
  Mic,
  CheckCheck,
  Lock,
  Camera,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  ShieldCheck,
  Zap,
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
  const [hasStartedChat, setHasStartedChat] = useState(false);
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
  }, []);

  // Connect WebSocket & Dual Realtime Sync
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

  // Contextual authentication guard (calls, voice notes, files)
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

  // Immediate text messaging (zero auth barrier)
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const senderName = session?.name || 'Visitor';
    const senderEmail = session?.email || 'visitor@guest.com';
    const senderAvatar = session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`;

    realtimeSocket.sendTyping(false);
    realtimeSocket.sendMessage({
      roomId,
      sender_type: 'user',
      sender_name: senderName,
      sender_email: senderEmail,
      sender_avatar: senderAvatar,
      message_type: 'text',
      text: inputText.trim(),
    });

    soundEffects.playMessageSent();
    setInputText('');
  };

  const handleSendAudio = (audioData: { base64Data: string; duration: number }) => {
    setIsRecordingAudio(false);

    const isMp4 = audioData.base64Data.includes('audio/mp4') || audioData.base64Data.includes('audio/aac');
    const ext = isMp4 ? 'mp4' : 'webm';
    const mime = isMp4 ? 'audio/mp4' : 'audio/webm';

    const dispatchVoiceNote = (mediaUrl: string, fileSize?: number) => {
      realtimeSocket.sendMessage({
        roomId,
        sender_type: 'user',
        sender_name: session?.name || 'Visitor',
        sender_email: session?.email || 'visitor@guest.com',
        sender_avatar: session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`,
        message_type: 'audio',
        media_url: mediaUrl,
        file_name: `Voice Note (${audioData.duration}s)`,
        file_size: fileSize || Math.round(audioData.base64Data.length * 0.75),
      });
      soundEffects.playMessageSent();
    };

    fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data: audioData.base64Data,
        fileName: `voice_${Date.now()}.${ext}`,
        mimeType: mime,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        dispatchVoiceNote(res.url || audioData.base64Data, res.fileSize);
      })
      .catch(() => {
        // Direct fallback for Vercel / serverless deployments
        dispatchVoiceNote(audioData.base64Data);
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const isImg = file.type.startsWith('image/');

      const dispatchAttachment = (mediaUrl: string, fileSize?: number) => {
        realtimeSocket.sendMessage({
          roomId,
          sender_type: 'user',
          sender_name: session?.name || 'Visitor',
          sender_email: session?.email || 'visitor@guest.com',
          sender_avatar: session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`,
          message_type: isImg ? 'image' : 'file',
          media_url: mediaUrl,
          file_name: file.name,
          file_size: fileSize || file.size,
        });
        soundEffects.playMessageSent();
      };

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
          dispatchAttachment(res.url || base64Data, res.fileSize);
        })
        .catch(() => {
          // Direct fallback for Vercel / serverless deployments
          dispatchAttachment(base64Data, file.size);
        });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Audio & Video Call access trigger
  const handleCallClick = (type: 'audio' | 'video') => {
    requireAuth(() => {
      notificationService.requestPermission();
      onStartCall(type, roomId, 'Sakib Hasan');
    });
  };

  const handleSaveAvatar = (newAvatarUrl: string) => {
    const updated: UserSession = session
      ? { ...session, avatar: newAvatarUrl }
      : {
          id: 'user_' + Math.random().toString(36).substring(2, 9),
          name: 'Visitor',
          email: 'visitor@gmail.com',
          avatar: newAvatarUrl,
          isGoogleAuthenticated: false,
          role: 'user',
        };
    setSession(updated);
    localStorage.setItem('nexus_user_session', JSON.stringify(updated));

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

  // -------------------------------------------------------------
  // STEP 1: INITIAL VISITOR PROFILE SCREEN (Sakib Hasan)
  // Zero permission prompts on visit, clean professional landing
  // -------------------------------------------------------------
  if (!hasStartedChat) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto selection:bg-zinc-800">
        {/* Minimal Top Brand Bar */}
        <header className="flex items-center justify-between max-w-xl w-full mx-auto pt-2 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-zinc-400 tracking-wider uppercase">
              Direct Verified Channel
            </span>
          </div>
          <button
            onClick={onGoToOperator}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all text-xs"
            title="Admin Access"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </header>

        {/* Center Hero Card: Sakib Hasan */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto my-6 text-center">
          {/* Avatar with glowing ring */}
          <div className="relative mb-6">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1 bg-gradient-to-b from-white/20 to-white/5 border border-white/15 shadow-2xl overflow-hidden group">
              <img
                src={adminAvatar}
                alt="Sakib Hasan"
                className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* Live Indicator Badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-black/95 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1.5 shadow-lg whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online & Available</span>
            </div>
          </div>

          {/* Name & Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5">
            Sakib Hasan
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium mb-6 max-w-xs">
            Direct Realtime Messaging, Voice Notes & Ultra-HD Calling
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-2.5 w-full mb-6 text-left">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">💬</span>
                <span className="text-xs font-semibold text-white">Instant Chat</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Send messages right away with zero upfront sign-up.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">⚡</span>
                <span className="text-xs font-semibold text-white">1080p Calling</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                High-definition WebRTC voice & video streaming.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🎙️</span>
                <span className="text-xs font-semibold text-white">HD Voice</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Studio-quality voice notes across iOS & Android.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">✨</span>
                <span className="text-xs font-semibold text-white">OGGy Studio</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Creative Gemini AI photo transformation module.
              </p>
            </div>
          </div>

          {/* Big Start Chat Button */}
          <button
            onClick={() => setHasStartedChat(true)}
            className="w-full py-4 px-6 rounded-2xl bg-white text-black font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 hover:bg-zinc-200 active:scale-95 transition-all shadow-xl shadow-white/10"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            <span>Start Chat</span>
          </button>

          {/* Social Icons (Facebook & WhatsApp) */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white transition-all group"
              title="Facebook Profile"
            >
              <svg className="w-4 h-4 fill-[#1877F2] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white transition-all group"
              title="WhatsApp Direct"
            >
              <svg className="w-4 h-4 fill-[#25D366] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M12.031 0C5.397 0 .016 5.382.016 12.016c0 2.12.553 4.192 1.606 6.012L.004 24l6.167-1.616c1.758.958 3.738 1.464 5.86 1.464 6.634 0 12.016-5.382 12.016-12.016S18.665 0 12.031 0zm0 21.996c-1.802 0-3.568-.484-5.109-1.398l-.367-.218-3.795.995 1.013-3.698-.239-.38a9.96 9.96 0 0 1-1.534-5.28c0-5.512 4.484-9.996 9.996-9.996 5.513 0 9.996 4.484 9.996 9.996 0 5.513-4.483 9.996-9.996 9.996zm5.474-7.491c-.3-.15-1.774-.875-2.049-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.266-.467-2.411-1.488-.891-.795-1.493-1.777-1.668-2.077-.175-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525s-.675-1.625-.925-2.225c-.244-.583-.492-.504-.675-.513l-.575-.01c-.2 0-.525.075-.8.375s-1.05 1.025-1.05 2.5 1.075 2.9 1.225 3.1c.15.2 2.116 3.231 5.127 4.532.716.31 1.275.495 1.71.633.72.229 1.375.197 1.893.12.577-.086 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
              </svg>
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Footer / App Install Bar */}
        <div className="w-full max-w-xl mx-auto pb-2">
          <AppInstallBar />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 2: CHAT PORTAL SCREEN (After clicking 'Start Chat')
  // Visitors can type & send immediately, call/voice/files ask for access
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden secure-screen-content">
      {/* Top Header: Left: Back to Profile + Sakib Hasan Photo + Visitor Photo | Right: Audio & Video Call Icons */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-black border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Back button to return to profile landing */}
          <button
            onClick={() => setHasStartedChat(false)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all shrink-0"
            title="Back to Sakib Hasan Profile"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Side-by-side Photos */}
          <div className="flex items-center -space-x-2 shrink-0">
            {/* Sakib Hasan's Photo */}
            <div
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-900 shrink-0"
              title="Sakib Hasan (Online)"
            >
              <img
                src={adminAvatar}
                alt="Sakib Hasan"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
            </div>

            {/* Connected Visitor's Photo */}
            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-800 hover:ring-white/50 transition-all shrink-0 group"
              title={session?.name ? `${session.name} (Click to set photo)` : 'Customize your photo'}
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
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              Sakib Hasan
            </span>
            <span className="text-[10px] text-emerald-400 font-mono -mt-0.5 hidden sm:inline">
              Online
            </span>
          </div>
        </div>

        {/* Right side: Audio Call & Video Call Icons (asks for access when clicked) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio Call Icon */}
          <button
            onClick={() => handleCallClick('audio')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/15"
            title="Audio Call (Access Required)"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call Icon */}
          <button
            onClick={() => handleCallClick('video')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md"
            title="Video Call (Access Required)"
          >
            <Video className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onGoToOperator}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all text-xs font-mono ml-0.5"
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

                  {/* Document / Generic File */}
                  {msg.message_type === 'file' && (
                    <div
                      onClick={() =>
                        setSelectedFile({
                          url: msg.media_url || '',
                          name: msg.file_name || 'Attachment',
                          isImage: false,
                          size: msg.file_size,
                        })
                      }
                      className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-zinc-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{msg.file_name || 'Attachment'}</p>
                        {msg.file_size && (
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {(msg.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Timestamp & Checkmarks */}
                  <div
                    className={`flex items-center gap-1 mt-1 text-[10px] ${
                      isSelf ? 'text-zinc-400 justify-end' : 'text-zinc-500 justify-start'
                    } font-mono`}
                  >
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isSelf && <CheckCheck className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator: Operator is typing... */}
          {(isInitialTyping || isRemoteTyping) && (
            <div className="flex items-center gap-2 p-2.5 px-4 rounded-xl bg-white/5 border border-white/10 w-fit animate-in fade-in">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
              </div>
              <span className="text-xs text-zinc-400 font-medium">Sakib Hasan is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar: Paperclip (Access Req) | Voice Note (Access Req) | OGGy AI | Message Input | Send */}
        <div className="shrink-0 mb-1">
          {isRecordingAudio ? (
            <AudioRecorder
              onSendAudio={handleSendAudio}
              onCancel={() => setIsRecordingAudio(false)}
            />
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
              {/* File / Image Share (Prompts access when clicked) */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => requireAuth(() => fileInputRef.current?.click())}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors shrink-0"
                title="Share photo or file (Access Required)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Voice Note Mic (Prompts access when clicked) */}
              <button
                type="button"
                onClick={() => requireAuth(() => setIsRecordingAudio(true))}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors shrink-0"
                title="Voice Note (Access Required)"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* OGGy AI Photo Editor */}
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="p-2.5 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-500/30 transition-all shrink-0"
                title="OGGy AI Photo Studio"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              {/* Message Input Box: Instant Typing */}
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type a message to Sakib Hasan..."
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
        <div className="flex items-center justify-between px-6 py-2 shrink-0">
          {/* Left: Facebook Logo linking to profile */}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group"
            title="Sakib Hasan Facebook Profile"
          >
            <svg className="w-4 h-4 fill-[#1877F2] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>

          {/* Middle: Google Logo (Click to Login / Check session) */}
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group p-2"
            title={session?.isGoogleAuthenticated ? `Signed in as ${session.name}` : 'Sign in with Google'}
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
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all group"
            title="Chat on WhatsApp"
          >
            <svg className="w-4 h-4 fill-[#25D366] group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M12.031 0C5.397 0 .016 5.382.016 12.016c0 2.12.553 4.192 1.606 6.012L.004 24l6.167-1.616c1.758.958 3.738 1.464 5.86 1.464 6.634 0 12.016-5.382 12.016-12.016S18.665 0 12.031 0zm0 21.996c-1.802 0-3.568-.484-5.109-1.398l-.367-.218-3.795.995 1.013-3.698-.239-.38a9.96 9.96 0 0 1-1.534-5.28c0-5.512 4.484-9.996 9.996-9.996 5.513 0 9.996 4.484 9.996 9.996 0 5.513-4.483 9.996-9.996 9.996zm5.474-7.491c-.3-.15-1.774-.875-2.049-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-.3-.15-1.266-.467-2.411-1.488-.891-.795-1.493-1.777-1.668-2.077-.175-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525s-.675-1.625-.925-2.225c-.244-.583-.492-.504-.675-.513l-.575-.01c-.2 0-.525.075-.8.375s-1.05 1.025-1.05 2.5 1.075 2.9 1.225 3.1c.15.2 2.116 3.231 5.127 4.532.716.31 1.275.495 1.71.633.72.229 1.375.197 1.893.12.577-.086 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
            </svg>
          </a>
        </div>
      </main>

      {/* Self-Hosted Android & Apple Webview Add to Home Screen Bar */}
      <AppInstallBar />

      {/* Profile Photo Customization Modal */}
      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={session?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`}
        userName={session?.name || 'Visitor'}
        onSaveAvatar={handleSaveAvatar}
      />

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
