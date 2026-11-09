import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Phone,
  Send,
  Paperclip,
  Mic,
  Mail,
  Database,
  FileCode2,
  CheckCircle2,
  Download,
  Copy,
  ExternalLink,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Camera,
  Users,
  Settings,
  ArrowLeft,
  RefreshCw,
  Globe,
  Sliders,
  Smartphone
} from 'lucide-react';
import { Room, Message, EmailLog } from '../types';
import { realtimeSocket } from '../services/websocket';
import { soundEffects } from '../services/sound';
import { notificationService } from '../services/notification';
import { AudioRecorder } from './AudioRecorder';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { FileViewerModal } from './FileViewerModal';
import { AvatarModal } from './AvatarModal';

interface OperatorJoinPortalProps {
  onStartCall: (callType: 'audio' | 'video', targetRoomId: string, remoteName: string) => void;
  activeRoomIdFromUrl?: string;
  onGoToVisitorView: () => void;
}

export const OperatorJoinPortal: React.FC<OperatorJoinPortalProps> = ({
  onStartCall,
  activeRoomIdFromUrl,
  onGoToVisitorView,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>(activeRoomIdFromUrl || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'rooms' | 'firewall' | 'email' | 'sqlite' | 'php' | 'settings'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ url: string; name: string; isImage: boolean; size?: number } | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditingAdminAvatar, setIsEditingAdminAvatar] = useState(false);

  // IP Firewall Security States
  const [ipStatus, setIpStatus] = useState<{
    clientIp: string;
    isAllowed: boolean;
    allowedIps: string[];
    primaryIp: string;
  } | null>(null);
  const [newIpInput, setNewIpInput] = useState('');
  const [isIpLoading, setIsIpLoading] = useState(true);
  const [ipActionMsg, setIpActionMsg] = useState<string | null>(null);

  // Profile & Social Settings
  const [adminAvatar, setAdminAvatar] = useState('https://api.dicebear.com/7.x/bottts/svg?seed=SakibHasanOfficial');
  const [facebookUrl, setFacebookUrl] = useState('https://facebook.com');
  const [whatsappNumber, setWhatsappNumber] = useState('+8801700000000');
  const [adminEmail, setAdminEmail] = useState('mesakibu4@gmail.com');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSavedMsg, setSmtpSavedMsg] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // PHP Bundle state
  const [phpBundle, setPhpBundle] = useState<{ apiPhp: string; schemaSql: string; readme: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Fetch IP Status on boot
  useEffect(() => {
    fetchIpStatus();
  }, []);

  const fetchIpStatus = async () => {
    setIsIpLoading(true);
    try {
      const res = await fetch('/api/admin/ip-status');
      const data = await res.json();
      setIpStatus(data);
    } catch (e) {
      console.warn('IP Status error:', e);
    } finally {
      setIsIpLoading(false);
    }
  };

  const handleAddAllowedIp = async (ipToAdd?: string) => {
    const targetIp = (ipToAdd || newIpInput).trim();
    if (!targetIp) return;

    try {
      const res = await fetch('/api/admin/allowed-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, action: 'add' }),
      });
      const data = await res.json();
      if (data.allowedIps) {
        setIpStatus((prev) => prev ? { ...prev, allowedIps: data.allowedIps, isAllowed: true } : null);
        setNewIpInput('');
        setIpActionMsg(`IP ${targetIp} successfully allowlisted!`);
        setTimeout(() => setIpActionMsg(null), 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveAllowedIp = async (ipToRemove: string) => {
    if (ipToRemove === '59.152.5.2') {
      alert('Primary IP 59.152.5.2 is permanently protected and cannot be deleted.');
      return;
    }

    try {
      const res = await fetch('/api/admin/allowed-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ipToRemove, action: 'remove' }),
      });
      const data = await res.json();
      if (data.allowedIps) {
        setIpStatus((prev) => prev ? { ...prev, allowedIps: data.allowedIps } : null);
        setIpActionMsg(`IP ${ipToRemove} removed from allowlist.`);
        setTimeout(() => setIpActionMsg(null), 3500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize operator WebSocket connection
  useEffect(() => {
    realtimeSocket.connect(
      'admin',
      activeRoomId,
      'Sakib Hasan (Admin)',
      adminEmail,
      'https://api.dicebear.com/7.x/bottts/svg?seed=SakibAdmin'
    );

    fetchRooms();
    fetchEmailLogs();
    fetchSettings();
    fetchPhpBundle();

    notificationService.requestPermission();

    const unsubMsg = realtimeSocket.onMessage((msg) => {
      if (msg.sender_type === 'user') {
        notificationService.show(
          msg.sender_name || 'Visitor',
          msg.text || (msg.message_type === 'audio' ? '🎙️ Voice note' : '📎 Attachment'),
          msg.sender_avatar || '/icon.svg'
        );
      } else {
        soundEffects.playMessageReceived();
      }

      if (msg.room_id === activeRoomId) {
        setMessages((prev) => [...prev, msg]);
      }
      fetchRooms();
      fetchEmailLogs();
    });

    const unsubRooms = realtimeSocket.onRoomStatus((updatedRooms) => {
      setRooms(updatedRooms);
    });

    const unsubHistory = realtimeSocket.onHistory((history) => {
      setMessages(history);
    });

    const unsubSignals = realtimeSocket.onSignal((signal) => {
      if (signal.type === 'email_dispatched') {
        fetchEmailLogs();
      }
      if (signal.type === 'avatar_updated') {
        fetchRooms();
      }
    });

    return () => {
      unsubMsg();
      unsubRooms();
      unsubHistory();
      unsubSignals();
    };
  }, [activeRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
        if (!activeRoomId && data.rooms.length > 0) {
          selectRoom(data.rooms[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const res = await fetch('/api/email/logs');
      const data = await res.json();
      if (data.logs) setEmailLogs(data.logs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        if (data.settings.admin_avatar) setAdminAvatar(data.settings.admin_avatar);
        if (data.settings.facebook_url) setFacebookUrl(data.settings.facebook_url);
        if (data.settings.whatsapp_number) setWhatsappNumber(data.settings.whatsapp_number);
        if (data.settings.admin_email) setAdminEmail(data.settings.admin_email);
        if (data.settings.smtp_user) setSmtpUser(data.settings.smtp_user);
        if (data.settings.smtp_pass) setSmtpPass(data.settings.smtp_pass);
        if (data.settings.smtp_host) setSmtpHost(data.settings.smtp_host);
        if (data.settings.smtp_port) setSmtpPort(data.settings.smtp_port);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAdminAvatar = async (newAvatarUrl: string) => {
    setAdminAvatar(newAvatarUrl);
    try {
      await fetch('/api/admin/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: newAvatarUrl }),
      });
      realtimeSocket.sendSignal({
        type: 'admin_avatar_updated',
        avatarUrl: newAvatarUrl,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPhpBundle = async () => {
    try {
      const res = await fetch('/api/php-bundle');
      const data = await res.json();
      setPhpBundle(data);
    } catch (e) {
      console.error(e);
    }
  };

  const selectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    realtimeSocket.switchRoom(roomId);
    fetch(`/api/rooms/${roomId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) setMessages(d.messages);
      });
    setActiveTab('chat');
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
    if (!inputText.trim() || !activeRoomId) return;

    realtimeSocket.sendTyping(false);
    realtimeSocket.sendMessage({
      roomId: activeRoomId,
      sender_type: 'admin',
      sender_name: 'Sakib Hasan',
      sender_email: adminEmail,
      message_type: 'text',
      text: inputText.trim(),
    });

    soundEffects.playMessageSent();
    setInputText('');
  };

  const handleSendAudio = (audioData: { base64Data: string; duration: number }) => {
    if (!activeRoomId) return;
    setIsRecordingAudio(false);

    const isMp4 = audioData.base64Data.includes('audio/mp4') || audioData.base64Data.includes('audio/aac');
    const ext = isMp4 ? 'mp4' : 'webm';
    const mime = isMp4 ? 'audio/mp4' : 'audio/webm';

    const dispatchVoiceNote = (mediaUrl: string, fileSize?: number) => {
      realtimeSocket.sendMessage({
        roomId: activeRoomId,
        sender_type: 'admin',
        sender_name: 'Sakib Hasan',
        sender_email: adminEmail,
        message_type: 'audio',
        media_url: mediaUrl,
        file_name: `Voice note (${audioData.duration}s)`,
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
    if (!file || !activeRoomId) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const isImg = file.type.startsWith('image/');

      const dispatchAttachment = (mediaUrl: string, fileSize?: number) => {
        realtimeSocket.sendMessage({
          roomId: activeRoomId,
          sender_type: 'admin',
          sender_name: 'Sakib Hasan',
          sender_email: adminEmail,
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

  const handleStartCallClick = (type: 'audio' | 'video') => {
    if (!activeRoomId) return;
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    const remoteName = currentRoom?.user_name || 'Visitor';
    onStartCall(type, activeRoomId, remoteName);
  };

  const handleSaveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            facebook_url: facebookUrl,
            whatsapp_number: whatsappNumber,
            admin_email: adminEmail,
            smtp_user: smtpUser,
            smtp_pass: smtpPass,
            smtp_host: smtpHost,
            smtp_port: smtpPort,
          },
        }),
      });
      setSmtpSavedMsg(true);
      setTimeout(() => setSmtpSavedMsg(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const res = await fetch('/api/email/test', { method: 'POST' });
      await res.json();
      fetchEmailLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];
  const filteredRooms = rooms.filter(
    (r) =>
      r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // -------------------------------------------------------------
  // IP Firewall Block Screen: If user IP is unauthorized
  // -------------------------------------------------------------
  if (!isIpLoading && ipStatus && !ipStatus.isAllowed) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md glossy-card rounded-3xl p-6 sm:p-8 text-center border border-red-500/30 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 mx-auto flex items-center justify-center text-red-400 mb-4 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Access Restricted (403)</h2>
          <p className="text-xs text-zinc-400 mb-6">
            Admin operator portal is protected by IP Firewall. Unauthorized IP addresses cannot access this portal.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2 mb-6 font-mono text-xs">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Required Authorized IP:</span>
              <span className="text-emerald-400 font-bold">59.152.5.2</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400">
              <span>Your Detected IP:</span>
              <span className="text-red-400 font-bold">{ipStatus.clientIp || 'Unknown'}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400">
              <span>Firewall Status:</span>
              <span className="text-red-400">Blocked</span>
            </div>
          </div>

          {/* Quick Override / Allow Button for authorized admin testing */}
          <div className="space-y-3">
            <button
              onClick={() => handleAddAllowedIp(ipStatus.clientIp)}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Allow My Current IP ({ipStatus.clientIp})</span>
            </button>

            <button
              onClick={onGoToVisitorView}
              className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Chat Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Main Operator Dashboard (Unified Mobile Single-Page + Desktop)
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden select-none">
      {/* Universal Top Header */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-black border-b border-white/10 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-8 h-8 rounded-full ring-2 ring-white/20 overflow-hidden bg-zinc-900 shrink-0">
            <img src={adminAvatar} alt="Sakib Hasan" className="w-full h-full object-cover" />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white truncate">Sakib Hasan Admin</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                Live
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate hidden sm:block">
              IP Firewall: <span className="text-emerald-400">59.152.5.2</span>
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* IP Security Badge */}
          <button
            onClick={() => setActiveTab('firewall')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
              activeTab === 'firewall'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
            }`}
            title="Firewall & Allowed IPs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">59.152.5.2</span>
          </button>

          {/* Switch to Visitor Portal */}
          <button
            onClick={onGoToVisitorView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs transition-all"
            title="Switch to Visitor Chat View"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Visitor View</span>
          </button>
        </div>
      </header>

      {/* Mobile Horizontal Quick-Room Swiper: Switch visitors in 1 tap without page reload */}
      <div className="sm:hidden flex items-center gap-2 px-3 py-2 bg-zinc-950/90 border-b border-white/10 overflow-x-auto shrink-0 scrollbar-none">
        <span className="text-[10px] uppercase font-mono text-zinc-500 shrink-0">Visitors:</span>
        {rooms.map((room) => {
          const isSelected = room.id === activeRoomId;
          return (
            <button
              key={room.id}
              onClick={() => selectRoom(room.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs shrink-0 transition-all border ${
                isSelected
                  ? 'bg-white text-black font-semibold border-white shadow-md'
                  : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${room.is_online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              <span className="truncate max-w-[100px]">{room.user_name}</span>
              {room.unread_admin > 0 && (
                <span className="px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {room.unread_admin}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Body Viewport */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sidebar (hidden on mobile) */}
        <aside className="hidden md:flex flex-col w-80 bg-zinc-950 border-r border-white/10 shrink-0">
          {/* Search box */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search visitors..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredRooms.map((room) => {
              const isSelected = room.id === activeRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => selectRoom(room.id)}
                  className={`w-full p-3 flex items-center justify-between text-left transition-colors ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-zinc-900 border border-white/20 shrink-0">
                      <img src={room.user_avatar} alt={room.user_name} className="w-full h-full object-cover" />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-black ${
                          room.is_online ? 'bg-emerald-400' : 'bg-zinc-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{room.user_name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate">{room.user_email}</div>
                    </div>
                  </div>
                  {room.unread_admin > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {room.unread_admin}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Primary Content Container: Switches between Chat, Visitors List, IP Firewall, and Settings */}
        <main className="flex-1 flex flex-col bg-black overflow-hidden min-h-0">
          {/* TAB 1: LIVE CHAT */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col h-full min-h-0">
              {/* Chat Header */}
              {activeRoom ? (
                <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={activeRoom.user_avatar}
                      alt={activeRoom.user_name}
                      className="w-8 h-8 rounded-full border border-white/20 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{activeRoom.user_name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeRoom.is_online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span>{activeRoom.is_online ? 'Online' : 'Offline'}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="truncate">{activeRoom.user_email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio & Video Call Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleStartCallClick('audio')}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/15"
                      title="Audio Call Visitor"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartCallClick('video')}
                      className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md"
                      title="Video Call Visitor"
                    >
                      <Video className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-xs text-zinc-400 bg-zinc-950 border-b border-white/10">No active room selected</div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 min-h-0">
                {messages.map((msg) => {
                  const isSelf = msg.sender_type === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} animate-in fade-in duration-100`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs ${
                          isSelf ? 'glossy-bubble-operator' : 'glossy-bubble-user'
                        }`}
                      >
                        {msg.message_type === 'audio' && msg.media_url ? (
                          <VoiceMessagePlayer mediaUrl={msg.media_url} isSelf={isSelf} />
                        ) : msg.message_type === 'image' && msg.media_url ? (
                          <img
                            src={msg.media_url}
                            alt="attachment"
                            onClick={() => setSelectedFile({ url: msg.media_url!, name: msg.file_name || 'image', isImage: true })}
                            className="rounded-xl max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ) : msg.message_type === 'file' && msg.media_url ? (
                          <a
                            href={msg.media_url}
                            download={msg.file_name || 'file'}
                            className="flex items-center gap-2 underline text-sky-400 hover:text-sky-300 font-mono"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{msg.file_name || 'Download file'}</span>
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed text-white">{msg.text}</p>
                        )}
                        <div className="text-[9px] text-zinc-400 font-mono text-right mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Dock */}
              <div className="p-2 sm:p-3 bg-zinc-950 border-t border-white/10 shrink-0">
                {isRecordingAudio ? (
                  <AudioRecorder
                    onSendAudio={handleSendAudio}
                    onCancel={() => setIsRecordingAudio(false)}
                  />
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors"
                      title="Attach file or photo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRecordingAudio(true)}
                      className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors"
                      title="Record Voice Note"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Reply as Sakib Hasan..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none min-w-0"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() || !activeRoomId}
                      className="p-2 sm:p-2.5 px-3.5 sm:px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-30 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VISITORS LIST (Mobile Dedicated View) */}
          {activeTab === 'rooms' && (
            <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">All Visitors ({rooms.length})</h3>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {rooms.filter((r) => r.is_online).length} Online
                </span>
              </div>

              <div className="space-y-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => selectRoom(room.id)}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border border-white/20 shrink-0">
                        <img src={room.user_avatar} alt={room.user_name} className="w-full h-full object-cover" />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-black ${
                            room.is_online ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{room.user_name}</div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate">{room.user_email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {room.unread_admin > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {room.unread_admin} new
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectRoom(room.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs"
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: IP SECURITY FIREWALL (Single Page Management) */}
          {activeTab === 'firewall' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-0 space-y-4 max-w-3xl mx-auto w-full">
              <div className="p-4 sm:p-5 rounded-2xl glossy-card border border-white/10 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">IP Security Firewall</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                    Protected
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Only whitelisted IP addresses can access the Admin Dashboard. No one outside these allowed IPs can access this portal.
                </p>

                {ipActionMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{ipActionMsg}</span>
                  </div>
                )}

                {/* Status Box */}
                <div className="bg-black/60 rounded-xl p-3.5 border border-white/10 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Primary Authorized IP:</span>
                    <span className="text-emerald-400 font-bold">59.152.5.2</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Your Current Detected IP:</span>
                    <span className="text-sky-400 font-bold">{ipStatus?.clientIp || 'Detecting...'}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Firewall Status:</span>
                    <span className="text-emerald-400 font-bold">ACTIVE & ENFORCED</span>
                  </div>
                </div>

                {/* 1-Click Allow Current IP */}
                {ipStatus?.clientIp && !ipStatus.allowedIps.includes(ipStatus.clientIp) && (
                  <button
                    onClick={() => handleAddAllowedIp(ipStatus.clientIp)}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Allow Current IP ({ipStatus.clientIp})</span>
                  </button>
                )}

                {/* Add New Custom IP */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-zinc-300">Add New Allowed IP Address:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIpInput}
                      onChange={(e) => setNewIpInput(e.target.value)}
                      placeholder="e.g. 59.152.5.2 or 103.145.2.1"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none"
                    />
                    <button
                      onClick={() => handleAddAllowedIp()}
                      disabled={!newIpInput.trim()}
                      className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all disabled:opacity-30 shrink-0"
                    >
                      Add IP
                    </button>
                  </div>
                </div>

                {/* Allowed IPs List */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-zinc-300">Currently Allowed IP Addresses:</label>
                  <div className="space-y-1.5">
                    {ipStatus?.allowedIps.map((ip) => {
                      const isPrimary = ip === '59.152.5.2';
                      return (
                        <div
                          key={ip}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-white font-semibold">{ip}</span>
                            {isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Primary Master IP
                              </span>
                            )}
                          </div>
                          {!isPrimary && (
                            <button
                              onClick={() => handleRemoveAllowedIp(ip)}
                              className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                              title="Remove IP"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS, EMAIL & STANDALONE APP */}
          {activeTab === 'settings' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-0 space-y-4 max-w-3xl mx-auto w-full">
              {/* Profile Card */}
              <div className="p-4 sm:p-5 rounded-2xl glossy-card border border-white/10 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-sm font-bold text-white">Admin Profile & Socials</h3>
                  <button
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Change Avatar</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Admin Email (Alerts Route Here):</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Facebook Profile Link:</label>
                    <input
                      type="text"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">WhatsApp Number:</label>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                    />
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all shadow-md"
                  >
                    Save Profile & Settings
                  </button>
                </div>
              </div>

              {/* Email Alerts & SMTP */}
              <div className="p-4 sm:p-5 rounded-2xl glossy-card border border-white/10 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="text-sm font-bold text-white">Email Notification Pipeline</h3>
                  <button
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingEmail ? 'animate-spin' : ''}`} />
                    <span>{isTestingEmail ? 'Testing...' : 'Send Test Mail'}</span>
                  </button>
                </div>
                <p className="text-xs text-zinc-400">
                  Every text message from a visitor is routed instantly to <strong>{adminEmail}</strong>.
                </p>
              </div>

              {/* Standalone Database / SQL Export */}
              <div className="p-4 sm:p-5 rounded-2xl glossy-card border border-white/10 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white pb-2 border-b border-white/10">SQLite Database Export</h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/db/export-sqlite"
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SQLite (.sqlite)</span>
                  </a>
                  <a
                    href="/api/db/export-sql"
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Download SQL Dump (.sql)</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Universal Mobile Bottom Dock (Single-Page App Navigation) */}
      <nav className="sm:hidden flex items-center justify-around py-2 px-3 bg-zinc-950 border-t border-white/10 shrink-0 z-30">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
            activeTab === 'chat' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Send className="w-4 h-4" />
          <span className="text-[10px] font-medium">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`relative flex flex-col items-center gap-1 p-1.5 transition-colors ${
            activeTab === 'rooms' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px] font-medium">Visitors</span>
          {rooms.some((r) => r.unread_admin > 0) && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('firewall')}
          className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
            activeTab === 'firewall' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-medium">Firewall IP</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
            activeTab === 'settings' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </nav>

      {/* Admin Avatar Customization Modal */}
      {isAvatarModalOpen && (
        <AvatarModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          currentAvatar={adminAvatar}
          userName="Sakib Hasan"
          onSaveAvatar={handleSaveAdminAvatar}
        />
      )}

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
