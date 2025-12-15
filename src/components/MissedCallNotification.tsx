import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  PhoneMissed, 
  PhoneCall, 
  MessageCircle, 
  MoreHorizontal,
  X,
  Clock,
  User
} from 'lucide-react';
import { apiClient } from '@/integrations/api/client';

interface MissedCall {
  id: string;
  callerId: string;
  callerEmail: string;
  timestamp: string;
  callType: 'voice' | 'video';
  reason?: string;
}

interface MissedCallNotificationProps {
  onCallBack?: (userId: string) => void;
  onMessage?: (userId: string) => void;
}

export default function MissedCallNotification({ 
  onCallBack, 
  onMessage 
}: MissedCallNotificationProps) {
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Fetch missed calls analytics
  const fetchMissedCalls = async () => {
    try {
      setLoading(true);
      const response = await apiClient.request('/calls/analytics/missed?period=7d');
      
      if (response.success) {
        const calls = response.data.missedCalls.map((call: any) => ({
          id: `${call.callerId}-${call.lastMissedCall}`,
          callerId: call.callerId,
          callerEmail: call.callerEmail,
          timestamp: call.lastMissedCall,
          callType: call.callTypes.includes('video') ? 'video' : 'voice',
          reason: 'no-answer'
        }));
        
        setMissedCalls(calls);
      }
    } catch (error) {
      console.error('Failed to fetch missed calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissedCalls();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleCallBack = (callerId: string) => {
    if (onCallBack) {
      onCallBack(callerId);
    }
  };

  const handleMessage = (callerId: string) => {
    if (onMessage) {
      onMessage(callerId);
    }
  };

  const markAsRead = async (callId: string) => {
    // In a real implementation, you might want to mark the call as read
    setMissedCalls(calls => calls.filter(call => call.id !== callId));
  };

  const clearAll = async () => {
    // Clear all missed calls
    setMissedCalls([]);
  };

  const displayCalls = showAll ? missedCalls : missedCalls.slice(0, 3);
  const hasMore = missedCalls.length > 3;

  if (loading) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-orange-700">Loading missed calls...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (missedCalls.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <PhoneMissed className="w-5 h-5" />
            Missed Calls ({missedCalls.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {missedCalls.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-orange-600 hover:text-orange-800"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={fetchMissedCalls}>
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearAll}>
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {displayCalls.map((call) => (
            <div 
              key={call.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
            >
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-orange-100 text-orange-700">
                    {call.callerEmail.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {call.callerEmail}
                    </p>
                    <Badge 
                      variant="outline" 
                      className="text-xs capitalize border-orange-200 text-orange-700"
                    >
                      {call.callType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      {formatTimestamp(call.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCallBack(call.callerId)}
                  className="border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <PhoneCall className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMessage(call.callerId)}
                  className="border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCallBack(call.callerId)}>
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Call Back
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMessage(call.callerId)}>
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Send Message
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => markAsRead(call.id)}
                      className="text-orange-600"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Mark as Read
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          
          {hasMore && (
            <Button
              variant="ghost"
              onClick={() => setShowAll(!showAll)}
              className="w-full text-orange-700 hover:bg-orange-100"
            >
              {showAll ? 'Show Less' : `Show ${missedCalls.length - 3} More`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}