import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Video,
  Volume2,
  MoreHorizontal,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';

interface CallLog {
  id: string;
  chatId: string;
  participantId: string;
  participantEmail: string;
  type: 'voice' | 'video';
  direction: 'outgoing' | 'incoming';
  status: 'completed' | 'missed' | 'rejected' | 'failed' | 'busy';
  timestamp: string;
  duration?: number;
  callId?: string;
  reason?: string;
  quality?: {
    audioQuality?: number;
    videoQuality?: number;
    connectionStability?: number;
  };
}

interface CallAnalytics {
  period: string;
  dateRange: { start: string; end: string };
  stats: {
    totalCalls: number;
    completedCalls: number;
    missedCalls: number;
    rejectedCalls: number;
    failedCalls: number;
    totalDuration: number;
    voiceCalls: number;
    videoCalls: number;
    outgoingCalls: number;
    incomingCalls: number;
  };
  dailyVolume: Array<{
    _id: string;
    count: number;
    totalDuration: number;
  }>;
  topContacts: Array<{
    userId: string;
    email: string;
    callCount: number;
    totalDuration: number;
    completedCalls: number;
    lastCall: string;
  }>;
  qualityStats: {
    avgAudioQuality: number;
    avgVideoQuality: number;
    avgConnectionStability: number;
    totalQualityCalls: number;
  };
}

export default function Call() {
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('30d');
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch call logs
  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getCallLogs();
      if (response.success) {
        setCallLogs(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch call logs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.request(`/calls/analytics/summary?period=${periodFilter}`);
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  useEffect(() => {
    fetchCallLogs();
    fetchAnalytics();
  }, [periodFilter]);

  // Filter and sort call logs
  const filteredAndSortedLogs = callLogs
    .filter((log: CallLog) => {
      // Search filter
      if (searchTerm && !log.participantEmail.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && log.type !== typeFilter) {
        return false;
      }

      // Direction filter
      if (directionFilter !== 'all' && log.direction !== directionFilter) {
        return false;
      }

      return true;
    })
    .sort((a: CallLog, b: CallLog) => {
      const aValue = a[sortBy as keyof CallLog];
      const bValue = b[sortBy as keyof CallLog];

      if (aValue === undefined || bValue === undefined) return 0;

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <PhoneCall className="w-4 h-4 text-green-500" />;
      case 'missed':
        return <PhoneMissed className="w-4 h-4 text-red-500" />;
      case 'rejected':
        return <PhoneOff className="w-4 h-4 text-gray-500" />;
      case 'failed':
        return <PhoneOff className="w-4 h-4 text-red-600" />;
      case 'busy':
        return <PhoneOff className="w-4 h-4 text-orange-500" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'outgoing'
      ? <PhoneOutgoing className="w-4 h-4 text-blue-500" />
      : <PhoneIncoming className="w-4 h-4 text-green-500" />;
  };

  const getTypeIcon = (type: string) => {
    return type === 'video'
      ? <Video className="w-4 h-4 text-purple-500" />
      : <Volume2 className="w-4 h-4 text-blue-500" />;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getQualityStars = (quality?: number) => {
    if (!quality) return '-';
    return '★'.repeat(quality) + '☆'.repeat(5 - quality);
  };

  // Delete call log
  const deleteCallLog = async (callId: string) => {
    try {
      await apiClient.request(`/calls/${callId}`, { method: 'DELETE' });
      setCallLogs((logs) => logs.filter((log) => log.id !== callId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete call log');
    }
  };

  // Export call logs
  const exportCallLogs = () => {
    const csvContent = [
      ['Date', 'Contact', 'Type', 'Direction', 'Status', 'Duration', 'Quality'].join(','),
      ...filteredAndSortedLogs.map((log: CallLog) => [
        formatTimestamp(log.timestamp),
        log.participantEmail,
        log.type,
        log.direction,
        log.status,
        formatDuration(log.duration),
        log.quality ? `${log.quality.audioQuality}/5` : '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && callLogs.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-muted-foreground">
            View and manage your call logs with detailed analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchCallLogs} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportCallLogs} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.stats.completedCalls} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor(analytics.stats.totalDuration / 60)}m
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDuration(analytics.stats.totalDuration)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Missed Calls</CardTitle>
              <PhoneMissed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.stats.missedCalls}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.stats.totalCalls > 0 ? ((analytics.stats.missedCalls / analytics.stats.totalCalls) * 100).toFixed(1) : 0}% rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Quality</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.qualityStats.avgAudioQuality.toFixed(1)}/5
              </div>
              <p className="text-xs text-muted-foreground">
                Audio quality rating
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>

            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timestamp-desc">Newest first</SelectItem>
                <SelectItem value="timestamp-asc">Oldest first</SelectItem>
                <SelectItem value="duration-desc">Longest duration</SelectItem>
                <SelectItem value="duration-asc">Shortest duration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Call Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Call Logs ({filteredAndSortedLogs.length} of {callLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedLogs.map((log: CallLog) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
                          {log.participantEmail.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{log.participantEmail}</div>
                        <div className="text-sm text-muted-foreground">
                          {log.reason && `Reason: ${log.reason}`}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(log.type)}
                      <Badge variant="outline" className="capitalize">
                        {log.type}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getDirectionIcon(log.direction)}
                      <span className="capitalize">{log.direction}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <Badge
                        variant={
                          log.status === 'completed' ? 'default' :
                          log.status === 'missed' ? 'destructive' :
                          'secondary'
                        }
                        className="capitalize"
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {formatDuration(log.duration)}
                    </div>
                  </TableCell>

                  <TableCell>
                    {log.quality ? (
                      <div className="text-sm">
                        <div>Audio: {getQualityStars(log.quality.audioQuality)}</div>
                        {log.type === 'video' && (
                          <div>Video: {getQualityStars(log.quality.videoQuality)}</div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => deleteCallLog(log.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredAndSortedLogs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No call logs found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Contacts */}
      {analytics && analytics.topContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topContacts.slice(0, 5).map((contact) => (
                <div key={contact.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {contact.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{contact.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Last call: {formatTimestamp(contact.lastCall)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{contact.callCount} calls</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(contact.totalDuration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}