import { realtimeSocket } from './websocket';
import { soundEffects } from './sound';

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  private onCallEndCb: (() => void) | null = null;
  private onAudioLevelCb: ((level: number) => void) | null = null;

  private roomId: string = '';
  private callType: 'audio' | 'video' = 'video';

  init(roomId: string, callType: 'audio' | 'video', callbacks: {
    onRemoteStream: (stream: MediaStream) => void;
    onCallEnd: () => void;
    onAudioLevel?: (level: number) => void;
  }) {
    this.roomId = roomId;
    this.callType = callType;
    this.onRemoteStreamCb = callbacks.onRemoteStream;
    this.onCallEndCb = callbacks.onCallEnd;
    this.onAudioLevelCb = callbacks.onAudioLevel || null;
  }

  async startLocalMedia(video: boolean = true): Promise<MediaStream> {
    try {
      // Ultra-HD High Fidelity Video & Studio-Grade Voice Settings
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video ? {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 },
          facingMode: 'user',
        } : false,
      });
    } catch (err) {
      console.warn('Ultra-HD camera not available or blocked, falling back to standard HD/audio', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 48000,
            channelCount: 2,
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
      } catch (audioOnlyErr) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    }

    this.setupAudioAnalysis(this.localStream);
    return this.localStream;
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection(rtcConfig);

    this.remoteStream = new MediaStream();
    if (this.onRemoteStreamCb) {
      this.onRemoteStreamCb(this.remoteStream);
    }

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }

    // Listen for remote tracks
    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream?.getTracks().includes(track)) {
          this.remoteStream?.addTrack(track);
        }
      });
      if (this.onRemoteStreamCb && this.remoteStream) {
        this.onRemoteStreamCb(this.remoteStream);
      }
    };

    // Forward ICE candidates over WebSocket
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        realtimeSocket.sendSignal({
          type: 'webrtc_candidate',
          roomId: this.roomId,
          candidate: event.candidate,
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'disconnected' || this.pc?.connectionState === 'failed') {
        this.endCall();
      }
    };
  }

  async makeOffer() {
    this.createPeerConnection();
    if (!this.pc) return;

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.callType === 'video',
    });
    await this.pc.setLocalDescription(offer);

    realtimeSocket.sendSignal({
      type: 'webrtc_offer',
      roomId: this.roomId,
      offer,
      callType: this.callType,
    });
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    this.createPeerConnection();
    if (!this.pc) return;

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    realtimeSocket.sendSignal({
      type: 'webrtc_answer',
      roomId: this.roomId,
      answer,
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.pc && this.pc.signalingState !== 'closed') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleCandidate(candidate: RTCIceCandidateInit) {
    if (this.pc && this.pc.remoteDescription) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Error adding ice candidate', e);
      }
    }
  }

  toggleAudio(muted?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = muted !== undefined ? !muted : !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  toggleVideo(disabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = disabled !== undefined ? !disabled : !videoTrack.enabled;
      return !videoTrack.enabled;
    }
    return false;
  }

  async toggleScreenShare(): Promise<boolean> {
    if (this.screenStream) {
      // Stop screen share, restore camera
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      if (this.localStream && this.pc) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const senders = this.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        }
      }
      return false;
    } else {
      // Start screen share
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = this.screenStream.getVideoTracks()[0];
        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        if (this.pc) {
          const senders = this.pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            this.pc.addTrack(screenTrack, this.screenStream);
          }
        }
        return true;
      } catch (err) {
        console.warn('Screen share canceled or denied', err);
        return false;
      }
    }
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 255) * 100));
        if (this.onAudioLevelCb) {
          this.onAudioLevelCb(normalized);
        }
        this.animFrameId = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      // AudioContext policy
    }
  }

  endCall() {
    soundEffects.stopRinging();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.onCallEndCb) {
      this.onCallEndCb();
    }
  }
}

export const webrtcService = new WebRTCManager();
