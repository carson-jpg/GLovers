import { useState, useCallback, useEffect } from 'react';
import { webrtcService, CallState, CallConfig } from '@/services/webrtcService';
import { socketService } from '@/services/socketService';
import { useAuth } from './useAuth';

interface UseCallReturn {
  callState: CallState;
  callConfig: CallConfig;
  currentCallId: string | null;
  isCallActive: boolean;
  isCallInProgress: boolean;
  recipientInfo: {
    id: string;
    email: string;
    avatar?: string;
  } | null;
  
  // Call actions
  startCall: (recipientId: string, config: CallConfig) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string, reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => boolean;
  toggleVideo: () => boolean;
  
  // UI state
  isCallModalOpen: boolean;
  setIsCallModalOpen: (open: boolean) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

export function useCall(): UseCallReturn {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callConfig, setCallConfig] = useState<CallConfig>({ video: false, audio: true });
  const [recipientInfo, setRecipientInfo] = useState<{
    id: string;
    email: string;
    avatar?: string;
  } | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCallData, setPendingCallData] = useState<any>(null);

  // Initialize WebRTC service
  useEffect(() => {
    webrtcService.setEventCallbacks({
      onCallStateChange: handleCallStateChange,
      onError: handleCallError,
      onCallEnded: handleCallEnded
    });

    return () => {
      webrtcService.destroy();
    };
  }, []);

  // Socket event listeners for incoming calls
  useEffect(() => {
    socketService.onIncomingCall((data) => {
      console.log('Incoming call received:', data);
      setPendingCallData(data);
      setCallConfig(data.config);
      setRecipientInfo({ id: data.from, email: 'Loading...', avatar: undefined });
      setIsCallModalOpen(true);
    });

    return () => {
      socketService.offIncomingCall(() => {});
    };
  }, []);

  const handleCallStateChange = useCallback((state: CallState) => {
    setCallState(state);
    
    // Auto-open modal for certain states
    if (state === 'incoming' || state === 'calling' || state === 'connecting') {
      setIsCallModalOpen(true);
    }
    
    // Auto-close modal for ended states
    if (state === 'ended' || state === 'failed') {
      setIsCallModalOpen(false);
      setCurrentCallId(null);
      setRecipientInfo(null);
      setPendingCallData(null);
    }
  }, []);

  const handleCallError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setCallState('failed');
  }, []);

  const handleCallEnded = useCallback(() => {
    setCallState('ended');
    setCurrentCallId(null);
    setRecipientInfo(null);
  }, []);

  const handleIncomingCall = useCallback(async (data: any) => {
    setPendingCallData(data);
    setCallConfig(data.config);
    
    // Load recipient info
    try {
      // You would typically fetch user info from your API here
      // For now, we'll use a placeholder
      setRecipientInfo({ 
        id: data.from, 
        email: `User ${data.from.slice(-4)}`, 
        avatar: undefined 
      });
    } catch (error) {
      console.error('Failed to load recipient info:', error);
      setError('Failed to load caller information');
    }
  }, []);

  const startCall = useCallback(async (recipientId: string, config: CallConfig) => {
    try {
      setError(null);
      setCallConfig(config);
      setRecipientInfo({ id: recipientId, email: 'Loading...', avatar: undefined });
      setIsCallModalOpen(true);
      
      await webrtcService.startCall(recipientId, config);
      
      // Load recipient info
      try {
        // You would typically fetch user info from your API here
        setRecipientInfo({ 
          id: recipientId, 
          email: `User ${recipientId.slice(-4)}`, 
          avatar: undefined 
        });
      } catch (error) {
        console.error('Failed to load recipient info:', error);
      }
      
    } catch (error) {
      console.error('Failed to start call:', error);
      setError(error instanceof Error ? error.message : 'Failed to start call');
      setIsCallModalOpen(false);
    }
  }, []);

  const acceptCall = useCallback(async (callId: string) => {
    try {
      setError(null);
      setCurrentCallId(callId);
      
      if (pendingCallData) {
        setCallConfig(pendingCallData.config);
        setRecipientInfo({ 
          id: pendingCallData.from, 
          email: `User ${pendingCallData.from.slice(-4)}`, 
          avatar: undefined 
        });
      }
      
      await webrtcService.acceptCall(callId);
      setPendingCallData(null);
      
    } catch (error) {
      console.error('Failed to accept call:', error);
      setError(error instanceof Error ? error.message : 'Failed to accept call');
      rejectCall(callId, 'Failed to accept call');
    }
  }, [pendingCallData]);

  const rejectCall = useCallback(async (callId: string, reason?: string) => {
    try {
      await webrtcService.rejectCall(callId, reason);
      setIsCallModalOpen(false);
      setCurrentCallId(null);
      setRecipientInfo(null);
      setPendingCallData(null);
    } catch (error) {
      console.error('Failed to reject call:', error);
      setError(error instanceof Error ? error.message : 'Failed to reject call');
    }
  }, []);

  const endCall = useCallback(async () => {
    try {
      await webrtcService.endCall();
      setIsCallModalOpen(false);
      setCurrentCallId(null);
      setRecipientInfo(null);
    } catch (error) {
      console.error('Failed to end call:', error);
      setError(error instanceof Error ? error.message : 'Failed to end call');
    }
  }, []);

  const toggleAudio = useCallback(() => {
    return webrtcService.toggleAudio();
  }, []);

  const toggleVideo = useCallback(() => {
    return webrtcService.toggleVideo();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    callState,
    callConfig,
    currentCallId,
    isCallActive: webrtcService.isCallActive(),
    isCallInProgress: webrtcService.isCallInProgress(),
    recipientInfo,
    
    // Call actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    
    // UI state
    isCallModalOpen,
    setIsCallModalOpen,
    
    // Error handling
    error,
    clearError
  };
}