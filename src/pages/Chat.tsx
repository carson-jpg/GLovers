import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { socketService } from '@/services/socketService';
import { useCall } from '@/hooks/useCall';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import CallInterface from '@/components/CallInterface';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  MoreVertical,
  Loader2,
  Heart,
  Users,
  Edit2,
  Trash2
} from 'lucide-react';

interface Message {
  _id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'system';
  timestamp: string;
  sender: {
    _id: string;
    email: string;
  };
  readBy: Array<{
    userId: string;
    readAt: string;
  }>;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
  deliveredTo?: Array<{
    userId: string;
    deliveredAt: string;
  }>;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  attachments?: Array<{
    type: 'image' | 'file' | 'audio' | 'video';
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>;
}

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    email: string;
  }>;
  lastMessage: string;
  lastMessageAt: string;
  messages: Message[];
  chatType?: 'direct' | 'group';
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    callState,
    callConfig,
    isCallModalOpen,
    setIsCallModalOpen,
    recipientInfo,
    error: callError
  } = useCall();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, { status: string; lastSeen?: string }>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const editTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (chatId && user) {
      loadChat();
      joinChatRoom();
      initializeSocketListeners();
      socketService.getConnectedUsers();
    }
  }, [chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSocketListeners = () => {
    socketService.onNewMessage(handleNewMessage);
    socketService.onMessageDelivered(handleMessageDelivered);
    socketService.onMessageEdited(handleMessageEdited);
    socketService.onMessageDeleted(handleMessageDeleted);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);
    socketService.onConnectedUsers(handleConnectedUsers);
    socketService.onUserStatusChanged(handleUserStatusChanged);
    socketService.onMessagesRead(handleMessagesRead);
    socketService.onError(handleSocketError);

    return () => {
      socketService.offNewMessage(handleNewMessage);
      socketService.offMessageDelivered(handleMessageDelivered);
      socketService.offMessageEdited(handleMessageEdited);
      socketService.offMessageDeleted(handleMessageDeleted);
      socketService.offUserTyping(handleUserTyping);
      socketService.offUserStoppedTyping(handleUserStoppedTyping);
      socketService.offConnectedUsers(handleConnectedUsers);
      socketService.offUserStatusChanged(handleUserStatusChanged);
      socketService.offMessagesRead(handleMessagesRead);
      socketService.offError(handleSocketError);
    };
  };

  const loadChat = async () => {
    try {
      setIsLoading(true);
      setChatError(null);
      const response = await apiClient.getChat(chatId!);
      if (response.success) {
        setChat(response.data);
        setMessages(response.data.messages || []);
        socketService.markMessagesAsRead(chatId!);
        acknowledgeUnreadMessages(response.data.messages || []);
      }
    } catch (error: any) {
      setChatError(error.message || 'Chat not found');
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load chat' });
    } finally {
      setIsLoading(false);
    }
  };

  const joinChatRoom = () => {
    if (chatId) socketService.joinChat(chatId);
  };

  const acknowledgeUnreadMessages = (msgs: Message[]) => {
    msgs.forEach(message => {
      if (message.senderId !== user?.id && message.deliveryStatus !== 'delivered') {
        socketService.acknowledgeMessageDelivery(chatId!, message._id);
      }
    });
  };

  const handleNewMessage = (data: { chatId: string; message: Message }) => {
    if (data.chatId === chatId) {
      setMessages(prev => [...prev, data.message]);
      socketService.acknowledgeMessageDelivery(chatId!, data.message._id);
    }
  };

  const handleMessageDelivered = (data: { chatId: string; messageId: string; deliveredTo: string }) => {
    if (data.chatId === chatId && data.deliveredTo !== user?.id) {
      setMessages(prev => prev.map(msg => msg._id === data.messageId ? { ...msg, deliveryStatus: 'delivered' } : msg));
    }
  };

  const handleMessageEdited = (data: { chatId: string; messageId: string; newContent: string; editedAt: string }) => {
    if (data.chatId === chatId) {
      setMessages(prev => prev.map(msg => msg._id === data.messageId ? { ...msg, content: data.newContent, isEdited: true, editedAt: data.editedAt } : msg));
    }
  };

  const handleMessageDeleted = (data: { chatId: string; messageId: string }) => {
    if (data.chatId === chatId) {
      setMessages(prev => prev.map(msg => msg._id === data.messageId ? { ...msg, isDeleted: true, deletedAt: new Date().toISOString() } : msg));
    }
  };

  const handleUserTyping = (data: { userId: string; chatId: string }) => {
    if (data.chatId === chatId && data.userId !== user?.id) {
      setTypingUsers(prev => new Set([...prev, data.userId]));
    }
  };

  const handleUserStoppedTyping = (data: { userId: string; chatId: string }) => {
    if (data.chatId === chatId) {
      setTypingUsers(prev => { const newSet = new Set(prev); newSet.delete(data.userId); return newSet; });
    }
  };

  const handleConnectedUsers = (users: string[]) => {
    setConnectedUsers(new Set(users));
  };

  const handleUserStatusChanged = (data: { userId: string; status: string; lastSeen?: string }) => {
    setUserStatuses(prev => { const newStatuses = new Map(prev); newStatuses.set(data.userId, { status: data.status, lastSeen: data.lastSeen }); return newStatuses; });
  };

  const handleMessagesRead = (data: { chatId: string; userId: string }) => {
    if (data.chatId === chatId && data.userId !== user?.id) {
      setMessages(prev => prev.map(msg => msg.senderId === user?.id ? { ...msg, deliveryStatus: 'read' } : msg));
    }
  };

  const handleSocketError = (error: { message: string }) => {
    toast({ variant: 'destructive', title: 'Connection Error', description: error.message });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;
    setIsSending(true);
    try {
      socketService.sendMessage(chatId, newMessage.trim());
      setNewMessage('');
      socketService.stopTyping(chatId);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message' });
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditContent(currentContent);
    if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
    editTimeoutRef.current = setTimeout(() => { setEditingMessageId(null); setEditContent(''); }, 30000);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingMessageId || !chatId) return;
    socketService.editMessage(chatId, editingMessageId, editContent.trim());
    setEditingMessageId(null);
    setEditContent('');
    if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!chatId) return;
    socketService.deleteMessage(chatId, messageId);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (chatId) {
      socketService.startTyping(chatId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socketService.stopTyping(chatId), 1000);
    }
  };

  const handleVoiceCall = async () => {
    const otherParticipant = getOtherParticipant();
    if (!otherParticipant) return;
    try {
      await startCall(otherParticipant._id, { video: false, audio: true });
      toast({ title: 'Calling', description: `Calling ${otherParticipant.email}...` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Call Failed', description: error instanceof Error ? error.message : 'Failed to start call' });
    }
  };

  const handleVideoCall = async () => {
    const otherParticipant = getOtherParticipant();
    if (!otherParticipant) return;
    try {
      await startCall(otherParticipant._id, { video: true, audio: true });
      toast({ title: 'Video Calling', description: `Video calling ${otherParticipant.email}...` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Video Call Failed', description: error instanceof Error ? error.message : 'Failed to start video call' });
    }
  };

  const getOtherParticipant = () => {
    if (!chat || !user) return null;
    return chat.participants.find(p => p._id !== user.id);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getUserStatus = (userId: string) => {
    if (connectedUsers.has(userId)) return 'online';
    const status = userStatuses.get(userId);
    return status?.status || 'offline';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e5ddd5]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (chatError) {
    return (
      <div className="min-h-screen bg-[#e5ddd5] flex flex-col">
        <div className="bg-[#075e54] sticky top-0 z-50">
          <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="ml-3 font-semibold text-white">Chat Error</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chat Not Found</h3>
            <p className="text-[#667781] mb-4">{chatError}</p>
            <Button onClick={() => navigate('/')}>Return to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const otherParticipant = getOtherParticipant();

  return (
    <div className="min-h-screen bg-[#e5ddd5] flex flex-col" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M10 10h80v80H10z\' fill=\'%23d9d9d9\' opacity=\'0.06\'/%3E%3C/svg%3E")' }}>
      {/* Header */}
      <div className="bg-[#075e54] shadow-sm sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-[#128c7e]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className="w-10 h-10">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback className="bg-[#128c7e] text-white">
                {otherParticipant?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-medium text-white text-[16px]">{otherParticipant?.email || 'Unknown User'}</h2>
              <p className="text-[13px] text-[#d9fdd3]">
                {typingUsers.size > 0 ? 'typing...' : getUserStatus(otherParticipant?._id || '') === 'online' ? 'online' : 'offline'}
              </p>
            </div>
          </div>
          <div className="flex gap-5">
            <button onClick={handleVideoCall} disabled={!otherParticipant || callState !== 'idle'} className="text-white hover:opacity-80">
              <Video className="w-5 h-5" />
            </button>
            <button onClick={handleVoiceCall} disabled={!otherParticipant || callState !== 'idle'} className="text-white hover:opacity-80">
              <Phone className="w-5 h-5" />
            </button>
            <button className="text-white hover:opacity-80">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-[8%] py-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-[#667781]">Start the conversation!</h3>
            <p className="text-[#667781]">Send a message to begin chatting.</p>
          </div>
        ) : (
          <div className="max-w-[900px] mx-auto space-y-2">
            {messages.map((message, index) => {
              // Fix ID comparison - handle different formats (string vs object)
              const isOwn = String(message.senderId) === String(user?.id);
              const showDate = index === 0 || formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);
              
              console.log('Message:', message.content, 'isOwn:', isOwn, 'senderId:', message.senderId, 'userId:', user?.id);
              
              return (
                <div key={message._id}>
                  {showDate && (
                    <div style={{ textAlign: 'center', margin: '12px 0' }}>
                      <div style={{ 
                        display: 'inline-block', 
                        backgroundColor: 'rgba(255,255,255,0.85)', 
                        padding: '6px 12px', 
                        borderRadius: '7px', 
                        fontSize: '12.5px', 
                        color: '#667781', 
                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)' 
                      }}>
                        {formatDate(message.timestamp)}
                      </div>
                    </div>
                  )}
                  
                  {message.isDeleted ? (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                      <div style={{ 
                        backgroundColor: 'rgba(255,255,255,0.85)', 
                        color: '#667781', 
                        fontStyle: 'italic', 
                        padding: '7px 12px', 
                        borderRadius: '7px', 
                        fontSize: '13px', 
                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Trash2 className="w-3 h-3" />
                        <span>This message was deleted</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      marginBottom: '2px',
                      width: '100%'
                    }}>
                      <div style={{ maxWidth: '65%', position: 'relative' }}>
                        {editingMessageId === message._id ? (
                          <div style={{ 
                            backgroundColor: 'white', 
                            borderRadius: '7.5px', 
                            padding: '6px 7px 8px 9px', 
                            boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)'
                          }}>
                            <Input 
                              value={editContent} 
                              onChange={(e) => setEditContent(e.target.value)} 
                              style={{ 
                                fontSize: '14.2px', 
                                border: 'none', 
                                padding: 0, 
                                height: 'auto', 
                                backgroundColor: 'transparent' 
                              }} 
                              placeholder="Edit your message..." 
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            position: 'relative',
                            padding: '6px 7px 8px 9px',
                            borderRadius: '7.5px',
                            boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                            backgroundColor: isOwn ? '#d9fdd3' : 'white',
                            borderTopLeftRadius: '7.5px',
                            borderTopRightRadius: '7.5px',
                            borderBottomRightRadius: isOwn ? '0px' : '7.5px',
                            borderBottomLeftRadius: isOwn ? '7.5px' : '0px'
                          }}>
                            {/* Message tail */}
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              width: 0,
                              height: 0,
                              ...(isOwn 
                                ? { 
                                    right: '-8px',
                                    borderLeft: '8px solid #d9fdd3',
                                    borderBottom: '13px solid transparent'
                                  }
                                : { 
                                    left: '-8px',
                                    borderRight: '8px solid white',
                                    borderBottom: '13px solid transparent'
                                  }
                              )
                            }} />
                            
                            <p style={{ 
                              fontSize: '14.2px', 
                              lineHeight: '19px', 
                              whiteSpace: 'pre-wrap', 
                              wordBreak: 'break-word', 
                              marginBottom: '2px',
                              color: '#111827'
                            }}>
                              {message.content}
                            </p>
                            
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'flex-end', 
                              gap: '3px', 
                              marginTop: '2px',
                              float: 'right',
                              marginLeft: '10px'
                            }}>
                              {message.isEdited && (
                                <span style={{ fontSize: '11px', color: '#667781', marginRight: '3px' }}>
                                  edited
                                </span>
                              )}
                              <span style={{ fontSize: '11px', color: '#667781' }}>
                                {formatTime(message.timestamp)}
                              </span>
                              {isOwn && (
                                <span style={{ 
                                  fontSize: '16px', 
                                  lineHeight: 1,
                                  marginLeft: '2px',
                                  color: message.deliveryStatus === 'read' ? '#53bdeb' : '#8696a0'
                                }}>
                                  {!message.deliveryStatus || message.deliveryStatus === 'sent' ? '✓' : '✓✓'}
                                </span>
                              )}
                            </div>
                            <div style={{ clear: 'both' }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-[#f0f0f0] px-[8%] py-2.5 border-t border-[#d1d7db]">
        <div className="flex gap-2.5 max-w-[900px] mx-auto items-end">
          <Input value={newMessage} onChange={handleTyping}
            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}}
            placeholder="Type a message" disabled={isSending}
            className="flex-1 rounded-[21px] border-none bg-white px-3 py-2 text-[14.2px] min-h-[42px]" />
          <button onClick={handleSendMessage} disabled={!newMessage.trim() || isSending}
            className={`w-[42px] h-[42px] rounded-full flex items-center justify-center flex-shrink-0 ${
              newMessage.trim() ? 'bg-[#25d366] hover:bg-[#20bd5f]' : 'bg-[#b3b3b3]'} text-white`}>
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <CallInterface isOpen={isCallModalOpen} onClose={() => setIsCallModalOpen(false)}
        callState={callState} callConfig={callConfig} recipientInfo={recipientInfo} />
    </div>
  );
}