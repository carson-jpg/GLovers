import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/hooks/useCall';
import { apiClient } from '@/integrations/api/client';
import { socketService } from '@/services/socketService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  MessageCircle,
  Phone,
  Video,
  Plus,
  Users,
  Clock,
  PhoneCall,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  MoreVertical,
  Star,
  Archive,
  Trash2,
  Loader2,
  PhoneOff
} from 'lucide-react';

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
  unreadCount?: number;
}

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
}

interface CallLog {
  id: string;
  chatId: string;
  participantId: string;
  participantEmail: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'rejected' | 'missed' | 'failed';
  timestamp: string;
  duration?: number;
}

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    startCall,
    callState,
    recipientInfo,
    isCallModalOpen,
    setIsCallModalOpen
  } = useCall();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, { status: string; lastSeen?: string }>>(new Map());

  useEffect(() => {
    if (user) {
      loadChats();
      loadCallLogs();
      initializeSocketListeners();
      socketService.getConnectedUsers();
    }
  }, [user]);

  useEffect(() => {
    filterItems();
  }, [chats, callLogs, searchQuery, activeTab]);

  const initializeSocketListeners = () => {
    // Message events
    socketService.onNewMessage(handleNewMessage);
    socketService.onMessageDelivered(handleMessageDelivered);
    
    // User presence events
    socketService.onConnectedUsers(handleConnectedUsers);
    socketService.onUserStatusChanged(handleUserStatusChanged);
    socketService.onError(handleSocketError);

    return () => {
      socketService.offNewMessage(handleNewMessage);
      socketService.offMessageDelivered(handleMessageDelivered);
      socketService.offConnectedUsers(handleConnectedUsers);
      socketService.offUserStatusChanged(handleUserStatusChanged);
      socketService.offError(handleSocketError);
    };
  };

  const loadChats = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getMyChats();
      
      if (response.success) {
        // Calculate unread counts and sort by last message time
        const chatsWithUnread = response.data.map((chat: Chat) => {
          const unreadCount = chat.messages.filter((msg: Message) => 
            msg.senderId !== user?.id && 
            !msg.readBy.some(read => read.userId === user?.id)
          ).length;
          
          return { ...chat, unreadCount };
        }).sort((a: Chat, b: Chat) => 
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
        
        setChats(chatsWithUnread);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCallLogs = async () => {
    try {
      const response = await apiClient.getCallLogs();
      
      if (response.success) {
        setCallLogs(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load call logs:', error);
      // Fallback to empty array if API fails
      setCallLogs([]);
    }
  };

  const handleNewMessage = (data: { chatId: string; message: Message }) => {
    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat._id === data.chatId) {
          return {
            ...chat,
            lastMessage: data.message.content,
            lastMessageAt: data.message.timestamp,
            messages: [...chat.messages, data.message],
            unreadCount: data.message.senderId !== user?.id ? 
              (chat.unreadCount || 0) + 1 : chat.unreadCount
          };
        }
        return chat;
      });
      
      return updatedChats.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    });
  };

  const handleMessageDelivered = (data: { chatId: string; messageId: string; deliveredTo: string }) => {
    // Handle message delivery status update if needed
  };

  const handleConnectedUsers = (users: string[]) => {
    setConnectedUsers(new Set(users));
  };

  const handleUserStatusChanged = (data: { userId: string; status: string; lastSeen?: string }) => {
    setUserStatuses(prev => {
      const newStatuses = new Map(prev);
      newStatuses.set(data.userId, { status: data.status, lastSeen: data.lastSeen });
      return newStatuses;
    });
  };

  const handleSocketError = (error: { message: string }) => {
    console.error('Socket error:', error.message);
  };

  const filterItems = () => {
    const query = searchQuery.toLowerCase();
    
    // Filter chats
    const filteredChatsList = chats.filter(chat => {
      const otherParticipant = chat.participants.find(p => p._id !== user?.id);
      const matchesQuery = otherParticipant?.email.toLowerCase().includes(query) ||
                          chat.lastMessage.toLowerCase().includes(query);
      
      if (activeTab === 'unread') {
        return matchesQuery && (chat.unreadCount || 0) > 0;
      } else if (activeTab === 'starred') {
        // For starred chats (you would implement star functionality)
        return matchesQuery; // Placeholder
      }
      
      return matchesQuery;
    });
    
    // Filter calls
    const filteredCallsList = callLogs.filter(call => {
      const matchesQuery = call.participantEmail.toLowerCase().includes(query);
      
      if (activeTab === 'calls') {
        return matchesQuery;
      } else if (activeTab === 'missed') {
        return matchesQuery && call.status === 'missed';
      }
      
      return matchesQuery;
    });
    
    setFilteredChats(filteredChatsList);
    setFilteredCalls(filteredCallsList);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatCallTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatCallDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getUserStatus = (userId: string) => {
    if (connectedUsers.has(userId)) return 'online';
    const status = userStatuses.get(userId);
    return status?.status || 'offline';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const handleChatClick = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  const handleVoiceCall = async (chatId: string, participantId: string) => {
    try {
      await startCall(participantId, { video: false, audio: true });
    } catch (error) {
      console.error('Failed to start voice call:', error);
    }
  };

  const handleVideoCall = async (chatId: string, participantId: string) => {
    try {
      await startCall(participantId, { video: true, audio: true });
    } catch (error) {
      console.error('Failed to start video call:', error);
    }
  };

  const getCallIcon = (call: CallLog) => {
    switch (call.direction) {
      case 'incoming':
        return call.status === 'missed' ? 
          <PhoneMissed className="w-4 h-4 text-red-500" /> : 
          <PhoneIncoming className="w-4 h-4 text-green-500" />;
      case 'outgoing':
        return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
      default:
        return <Phone className="w-4 h-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Inbox</h1>
              <p className="text-muted-foreground">Messages and calls</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search chats and calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
            <TabsTrigger value="missed">Missed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {/* Recent Chats */}
            {filteredChats.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Chats ({filteredChats.length})
                </h3>
                {filteredChats.map((chat) => {
                  const otherParticipant = chat.participants.find(p => p._id !== user?.id);
                  const isOnline = getUserStatus(otherParticipant?._id || '') === 'online';
                  
                  return (
                    <Card key={chat._id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <CardContent className="p-4" onClick={() => handleChatClick(chat._id)}>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src="/placeholder.svg" />
                              <AvatarFallback>
                                {otherParticipant?.email?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            {isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold truncate">
                                {otherParticipant?.email || 'Unknown User'}
                              </h4>
                              <div className="flex items-center gap-2">
                                {chat.unreadCount && chat.unreadCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {chat.unreadCount}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(chat.lastMessageAt)}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.lastMessage}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoiceCall(chat._id, otherParticipant?._id || '');
                              }}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVideoCall(chat._id, otherParticipant?._id || '');
                              }}
                            >
                              <Video className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Recent Calls */}
            {filteredCalls.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <PhoneCall className="w-5 h-5" />
                  Recent Calls ({filteredCalls.length})
                </h3>
                {filteredCalls.slice(0, 5).map((call) => (
                  <Card key={call.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback>
                            {call.participantEmail.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">
                              {call.participantEmail}
                            </h4>
                            <div className="flex items-center gap-2">
                              {call.type === 'video' ? (
                                <Video className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Phone className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatCallTime(call.timestamp)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCallIcon(call)}
                            <span className="text-sm text-muted-foreground">
                              {call.direction === 'incoming' && call.status === 'missed' ? 'Missed call' :
                               call.direction === 'incoming' ? 'Incoming call' :
                               call.direction === 'outgoing' ? 'Outgoing call' : 'Call'}
                              {call.duration && ` • ${formatCallDuration(call.duration)}`}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleVoiceCall(call.chatId, call.participantId)}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleVideoCall(call.chatId, call.participantId)}
                          >
                            <Video className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredChats.length === 0 && filteredCalls.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start a new conversation to see it here.
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="unread">
            <div className="space-y-2">
              {filteredChats.map((chat) => {
                const otherParticipant = chat.participants.find(p => p._id !== user?.id);
                const isOnline = getUserStatus(otherParticipant?._id || '') === 'online';
                
                return (
                  <Card key={chat._id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardContent className="p-4" onClick={() => handleChatClick(chat._id)}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src="/placeholder.svg" />
                            <AvatarFallback>
                              {otherParticipant?.email?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold truncate">
                              {otherParticipant?.email || 'Unknown User'}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-xs">
                                {chat.unreadCount}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(chat.lastMessageAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {chat.lastMessage}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoiceCall(chat._id, otherParticipant?._id || '');
                            }}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVideoCall(chat._id, otherParticipant?._id || '');
                            }}
                          >
                            <Video className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {filteredChats.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No unread messages</h3>
                  <p className="text-muted-foreground">
                    You're all caught up!
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calls">
            <div className="space-y-2">
              {filteredCalls.map((call) => (
                <Card key={call.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="/placeholder.svg" />
                        <AvatarFallback>
                          {call.participantEmail.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">
                            {call.participantEmail}
                          </h4>
                          <div className="flex items-center gap-2">
                            {call.type === 'video' ? (
                              <Video className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Phone className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatCallTime(call.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getCallIcon(call)}
                          <span className="text-sm text-muted-foreground">
                            {call.direction === 'incoming' && call.status === 'missed' ? 'Missed call' :
                             call.direction === 'incoming' ? 'Incoming call' :
                             call.direction === 'outgoing' ? 'Outgoing call' : 'Call'}
                            {call.duration && ` • ${formatCallDuration(call.duration)}`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVoiceCall(call.chatId, call.participantId)}
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVideoCall(call.chatId, call.participantId)}
                        >
                          <Video className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredCalls.length === 0 && (
                <div className="text-center py-12">
                  <PhoneCall className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No call history</h3>
                  <p className="text-muted-foreground">
                    Your recent calls will appear here.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="missed">
            <div className="space-y-2">
              {filteredCalls
                .filter(call => call.status === 'missed')
                .map((call) => (
                  <Card key={call.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback>
                            {call.participantEmail.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">
                              {call.participantEmail}
                            </h4>
                            <div className="flex items-center gap-2">
                              {call.type === 'video' ? (
                                <Video className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Phone className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatCallTime(call.timestamp)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <PhoneMissed className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">
                              Missed {call.type} call
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleVoiceCall(call.chatId, call.participantId)}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleVideoCall(call.chatId, call.participantId)}
                          >
                            <Video className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              
              {filteredCalls.filter(call => call.status === 'missed').length === 0 && (
                <div className="text-center py-12">
                  <PhoneMissed className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No missed calls</h3>
                  <p className="text-muted-foreground">
                    You haven't missed any calls.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}