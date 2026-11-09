import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Maximize2,
  Minimize2,
  Volume2
} from 'lucide-react';
import { CallState } from '../types';
import { webrtcService } from '../services/webrtc';

interface CallModalProps {
  callState: CallState;
  onAccept: () => void;
  onReject: () => void;
  onEndCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callState,
  onAccept,
  onReject,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (callState.isActive) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState.isActive]);

  // Hook up video elements when active
  useEffect(() => {
    if (callState.isActive) {
      if (localVideoRef.current && webrtcService.localStream) {
        localVideoRef.current.srcObject = webrtcService.localStream;
      }
      if (remoteVideoRef.current && webrtcService.remoteStream) {
        remoteVideoRef.current.srcObject = webrtcService.remoteStream;
      }
    }
  }, [callState.isActive, webrtcService.localStream, webrtcService.remoteStream]);

  const toggleMic = () => {
    const muted = webrtcService.toggleAudio();
    setIsMuted(muted);
  };

  const toggleCamera = () => {
    const disabled = webrtcService.toggleVideo();
    setIsVideoDisabled(disabled);
  };

  const toggleScreen = async () => {
    const sharing = await webrtcService.toggleScreenShare();
    setIsScreenSharing(sharing);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Incoming Call Prompt
  if (callState.isRinging && callState.isIncoming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-sm glossy-card rounded-3xl p-8 text-center text-white border border-white/10 shadow-2xl flex flex-col items-center">
          {/* Pulsing Avatar */}
          <div className="relative mb-6">
            <div className="absolute -inset-3 rounded-full bg-white/20 animate-ping opacity-75" />
            <img
              src={callState.remoteAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Sakib'}
              alt={callState.remoteName}
              className="relative w-24 h-24 rounded-full border border-white/30 shadow-xl bg-zinc-900 object-cover"
            />
          </div>

          <h3 className="text-lg font-bold text-white mb-1">{callState.remoteName}</h3>
          <p className="text-xs text-zinc-400 font-mono mb-8">
            {callState.callType === 'video' ? 'Incoming Video Call...' : 'Incoming Audio Call...'}
          </p>

          <div className="flex items-center justify-center gap-8 w-full">
            {/* Decline */}
            <button
              onClick={onReject}
              className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            {/* Accept */}
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 animate-bounce"
              title="Accept"
            >
              <Phone className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Outgoing Call Ringing Prompt
  if (callState.isRinging && !callState.isIncoming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-sm glossy-card rounded-3xl p-8 text-center text-white border border-white/10 shadow-2xl flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute -inset-2 rounded-full bg-white/10 animate-pulse" />
            <img
              src={callState.remoteAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Peer'}
              alt={callState.remoteName}
              className="relative w-24 h-24 rounded-full border border-white/30 shadow-xl bg-zinc-900 object-cover"
            />
          </div>

          <h3 className="text-lg font-bold text-white mb-1">{callState.remoteName}</h3>
          <p className="text-xs text-zinc-400 font-mono mb-8">Ringing...</p>

          <button
            onClick={onEndCall}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Active Call Screen
  if (callState.isActive) {
    return (
      <div
        className={`fixed z-50 transition-all duration-300 flex flex-col ${
          isFullscreen
            ? 'inset-0 bg-black'
            : 'inset-4 sm:inset-10 max-w-5xl mx-auto rounded-3xl overflow-hidden glossy-card shadow-2xl border border-white/10'
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-md border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
            <img
              src={callState.remoteAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Sakib'}
              alt={callState.remoteName}
              className="w-9 h-9 rounded-full border border-white/20 object-cover"
            />
            <div>
              <div className="text-xs font-semibold text-white">{callState.remoteName}</div>
              <div className="text-[11px] text-zinc-400 font-mono">{formatDuration(duration)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Call Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {callState.callType === 'video' ? (
            <>
              {/* Remote Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local PIP Video */}
              <div className="absolute bottom-6 right-6 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-zinc-950">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : ''}`}
                />
                {isVideoDisabled && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-500">
                    <VideoOff className="w-5 h-5 mb-1" />
                    <span className="text-[10px]">Camera Off</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Audio Call View
            <div className="flex flex-col items-center text-center p-8">
              <div className="relative mb-6">
                <div
                  style={{ transform: `scale(${1 + audioLevel * 0.005})` }}
                  className="absolute -inset-4 rounded-full bg-white/5 transition-transform duration-75"
                />
                <img
                  src={callState.remoteAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Sakib'}
                  alt={callState.remoteName}
                  className="relative w-28 h-28 rounded-full border-2 border-white/20 shadow-2xl bg-zinc-900 object-cover"
                />
              </div>
              <h4 className="text-base font-bold text-white mb-1">{callState.remoteName}</h4>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
                <Volume2 className="w-3.5 h-3.5" />
                <span>HD Audio Call Connected</span>
              </p>

              {/* Waveform bars */}
              <div className="flex items-center gap-1.5 mt-6 h-8">
                {[40, 65, 85, 30, 95, 70, 50, 80, 45, 90, 60, 75, 40, 85, 55].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.max(12, (h * (audioLevel || 30)) / 100)}%` }}
                    className="w-1 rounded-full bg-white/70 transition-all duration-75"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-black/80 backdrop-blur-md border-t border-white/10">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-2xl transition-all ${
              isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {callState.callType === 'video' && (
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-2xl transition-all ${
                isVideoDisabled ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={toggleScreen}
            className={`p-3 rounded-2xl transition-all ${
              isScreenSharing ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Screen Share"
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            onClick={onEndCall}
            className="p-3 px-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
