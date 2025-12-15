import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CallQualityFeedback from './CallQualityFeedback';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Loader2,
  Star
} from 'lucide-react';
import { webrtcService, CallState, CallConfig } from '@/services/webrtcService';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';

interface CallInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  callState: CallState;
  callConfig: CallConfig;
  recipientInfo?: {
    id: string;
    email: string;
    avatar?: string;
  };
}

export default function CallInterface({ 
  isOpen, 
  onClose, 
  callState, 
  callConfig, 
  recipientInfo 
}: CallInterfaceProps) {
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showQualityFeedback, setShowQualityFeedback] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number>();
  const callEndTimeoutRef = useRef<number>();

  useEffect(() => {
    if (callState === 'connected') {
      startCallTimer();
    } else {
      stopCallTimer();
    }

    return () => {
      stopCallTimer();
    };
  }, [callState]);

  useEffect(() => {
    // Set up WebRTC event listeners
    webrtcService.setEventCallbacks({
      onLocalStream: handleLocalStream,
      onRemoteStream: handleRemoteStream,
      onCallStateChange: handleCallStateChange,
      onError: handleCallError,
      onCallEnded: handleCallEnded
    });

    return () => {
      webrtcService.setEventCallbacks({});
    };
  }, [isOpen]);

  const handleLocalStream = (stream: MediaStream) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  const handleRemoteStream = (stream: MediaStream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  };

  const handleCallStateChange = (state: CallState) => {
    console.log('Call state changed:', state);
    
    // Show quality feedback when call ends successfully
    if (state === 'ended' || state === 'failed') {
      if (callDuration > 10) { // Only show feedback for calls longer than 10 seconds
        // Delay showing feedback to allow call interface to close
        callEndTimeoutRef.current = window.setTimeout(() => {
          setShowQualityFeedback(true);
        }, 1000);
      } else {
        onClose();
      }
    }
  };

  const handleCallError = (error: string) => {
    setError(error);
  };

  const handleCallEnded = () => {
    // Log the call before showing feedback
    logCall('completed');
    onClose();
  };

  const logCall = async (status: string) => {
    try {
      if (!recipientInfo?.id) return;
      
      // Find or create chat for this call
      const chatResponse = await apiClient.request('/chats', {
        method: 'POST',
        body: JSON.stringify({ participantId: recipientInfo.id })
      });

      if (chatResponse.success) {
        const chatId = chatResponse.data._id;
        
        // Log the call
        const callLogData = {
          chatId,
          participantId: recipientInfo.id,
          callType: callConfig.video ? 'video' : 'voice',
          direction: 'outgoing', // This would need to be determined based on call initiation
          status,
          duration: callDuration,
          callId: currentCallId || undefined
        };

        const logResponse = await apiClient.logCall(callLogData);
        
        if (logResponse.success) {
          setCurrentCallId(logResponse.data.id);
        }
      }
    } catch (error) {
      console.error('Failed to log call:', error);
    }
  };

  const startCallTimer = () => {
    callStartTimeRef.current = Date.now();
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);
  };

  const stopCallTimer = () => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
    }
    setCallDuration(0);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    try {
      await webrtcService.endCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const handleToggleMute = () => {
    const isEnabled = webrtcService.toggleAudio();
    setIsMuted(!isEnabled);
  };

  const handleToggleVideo = () => {
    const isEnabled = webrtcService.toggleVideo();
    setIsVideoOff(!isEnabled);
  };

  const handleQualityFeedbackClose = () => {
    setShowQualityFeedback(false);
    onClose();
  };

  const renderCallContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <PhoneOff className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Call Failed</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      );
    }

    if (callState === 'calling' || callState === 'connecting') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="relative mb-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={recipientInfo?.avatar} />
              <AvatarFallback className="text-2xl">
                {recipientInfo?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {callState === 'calling' && (
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
            )}
          </div>
          
          <h3 className="text-xl font-semibold mb-2">
            {recipientInfo?.email || 'Unknown User'}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {callState === 'calling' ? 'Calling...' : 'Connecting...'}
          </p>
          
          {callConfig.video && (
            <div className="w-32 h-24 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
        </div>
      );
    }

    if (callState === 'incoming') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="relative mb-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={recipientInfo?.avatar} />
              <AvatarFallback className="text-2xl">
                {recipientInfo?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-green-500/10 animate-pulse" />
          </div>
          
          <h3 className="text-xl font-semibold mb-2">
            {recipientInfo?.email || 'Unknown User'}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {callConfig.video ? 'Video' : 'Voice'} call incoming...
          </p>

          {callConfig.video && (
            <div className="w-32 h-24 bg-muted rounded-lg mb-4 flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
          )}
        </div>
      );
    }

    // Connected call state
    return (
      <div className="relative h-full bg-black rounded-lg overflow-hidden">
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local video (picture-in-picture) */}
        {callConfig.video && (
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Call info overlay */}
        <div className="absolute top-4 left-4 text-white">
          <h3 className="font-semibold">
            {recipientInfo?.email || 'Unknown User'}
          </h3>
          <p className="text-sm opacity-75">
            {callConfig.video ? 'Video call' : 'Voice call'}
          </p>
        </div>

        {/* Call duration */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-center">
          <p className="text-sm font-mono">
            {formatDuration(callDuration)}
          </p>
        </div>

        {/* Quality indicator */}
        <div className="absolute top-4 right-20 text-white">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowQualityFeedback(true)}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40"
          >
            <Star className="w-4 h-4" />
          </Button>
        </div>

        {/* Call controls */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <Button
            size="icon"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={handleToggleMute}
            className="w-12 h-12 rounded-full"
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {callConfig.video && (
            <Button
              size="icon"
              variant={isVideoOff ? "destructive" : "secondary"}
              onClick={handleToggleVideo}
              className="w-12 h-12 rounded-full"
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
          )}

          <Button
            size="icon"
            variant="destructive"
            onClick={handleEndCall}
            className="w-12 h-12 rounded-full"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  };

  if (!isOpen && !showQualityFeedback) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`${isMinimized ? 'p-2 w-auto' : 'p-0 w-[90vw] h-[90vh] max-w-none'}`}>
          {!isMinimized && (
            <DialogHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <DialogTitle>
                  {callConfig.video ? 'Video Call' : 'Voice Call'}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsMinimized(true)}
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
          )}
          
          <CardContent className={`${isMinimized ? 'p-2' : 'p-0'} h-full`}>
            <div className={`${isMinimized ? 'w-80 h-16' : 'h-[calc(100%-4rem)]'} relative`}>
              {renderCallContent()}
            </div>
          </CardContent>
        </DialogContent>
      </Dialog>

      {/* Quality Feedback Dialog */}
      {currentCallId && (
        <CallQualityFeedback
          isOpen={showQualityFeedback}
          onClose={handleQualityFeedbackClose}
          callId={currentCallId}
          callType={callConfig.video ? 'video' : 'voice'}
        />
      )}
    </>
  );
}