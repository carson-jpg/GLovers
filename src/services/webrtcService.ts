import { socketService } from './socketService';

interface CallConfig {
  video: boolean;
  audio: boolean;
}

interface CallEventCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallStateChange?: (state: CallState) => void;
  onError?: (error: string) => void;
  onCallEnded?: () => void;
}

type CallState = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'failed';

interface PeerConnection {
  pc: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  callId: string;
  participants: string[];
  state: CallState;
  config: CallConfig;
}

class WebRTCService {
  private peerConnection: PeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isInitiator = false;
  private currentCallId: string | null = null;
  private eventCallbacks: CallEventCallbacks = {};
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production use
  ];

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Call signaling events
    socketService.onIncomingCall(this.handleIncomingCall);
    socketService.onCallAnswered(this.handleCallAnswered);
    socketService.onCallRejected(this.handleCallRejected);
    socketService.onCallEnded(this.handleCallEnded);
    socketService.onCallOffer(this.handleCallOffer);
    socketService.onCallAnswer(this.handleCallAnswer);
    socketService.onIceCandidate(this.handleIceCandidate);
    socketService.onCallFailed(this.handleCallFailed);
  }

  async initializeMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  async startCall(recipientId: string, config: CallConfig): Promise<void> {
    try {
      if (this.peerConnection) {
        throw new Error('Call already in progress');
      }

      // Initialize media stream
      const mediaConstraints: MediaStreamConstraints = {
        video: config.video,
        audio: config.audio
      };

      this.localStream = await this.initializeMedia(mediaConstraints);
      this.isInitiator = true;
      this.currentCallId = this.generateCallId();

      // Create peer connection
      await this.createPeerConnection(recipientId, this.currentCallId, config);

      // Create offer
      const offer = await this.peerConnection.pc.createOffer();
      await this.peerConnection.pc.setLocalDescription(offer);

      // Send offer through socket
      socketService.sendCallOffer(recipientId, this.currentCallId, offer, config);

      this.updateCallState('calling');

    } catch (error) {
      console.error('Failed to start call:', error);
      this.updateCallState('failed');
      this.eventCallbacks.onError?.('Failed to start call');
      this.cleanup();
    }
  }

  handleIncomingCall = (callData: any): void => {
    try {
      if (this.peerConnection) {
        // Reject if already in a call
        socketService.rejectCall(callData.callId, 'Busy');
        return;
      }

      this.currentCallId = callData.callId;
      this.isInitiator = false;

      // Store the call data for later use
      this.pendingCallData = callData;

      // Create peer connection for answering first
      this.createPeerConnection(callData.from, callData.callId, callData.config);

      // Now set the call state to incoming and notify UI
      this.updateCallState('incoming');
      this.eventCallbacks.onCallStateChange?.('incoming');

    } catch (error) {
      console.error('Failed to handle incoming call:', error);
      socketService.rejectCall(callData.callId, 'Failed to handle call');
      this.cleanup();
    }
  };

  private pendingCallData: any = null;

  async acceptCall(callId: string): Promise<void> {
    console.log('Accepting call:', callId);
    
    // Check if we have a pending call or active peer connection
    if (!this.peerConnection || this.peerConnection.callId !== callId) {
      // If we have pending call data, use it to create the peer connection
      if (this.pendingCallData && this.pendingCallData.callId === callId) {
        this.createPeerConnection(this.pendingCallData.from, callId, this.pendingCallData.config);
        this.updateCallState('incoming'); // Make sure we're in incoming state
      } else {
        throw new Error('No incoming call to accept');
      }
    }

    try {
      // Initialize media if not already done
      if (!this.localStream) {
        const constraints: MediaStreamConstraints = {
          video: this.peerConnection.config.video,
          audio: this.peerConnection.config.audio
        };
        this.localStream = await this.initializeMedia(constraints);
        
        // Add tracks to peer connection
        this.localStream.getTracks().forEach(track => {
          this.peerConnection!.pc.addTrack(track, this.localStream!);
        });
      }

      // Create answer
      const answer = await this.peerConnection.pc.createAnswer();
      await this.peerConnection.pc.setLocalDescription(answer);

      // Send answer through socket
      socketService.sendCallAnswer(callId, answer);

      // Clear pending call data
      this.pendingCallData = null;
      
      this.updateCallState('connecting');
      console.log('Call accepted, transitioning to connecting state');

    } catch (error) {
      console.error('Failed to accept call:', error);
      this.eventCallbacks.onError?.('Failed to accept call');
      this.rejectCall(callId);
    }
  }

  async rejectCall(callId: string, reason?: string): Promise<void> {
    console.log('Rejecting call:', callId);
    
    // If this is our pending call, reject it via socket
    if (this.pendingCallData && this.pendingCallData.callId === callId) {
      socketService.rejectCall(callId, reason || 'Rejected');
      this.pendingCallData = null;
    } else if (this.peerConnection && this.peerConnection.callId === callId) {
      socketService.rejectCall(callId, reason || 'Rejected');
    }
    
    this.cleanup();
  }

  async endCall(): Promise<void> {
    if (!this.currentCallId) return;

    try {
      socketService.endCall(this.currentCallId);
    } finally {
      this.cleanup();
    }
  }

  toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  setEventCallbacks(callbacks: CallEventCallbacks): void {
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks };
  }

  // Private methods
  private async createPeerConnection(participantId: string, callId: string, config: CallConfig): Promise<void> {
    this.peerConnection = {
      pc: new RTCPeerConnection({ iceServers: this.iceServers }),
      callId,
      participants: [participantId],
      state: 'connecting',
      config
    };

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.remoteStream = remoteStream;
      this.eventCallbacks.onRemoteStream?.(remoteStream);
      this.updateCallState('connected');
    };

    // Handle ICE candidates
    this.peerConnection.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(this.currentCallId!, event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.pc.onconnectionstatechange = () => {
      const state = this.peerConnection!.pc.connectionState;
      console.log('Peer connection state:', state);
      
      switch (state) {
        case 'connected':
          this.updateCallState('connected');
          break;
        case 'disconnected':
          this.updateCallState('ended');
          this.eventCallbacks.onCallEnded?.();
          break;
        case 'failed':
          this.updateCallState('failed');
          this.eventCallbacks.onError?.('Connection failed');
          this.eventCallbacks.onCallEnded?.();
          break;
      }
    };

    this.updateCallState('connecting');
  }

  handleCallAnswered = (data: any): void => {
    if (this.peerConnection?.callId !== data.callId) return;

    try {
      this.peerConnection.pc.setRemoteDescription(data.answer);
      this.updateCallState('connecting');
    } catch (error) {
      console.error('Failed to set remote description:', error);
      this.eventCallbacks.onError?.('Failed to connect call');
      this.cleanup();
    }
  };

  handleCallRejected = (data: any): void => {
    if (this.peerConnection?.callId !== data.callId) return;

    this.updateCallState('ended');
    this.eventCallbacks.onError?.(data.reason || 'Call was rejected');
    this.cleanup();
  };

  handleCallEnded = (data: any): void => {
    if (this.peerConnection?.callId === data.callId) {
      this.updateCallState('ended');
      this.eventCallbacks.onCallEnded?.();
      this.cleanup();
    }
  };

  handleCallOffer = (data: any): void => {
    console.log('Handling call offer for callId:', data.callId);
    
    // If this is for our current incoming call, set the remote description
    if (this.peerConnection && this.peerConnection.callId === data.callId) {
      try {
        this.peerConnection.pc.setRemoteDescription(data.offer);
        console.log('Remote description set successfully');
      } catch (error) {
        console.error('Failed to handle call offer:', error);
        this.cleanup();
      }
    } else if (this.pendingCallData && this.pendingCallData.callId === data.callId) {
      // This might be the initial offer for our pending call
      // Create peer connection if not already created
      if (!this.peerConnection) {
        this.createPeerConnection(this.pendingCallData.from, data.callId, this.pendingCallData.config);
      }
      
      try {
        this.peerConnection!.pc.setRemoteDescription(data.offer);
        console.log('Remote description set for pending call');
      } catch (error) {
        console.error('Failed to handle call offer for pending call:', error);
        this.cleanup();
      }
    }
  };

  handleCallAnswer = (data: any): void => {
    if (!this.peerConnection || this.peerConnection.callId !== data.callId) return;

    try {
      this.peerConnection.pc.setRemoteDescription(data.answer);
    } catch (error) {
      console.error('Failed to handle call answer:', error);
      this.cleanup();
    }
  };

  handleIceCandidate = (data: any): void => {
    if (!this.peerConnection || this.peerConnection.callId !== data.callId) return;

    try {
      this.peerConnection.pc.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  };

  handleCallFailed = (data: any): void => {
    if (this.peerConnection?.callId === data.callId) {
      this.updateCallState('failed');
      this.eventCallbacks.onError?.(data.reason || 'Call failed');
      this.cleanup();
    }
  };

  private updateCallState(state: CallState): void {
    if (this.peerConnection) {
      this.peerConnection.state = state;
    }
    this.eventCallbacks.onCallStateChange?.(state);
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanup(): void {
    console.log('Cleaning up WebRTC service');
    
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.pc.close();
      this.peerConnection = null;
    }

    this.currentCallId = null;
    this.isInitiator = false;
    this.pendingCallData = null;
  }

  // Getters for current state
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCallState(): CallState | null {
    return this.peerConnection?.state || 'idle';
  }

  isCallActive(): boolean {
    return ['calling', 'incoming', 'connecting', 'connected'].includes(this.peerConnection?.state || 'idle');
  }

  isCallInProgress(): boolean {
    return this.peerConnection !== null;
  }

  destroy(): void {
    this.cleanup();
    socketService.offIncomingCall(this.handleIncomingCall);
    socketService.offCallAnswered(this.handleCallAnswered);
    socketService.offCallRejected(this.handleCallRejected);
    socketService.offCallEnded(this.handleCallEnded);
    socketService.offCallOffer(this.handleCallOffer);
    socketService.offCallAnswer(this.handleCallAnswer);
    socketService.offIceCandidate(this.handleIceCandidate);
    socketService.offCallFailed(this.handleCallFailed);
  }
}

export const webrtcService = new WebRTCService();
export type { CallState, CallConfig, CallEventCallbacks };