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
  Sliders,
  Camera
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
  const [activeTab, setActiveTab] = useState<'chat' | 'email' | 'sqlite' | 'php' | 'settings'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ url: string; name: string; isImage: boolean; size?: number } | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditingAdminAvatar, setIsEditingAdminAvatar] = useState(false);

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
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

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

  const handleSaveVisitorAvatar = (newAvatarUrl: string) => {
    if (!activeRoomId) return;

    fetch(`/api/rooms/${activeRoomId}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: newAvatarUrl }),
    });

    realtimeSocket.sendSignal({
      type: 'update_avatar',
      roomId: activeRoomId,
      avatarUrl: newAvatarUrl,
    });

    setRooms((prev) =>
      prev.map((r) => (r.id === activeRoomId ? { ...r, user_avatar: newAvatarUrl } : r))
    );
  };

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
        if (data.settings.admin_email) setAdminEmail(data.settings.admin_email);
        if (data.settings.admin_avatar) setAdminAvatar(data.settings.admin_avatar);
        if (data.settings.facebook_url) setFacebookUrl(data.settings.facebook_url);
        if (data.settings.whatsapp_number) setWhatsappNumber(data.settings.whatsapp_number);
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
            roomId: activeRoomId,
            sender_type: 'admin',
            sender_name: 'Sakib Hasan',
            sender_email: adminEmail,
            message_type: 'audio',
            media_url: res.url,
            file_name: `Voice note (${audioData.duration}s)`,
            file_size: res.fileSize,
          });
          soundEffects.playMessageSent();
        }
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;

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
              roomId: activeRoomId,
              sender_type: 'admin',
              sender_name: 'Sakib Hasan',
              sender_email: adminEmail,
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            admin_email: adminEmail,
            admin_avatar: adminAvatar,
            facebook_url: facebookUrl,
            whatsapp_number: whatsappNumber,
            smtp_user: smtpUser,
            smtp_pass: smtpPass,
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_enabled: smtpUser && smtpPass ? 'true' : 'false',
          },
        }),
      });
      setSmtpSavedMsg(true);
      setTimeout(() => setSmtpSavedMsg(false), 3000);
      fetchPhpBundle();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      await fetch('/api/email/test', { method: 'POST' });
      await fetchEmailLogs();
      alert(`Test notification dispatched to ${adminEmail}! Check the logs below.`);
    } catch (e) {
      alert('Failed to send test email');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  const visitorFiles = messages.filter((m) => m.message_type === 'file' || m.message_type === 'image');
  const visitorAudios = messages.filter((m) => m.message_type === 'audio');
  const visitorCalls = messages.filter((m) => m.message_type === 'call_log');

  const filteredRooms = rooms.filter(
    (r) =>
      r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.user_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden">
      {/* Top Bar: Left: Sakib Hasan Avatar (click to change) + Visitor Avatar + Logo 'Sakib Hasan' | Right: Calls + Nav */}
      <header className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3 bg-black border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-3 shrink-0">
          {/* Side-by-side Photos: Sakib Hasan Photo + Connected Visitor Photo */}
          <div className="flex items-center -space-x-2 shrink-0">
            {/* Sakib Hasan's Photo: Clickable to change directly from control panel */}
            <button
              onClick={() => setIsEditingAdminAvatar(true)}
              className="relative w-9 h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-900 shrink-0 group transition-all hover:ring-white"
              title="Click to change your photo directly from control panel"
            >
              <img
                src={adminAvatar}
                alt="Sakib Hasan"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
            </button>

            {/* Connected Visitor's Photo */}
            {activeRoom ? (
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className="relative w-9 h-9 rounded-full ring-2 ring-black border border-white/30 overflow-hidden bg-zinc-800 shrink-0 group transition-all hover:ring-white"
                title={`${activeRoom.user_name} (Click to set visitor photo)`}
              >
                <img
                  src={activeRoom.user_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Visitor'}
                  alt={activeRoom.user_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </div>
              </button>
            ) : null}
          </div>

          <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
            Sakib Hasan
          </span>
        </div>

        {/* Center / Navigation */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-400">
          <button
            onClick={() => setActiveTab('chat')}
            className={`hover:text-white transition-colors whitespace-nowrap ${
              activeTab === 'chat' ? 'text-white border-b-2 border-white pb-0.5' : ''
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`hover:text-white transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'email' ? 'text-white border-b-2 border-white pb-0.5' : ''
            }`}
          >
            <span>Email Logs</span>
            {emailLogs.length > 0 && (
              <span className="text-[10px] bg-white/10 text-white px-1.5 py-0.2 rounded-full font-mono">
                {emailLogs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sqlite')}
            className={`hover:text-white transition-colors whitespace-nowrap ${
              activeTab === 'sqlite' ? 'text-white border-b-2 border-white pb-0.5' : ''
            }`}
          >
            SQLite Database
          </button>
          <button
            onClick={() => setActiveTab('php')}
            className={`hover:text-white transition-colors whitespace-nowrap ${
              activeTab === 'php' ? 'text-white border-b-2 border-white pb-0.5' : ''
            }`}
          >
            PHP & SQL Files
          </button>
        </nav>

        {/* Right side: Calling icons & Visitor View */}
        <div className="flex items-center gap-2 shrink-0">
          {activeRoom && (
            <>
              <button
                onClick={() => onStartCall('audio', activeRoom.id, activeRoom.user_name)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/15"
                title="Start Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                onClick={() => onStartCall('video', activeRoom.id, activeRoom.user_name)}
                className="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md"
                title="Start Video Call"
              >
                <Video className="w-4 h-4 fill-current" />
              </button>
            </>
          )}

          <button
            onClick={onGoToVisitorView}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap border border-white/10"
          >
            <span>Visitor View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden bg-black">
        {activeTab === 'chat' && (
          <>
            {/* Left Sidebar: Visitors List */}
            <aside className="w-80 sm:w-88 bg-black border-r border-white/10 flex flex-col shrink-0">
              <div className="p-3.5 border-b border-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search visitors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl glossy-input text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                {filteredRooms.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    No active visitors yet. Incoming messages will appear here instantly.
                  </div>
                ) : (
                  filteredRooms.map((room) => {
                    const isSelected = room.id === activeRoomId;
                    return (
                      <button
                        key={room.id}
                        onClick={() => selectRoom(room.id)}
                        className={`w-full p-3.5 flex items-start gap-3 text-left transition-all relative ${
                          isSelected ? 'bg-white/10 border-l-2 border-white' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={room.user_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Visitor'}
                            alt={room.user_name}
                            className="w-10 h-10 rounded-full border border-white/20 bg-zinc-800 object-cover"
                          />
                          {room.is_online === 1 ? (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-zinc-600 border border-black" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white truncate">
                              {room.user_name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate font-mono mt-0.5">
                            {room.user_email}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-zinc-500">
                              {room.is_online === 1 ? 'Online' : 'Offline'}
                            </span>
                            {room.unread_admin > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-white text-black text-[10px] font-bold">
                                {room.unread_admin}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-3 border-t border-white/10 bg-black text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Alerts to:</span>
                <span className="font-mono text-white truncate max-w-[150px]">{adminEmail}</span>
              </div>
            </aside>

            {/* Center Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-black">
              {activeRoom ? (
                <>
                  {/* Chat Header with Visitor Profile & Vault Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3.5 bg-black border-b border-white/10 shrink-0 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => setIsAvatarModalOpen(true)}
                        className="relative w-10 h-10 rounded-full border border-white/20 bg-zinc-800 overflow-hidden group shrink-0"
                        title="Click to set/change visitor photo"
                      >
                        <img
                          src={activeRoom.user_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Visitor'}
                          alt={activeRoom.user_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px]">
                          Edit
                        </div>
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs font-bold text-white truncate">{activeRoom.user_name}</h2>
                          {activeRoom.is_online === 1 ? (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                              Offline
                            </span>
                          )}
                        </div>

                        {/* Visitor Email and Vault Downloads Button */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-zinc-400 font-mono truncate">{activeRoom.user_email}</span>
                          <span className="text-zinc-600">·</span>
                          <button
                            onClick={() => setIsVaultOpen(!isVaultOpen)}
                            className="text-[11px] px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1 transition-colors"
                            title="Download all files and recordings for this visitor"
                          >
                            <Download className="w-3 h-3" />
                            <span>Vault ({visitorFiles.length + visitorAudios.length})</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Calling Toolbar (Pure Icon Buttons) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onStartCall('audio', activeRoom.id, activeRoom.user_name)}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/15"
                        title="Start Audio Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onStartCall('video', activeRoom.id, activeRoom.user_name)}
                        className="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md"
                        title="Start Video Call"
                      >
                        <Video className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>

                  {/* Visitor Vault Slide-down Drawer */}
                  {isVaultOpen && (
                    <div className="p-4 bg-zinc-950 border-b border-white/10 max-h-64 overflow-y-auto animate-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 text-white" />
                          <h4 className="text-xs font-bold text-white">
                            {activeRoom.user_name} ({activeRoom.user_email}) Shared Files & Vault
                          </h4>
                        </div>
                        <button
                          onClick={() => setIsVaultOpen(false)}
                          className="text-xs text-zinc-400 hover:text-white"
                        >
                          Close ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {visitorFiles.map((f) => (
                          <div key={f.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{f.file_name || 'File'}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">
                                {Math.round((f.file_size || 0) / 1024)} KB · {new Date(f.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <a
                              href={f.media_url}
                              download={f.file_name || 'download'}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}

                        {visitorAudios.map((a) => (
                          <div key={a.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">🎙️ {a.file_name || 'Voice Note'}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{new Date(a.created_at).toLocaleTimeString()}</p>
                            </div>
                            <a
                              href={a.media_url}
                              download={`voice_note_${a.id}.webm`}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                              title="Download Voice Note"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}

                        {visitorCalls.map((c) => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-300 truncate">📞 {c.text}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{new Date(c.created_at).toLocaleTimeString()}</p>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">Logged</span>
                          </div>
                        ))}

                        {visitorFiles.length === 0 && visitorAudios.length === 0 && visitorCalls.length === 0 && (
                          <p className="text-xs text-zinc-500 col-span-3 py-2 text-center">
                            No files or voice notes shared with this visitor yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {messages.map((msg) => {
                      const isSelf = msg.sender_type === 'admin';
                      const isSystem = msg.sender_type === 'system';

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-400 text-[11px] font-mono border border-white/10">
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
                          <span className="text-[11px] text-zinc-500 mb-1 px-1">
                            {msg.sender_name} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <div
                            className={`p-3.5 rounded-2xl max-w-md ${
                              isSelf ? 'glossy-bubble-operator' : 'glossy-bubble-user'
                            }`}
                          >
                            {msg.message_type === 'text' && (
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            )}

                            {msg.message_type === 'audio' && (
                              <VoiceMessagePlayer mediaUrl={msg.media_url || ''} isSelf={isSelf} />
                            )}

                            {msg.message_type === 'image' && (
                              <div className="space-y-2">
                                <img
                                  src={msg.media_url}
                                  alt={msg.file_name || 'Photo'}
                                  onClick={() =>
                                    setSelectedFile({
                                      url: msg.media_url || '',
                                      name: msg.file_name || 'photo',
                                      isImage: true,
                                      size: msg.file_size,
                                    })
                                  }
                                  className="max-w-xs rounded-xl cursor-pointer hover:opacity-95 transition-opacity border border-white/20"
                                />
                                {msg.file_name && (
                                  <p className="text-xs text-zinc-400 font-mono truncate">{msg.file_name}</p>
                                )}
                              </div>
                            )}

                            {msg.message_type === 'file' && (
                              <div
                                onClick={() =>
                                  setSelectedFile({
                                    url: msg.media_url || '',
                                    name: msg.file_name || 'document',
                                    isImage: false,
                                    size: msg.file_size,
                                  })
                                }
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-black/50 border border-white/10 cursor-pointer hover:bg-black/80 transition-colors"
                              >
                                <div className="p-2 rounded-lg bg-white/10 text-white">
                                  <Download className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white truncate max-w-[180px]">
                                    {msg.file_name}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    {Math.round((msg.file_size || 0) / 1024)} KB · Download
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Bar */}
                  <div className="p-4 bg-black border-t border-white/10">
                    {isRecordingAudio ? (
                      <AudioRecorder
                        onSendAudio={handleSendAudio}
                        onCancel={() => setIsRecordingAudio(false)}
                      />
                    ) : (
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          title="Attach file"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsRecordingAudio(true)}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          title="Record voice note"
                        >
                          <Mic className="w-4 h-4" />
                        </button>

                        <input
                          type="text"
                          value={inputText}
                          onChange={handleInputChange}
                          placeholder="Type reply..."
                          className="flex-1 px-4 py-2.5 rounded-xl glossy-input text-xs text-white placeholder-zinc-500 focus:outline-none"
                        />

                        <button
                          type="submit"
                          disabled={!inputText.trim()}
                          className="p-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all"
                        >
                          <span>Send</span>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 text-xs">
                  Select a visitor from the left sidebar to start chatting.
                </div>
              )}
            </main>
          </>
        )}

        {/* Tab 2: Email Logs */}
        {activeTab === 'email' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>Email Notification Hub ({adminEmail})</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Every visitor message is routed to your email address automatically.
                </p>
              </div>

              <button
                onClick={handleTestEmail}
                disabled={isTestingEmail}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 font-semibold text-xs flex items-center gap-2 shadow-md transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingEmail ? 'Sending...' : 'Send Test Alert'}</span>
              </button>
            </div>

            <div className="glossy-card rounded-2xl border border-white/10 p-5">
              <h4 className="text-xs font-bold text-white mb-3">Dispatched Email Audit Trail</h4>
              {emailLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4">No emails dispatched yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400">
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Sender</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {emailLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 text-white font-sans font-semibold">
                            {log.sender_name}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300 font-sans max-w-xs truncate">
                            {log.subject}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {log.status === 'sent' ? 'Delivered (SMTP)' : 'Dispatched & Logged'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="glossy-card rounded-2xl border border-white/10 p-6">
              <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span>SMTP & Email Delivery Settings</span>
              </h4>
              <p className="text-xs text-zinc-400 mb-4">
                Optional: Configure your Gmail App Password to send directly through Google SMTP.
              </p>

              <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="mesakibu4@gmail.com"
                    className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Facebook Profile URL</label>
                  <input
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/yourprofile"
                    className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Owner Photo (Avatar URL)</label>
                  <div className="flex items-center gap-3">
                    <img
                      src={adminAvatar}
                      alt="Sakib Hasan"
                      className="w-10 h-10 rounded-full border border-white/20 object-cover shrink-0"
                    />
                    <input
                      type="text"
                      value={adminAvatar}
                      onChange={(e) => setAdminAvatar(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 rounded-xl glossy-input text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingAdminAvatar(true)}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      Pick / Upload
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between pt-2">
                  {smtpSavedMsg && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Settings successfully saved!
                    </span>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs ml-auto shadow-md transition-all hover:bg-zinc-200"
                  >
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: SQLite */}
        {activeTab === 'sqlite' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
            <div className="pb-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>SQLite 3 Light SQL Hub</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  All messages, audio recordings, rooms, and call logs persist in SQLite.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/db/export-sqlite"
                  download="nexus_chat.sqlite"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sqlite</span>
                </a>
                <a
                  href="/api/db/export-sql"
                  download="nexus_chat_dump.sql"
                  className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql Dump</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glossy-card rounded-2xl p-5 border border-white/10">
                <div className="text-xs text-zinc-400 uppercase font-mono">Total Rooms</div>
                <div className="text-2xl font-bold text-white mt-1 font-mono">{rooms.length}</div>
                <div className="text-[11px] text-zinc-500 mt-1">Table: rooms</div>
              </div>
              <div className="glossy-card rounded-2xl p-5 border border-white/10">
                <div className="text-xs text-zinc-400 uppercase font-mono">Messages & Audio</div>
                <div className="text-2xl font-bold text-white mt-1 font-mono">{messages.length}</div>
                <div className="text-[11px] text-zinc-500 mt-1">Table: messages</div>
              </div>
              <div className="glossy-card rounded-2xl p-5 border border-white/10">
                <div className="text-xs text-zinc-400 uppercase font-mono">Email Logs</div>
                <div className="text-2xl font-bold text-white mt-1 font-mono">{emailLogs.length}</div>
                <div className="text-[11px] text-zinc-500 mt-1">Table: email_logs</div>
              </div>
            </div>

            <div className="glossy-card rounded-2xl p-5 border border-white/10">
              <h4 className="text-xs font-bold text-white mb-2">Schema Structure (SQLite 3)</h4>
              <pre className="p-4 rounded-xl bg-black text-xs text-zinc-300 font-mono overflow-x-auto border border-white/10">
{`CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  user_name TEXT,
  user_email TEXT,
  user_avatar TEXT,
  is_online INTEGER,
  created_at TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  sender_type TEXT,
  sender_name TEXT,
  message_type TEXT, /* 'text', 'audio', 'image', 'file' */
  text TEXT,
  media_url TEXT,
  created_at TEXT
);`}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: PHP & SQLite */}
        {activeTab === 'php' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
            <div className="pb-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCode2 className="w-4 h-4" />
                  <span>PHP & SQLite Standalone Bundle</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Ready-to-deploy native PHP backend script for Apache, Nginx, or cPanel hosting.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(phpBundle?.apiPhp || '', 'chat_api.php')}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode === 'chat_api.php' ? 'Copied!' : 'Copy chat_api.php'}</span>
              </button>
            </div>

            <div className="glossy-card rounded-2xl p-5 border border-white/10">
              <pre className="p-4 rounded-xl bg-black text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-96 border border-white/10">
                {phpBundle?.apiPhp || '// Loading PHP script...'}
              </pre>
            </div>
          </div>
        )}
      </div>

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

      {activeRoom && (
        <AvatarModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          currentAvatar={activeRoom.user_avatar}
          userName={activeRoom.user_name}
          onSaveAvatar={handleSaveVisitorAvatar}
        />
      )}

      {isEditingAdminAvatar && (
        <AvatarModal
          isOpen={isEditingAdminAvatar}
          onClose={() => setIsEditingAdminAvatar(false)}
          currentAvatar={adminAvatar}
          userName="Sakib Hasan (Owner)"
          onSaveAvatar={(url) => {
            handleSaveAdminAvatar(url);
            setIsEditingAdminAvatar(false);
          }}
        />
      )}
    </div>
  );
};
