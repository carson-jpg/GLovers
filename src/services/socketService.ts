import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/integrations/api/client';

interface UserStatus {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
}

interface MessageEdit {
  chatId: string;
  messageId: string;
  newContent: string;
  editedAt: string;
}

interface MessageDelete {
  chatId: string;
  messageId: string;
}

interface CallData {
  callId: string;
  from: string;
  to: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  config: CallConfig;
  reason?: string;
}

interface CallConfig {
  video: boolean;
  audio: boolean;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectedUsers: Set<string> = new Set();
  private userStatuses: Map<string, UserStatus> = new Map();

  connect() {
    if (this.socket?.connected) {
      return;
    }

    const token = apiClient.getToken();
    if (!token) {
      console.warn('No authentication token available for Socket.IO connection');
      return;
    }

    // Get the API base URL by removing '/api' from the client URL
    const client = (apiClient as any);
    const apiBaseUrl = client.baseURL || 'https://glovers.onrender.com/api';
    console.log('Connecting to socket URL:', apiBaseUrl.replace('/api', '') || 'https://glovers.onrender.com');
    const socketUrl = apiBaseUrl.replace('/api', '') || 'https://glovers.onrender.com';

    this.socket = io(socketUrl, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection_confirmed');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected the client, reconnect manually
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    // Handle connected users list
    this.socket.on('connected_users', (users: string[]) => {
      this.connectedUsers = new Set(users);
      console.log('Connected users:', users);
    });

    // Handle user status changes
    this.socket.on('user_status_changed', (data: UserStatus) => {
      this.userStatuses.set(data.userId, data);
      console.log(`User ${data.userId} is now ${data.status}`);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Chat methods
  joinChat(chatId: string) {
    if (this.socket && this.isConnected) {
      console.log('🏠 Joining chat room:', chatId);
      this.socket.emit('join_chat', { chatId });
    } else {
      console.log('❌ Cannot join chat - socket not connected');
    }
  }

  leaveChat(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_chat', { chatId });
    }
  }

  sendMessage(chatId: string, content: string, type: 'text' | 'image' = 'text') {
    if (this.socket && this.isConnected) {
      console.log('📤 Sending message:', { chatId, content, type });
      this.socket.emit('send_message', { chatId, content, type });
    } else {
      console.log('❌ Cannot send message - socket not connected');
    }
  }

  // Message editing and deletion
  editMessage(chatId: string, messageId: string, newContent: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('edit_message', { chatId, messageId, newContent });
    }
  }

  deleteMessage(chatId: string, messageId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('delete_message', { chatId, messageId });
    }
  }

  // Typing indicators
  startTyping(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { chatId });
    }
  }

  stopTyping(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { chatId });
    }
  }

  clearTyping(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('clear_typing', { chatId });
    }
  }

  // Message read status
  markMessagesAsRead(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_messages_read', { chatId });
    }
  }

  // Message delivery status
  acknowledgeMessageDelivery(chatId: string, messageId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_delivered', { chatId, messageId });
    }
  }

  // User presence
  setUserOnline() {
    if (this.socket && this.isConnected) {
      this.socket.emit('user_online');
    }
  }

  setUserAway() {
    if (this.socket && this.isConnected) {
      this.socket.emit('user_away');
    }
  }

  getConnectedUsers() {
    if (this.socket && this.isConnected) {
      this.socket.emit('get_connected_users');
    }
  }

  // Chat participant management
  leaveChatParticipant(chatId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('chat_participant_left', { chatId });
    }
  }

  // Event listeners
  onNewMessage(callback: (data: { chatId: string; message: any }) => void) {
    this.socket?.on('new_message', (data) => {
      console.log('📨 New message received:', data);
      callback(data);
    });
  }

  onMessageDelivered(callback: (data: { chatId: string; messageId: string; deliveredTo: string }) => void) {
    this.socket?.on('message_delivered', callback);
  }

  onMessageEdited(callback: (data: MessageEdit) => void) {
    this.socket?.on('message_edited', callback);
  }

  onMessageDeleted(callback: (data: MessageDelete) => void) {
    this.socket?.on('message_deleted', callback);
  }

  onUserTyping(callback: (data: { userId: string; chatId: string }) => void) {
    this.socket?.on('user_typing', callback);
  }

  onUserStoppedTyping(callback: (data: { userId: string; chatId: string }) => void) {
    this.socket?.on('user_stopped_typing', callback);
  }

  onMessagesRead(callback: (data: { chatId: string; userId: string }) => void) {
    this.socket?.on('messages_read', callback);
  }

  onUserStatusChanged(callback: (data: UserStatus) => void) {
    this.socket?.on('user_status_changed', callback);
  }

  onParticipantLeft(callback: (data: { chatId: string; userId: string }) => void) {
    this.socket?.on('participant_left', callback);
  }

  onConnectedUsers(callback: (users: string[]) => void) {
    this.socket?.on('connected_users', callback);
  }

  onError(callback: (error: { message: string }) => void) {
    this.socket?.on('error', callback);
  }

  // Remove event listeners
  offNewMessage(callback?: (data: { chatId: string; message: any }) => void) {
    if (callback) {
      this.socket?.off('new_message', callback);
    } else {
      this.socket?.off('new_message');
    }
  }

  offMessageDelivered(callback?: (data: { chatId: string; messageId: string; deliveredTo: string }) => void) {
    if (callback) {
      this.socket?.off('message_delivered', callback);
    } else {
      this.socket?.off('message_delivered');
    }
  }

  offMessageEdited(callback?: (data: MessageEdit) => void) {
    if (callback) {
      this.socket?.off('message_edited', callback);
    } else {
      this.socket?.off('message_edited');
    }
  }

  offMessageDeleted(callback?: (data: MessageDelete) => void) {
    if (callback) {
      this.socket?.off('message_deleted', callback);
    } else {
      this.socket?.off('message_deleted');
    }
  }

  offUserTyping(callback?: (data: { userId: string; chatId: string }) => void) {
    if (callback) {
      this.socket?.off('user_typing', callback);
    } else {
      this.socket?.off('user_typing');
    }
  }

  offUserStoppedTyping(callback?: (data: { userId: string; chatId: string }) => void) {
    if (callback) {
      this.socket?.off('user_stopped_typing', callback);
    } else {
      this.socket?.off('user_stopped_typing');
    }
  }

  offMessagesRead(callback?: (data: { chatId: string; userId: string }) => void) {
    if (callback) {
      this.socket?.off('messages_read', callback);
    } else {
      this.socket?.off('messages_read');
    }
  }

  offUserStatusChanged(callback?: (data: UserStatus) => void) {
    if (callback) {
      this.socket?.off('user_status_changed', callback);
    } else {
      this.socket?.off('user_status_changed');
    }
  }

  offParticipantLeft(callback?: (data: { chatId: string; userId: string }) => void) {
    if (callback) {
      this.socket?.off('participant_left', callback);
    } else {
      this.socket?.off('participant_left');
    }
  }

  offConnectedUsers(callback?: (users: string[]) => void) {
    if (callback) {
      this.socket?.off('connected_users', callback);
    } else {
      this.socket?.off('connected_users');
    }
  }

  offError(callback?: (error: { message: string }) => void) {
    if (callback) {
      this.socket?.off('error', callback);
    } else {
      this.socket?.off('error');
    }
  }

  // Utility methods
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getUserStatus(userId: string): UserStatus | undefined {
    return this.userStatuses.get(userId);
  }

  getAllConnectedUsers(): string[] {
    return Array.from(this.connectedUsers);
  }

  // WebRTC Call methods
  sendCallOffer(recipientId: string, callId: string, offer: RTCSessionDescriptionInit, config: CallConfig) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_offer', { recipientId, callId, offer, config });
    }
  }

  sendCallAnswer(callId: string, answer: RTCSessionDescriptionInit) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_answer', { callId, answer });
    }
  }

  sendIceCandidate(callId: string, candidate: RTCIceCandidateInit) {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice_candidate', { callId, candidate });
    }
  }

  endCall(callId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('end_call', { callId });
    }
  }

  rejectCall(callId: string, reason?: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('reject_call', { callId, reason });
    }
  }

  // WebRTC Call event listeners
  onIncomingCall(callback: (data: CallData) => void) {
    this.socket?.on('incoming_call', callback);
  }

  onCallAnswered(callback: (data: { callId: string; answer: RTCSessionDescriptionInit }) => void) {
    this.socket?.on('call_answered', callback);
  }

  onCallRejected(callback: (data: { callId: string; reason?: string }) => void) {
    this.socket?.on('call_rejected', callback);
  }

  onCallEnded(callback: (data: { callId: string }) => void) {
    this.socket?.on('call_ended', callback);
  }

  onCallOffer(callback: (data: CallData) => void) {
    this.socket?.on('call_offer', callback);
  }

  onCallAnswer(callback: (data: { callId: string; answer: RTCSessionDescriptionInit }) => void) {
    this.socket?.on('call_answer', callback);
  }

  onIceCandidate(callback: (data: { callId: string; candidate: RTCIceCandidateInit }) => void) {
    this.socket?.on('ice_candidate', callback);
  }

  onCallFailed(callback: (data: { callId: string; reason?: string }) => void) {
    this.socket?.on('call_failed', callback);
  }

  // Remove WebRTC event listeners
  offIncomingCall(callback?: (data: CallData) => void) {
    if (callback) {
      this.socket?.off('incoming_call', callback);
    } else {
      this.socket?.off('incoming_call');
    }
  }

  offCallAnswered(callback?: (data: { callId: string; answer: RTCSessionDescriptionInit }) => void) {
    if (callback) {
      this.socket?.off('call_answered', callback);
    } else {
      this.socket?.off('call_answered');
    }
  }

  offCallRejected(callback?: (data: { callId: string; reason?: string }) => void) {
    if (callback) {
      this.socket?.off('call_rejected', callback);
    } else {
      this.socket?.off('call_rejected');
    }
  }

  offCallEnded(callback?: (data: { callId: string }) => void) {
    if (callback) {
      this.socket?.off('call_ended', callback);
    } else {
      this.socket?.off('call_ended');
    }
  }

  offCallOffer(callback?: (data: CallData) => void) {
    if (callback) {
      this.socket?.off('call_offer', callback);
    } else {
      this.socket?.off('call_offer');
    }
  }

  offCallAnswer(callback?: (data: { callId: string; answer: RTCSessionDescriptionInit }) => void) {
    if (callback) {
      this.socket?.off('call_answer', callback);
    } else {
      this.socket?.off('call_answer');
    }
  }

  offIceCandidate(callback?: (data: { callId: string; candidate: RTCIceCandidateInit }) => void) {
    if (callback) {
      this.socket?.off('ice_candidate', callback);
    } else {
      this.socket?.off('ice_candidate');
    }
  }

  offCallFailed(callback?: (data: { callId: string; reason?: string }) => void) {
    if (callback) {
      this.socket?.off('call_failed', callback);
    } else {
      this.socket?.off('call_failed');
    }
  }

  // Private emit method
  private emit(event: string, data?: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }
}

export const socketService = new SocketService();
export default socketService;