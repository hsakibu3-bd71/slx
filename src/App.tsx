import React, { useState, useEffect } from 'react';
import { CallState } from './types';
import { realtimeSocket } from './services/websocket';
import { soundEffects } from './services/sound';
import { webrtcService } from './services/webrtc';
import { CallModal } from './components/CallModal';
import { OperatorJoinPortal } from './components/OperatorJoinPortal';
import { VisitorChatPortal } from './components/VisitorChatPortal';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname;
  });

  // Call management state
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isRinging: false,
    isIncoming: false,
    callType: 'video',
    roomId: '',
    remoteName: 'Peer',
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
  });

  // Listen to popstate (browser back/forward)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Setup WebRTC Signal Handlers
  useEffect(() => {
    const unsubSignals = realtimeSocket.onSignal(async (signal) => {
      switch (signal.type) {
        case 'incoming_call': {
          soundEffects.startRinging(true);
          setCallState({
            isActive: false,
            isRinging: true,
            isIncoming: true,
            callType: signal.callType || 'video',
            roomId: signal.roomId,
            remoteName: signal.fromName || 'Caller',
            remoteAvatar: signal.fromAvatar,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
          });
          break;
        }

        case 'call_response': {
          if (signal.accepted) {
            soundEffects.stopRinging();
            // Start WebRTC Peer connection offer
            await webrtcService.startLocalMedia(signal.callType === 'video');
            await webrtcService.makeOffer();

            setCallState((prev) => ({
              ...prev,
              isActive: true,
              isRinging: false,
              startTime: Date.now(),
            }));
          } else {
            soundEffects.stopRinging();
            webrtcService.endCall();
            setCallState((prev) => ({
              ...prev,
              isActive: false,
              isRinging: false,
            }));
            alert(`${signal.responderName || 'Peer'} declined the call.`);
          }
          break;
        }

        case 'webrtc_offer': {
          await webrtcService.startLocalMedia(signal.callType === 'video');
          await webrtcService.handleOffer(signal.offer);

          setCallState((prev) => ({
            ...prev,
            isActive: true,
            isRinging: false,
            startTime: Date.now(),
          }));
          break;
        }

        case 'webrtc_answer': {
          await webrtcService.handleAnswer(signal.answer);
          break;
        }

        case 'webrtc_candidate': {
          await webrtcService.handleCandidate(signal.candidate);
          break;
        }

        case 'call_ended': {
          webrtcService.endCall();
          setCallState((prev) => ({
            ...prev,
            isActive: false,
            isRinging: false,
          }));
          break;
        }
      }
    });

    return () => {
      unsubSignals();
    };
  }, []);

  const handleStartCall = async (callType: 'audio' | 'video', targetRoomId: string, remoteName: string) => {
    soundEffects.startRinging(false);

    setCallState({
      isActive: false,
      isRinging: true,
      isIncoming: false,
      callType,
      roomId: targetRoomId,
      remoteName,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });

    webrtcService.init(targetRoomId, callType, {
      onRemoteStream: () => {},
      onCallEnd: () => {
        setCallState((prev) => ({ ...prev, isActive: false, isRinging: false }));
      },
    });

    realtimeSocket.sendSignal({
      type: 'call_request',
      roomId: targetRoomId,
      callType,
    });
  };

  const handleAcceptCall = async () => {
    soundEffects.stopRinging();

    webrtcService.init(callState.roomId, callState.callType, {
      onRemoteStream: () => {},
      onCallEnd: () => {
        setCallState((prev) => ({ ...prev, isActive: false, isRinging: false }));
      },
    });

    await webrtcService.startLocalMedia(callState.callType === 'video');

    realtimeSocket.sendSignal({
      type: 'call_response',
      roomId: callState.roomId,
      accepted: true,
      callType: callState.callType,
    });

    setCallState((prev) => ({
      ...prev,
      isActive: true,
      isRinging: false,
      startTime: Date.now(),
    }));
  };

  const handleRejectCall = () => {
    soundEffects.stopRinging();
    webrtcService.endCall();

    realtimeSocket.sendSignal({
      type: 'call_response',
      roomId: callState.roomId,
      accepted: false,
    });

    setCallState((prev) => ({
      ...prev,
      isActive: false,
      isRinging: false,
    }));
  };

  const handleEndCall = () => {
    soundEffects.stopRinging();
    webrtcService.endCall();

    realtimeSocket.sendSignal({
      type: 'call_end',
      roomId: callState.roomId,
    });

    setCallState((prev) => ({
      ...prev,
      isActive: false,
      isRinging: false,
    }));
  };

  const isOperatorRoute = currentPath === '/join' || window.location.search.includes('mode=join');

  return (
    <div className="min-h-screen w-full bg-black text-white selection:bg-sky-500/30 selection:text-white">
      {/* Either Operator Join Dashboard or Visitor Chat Portal */}
      {isOperatorRoute ? (
        <OperatorJoinPortal
          onStartCall={handleStartCall}
          onGoToVisitorView={() => navigateTo('/')}
        />
      ) : (
        <VisitorChatPortal
          onStartCall={handleStartCall}
          onGoToOperator={() => navigateTo('/join')}
        />
      )}

      {/* Global Call Overlay Modal */}
      <CallModal
        callState={callState}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
        onEndCall={handleEndCall}
      />
    </div>
  );
}
