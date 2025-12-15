import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  Phone, 
  PhoneCall, 
  PhoneMissed,
  Clock,
  Users,
  Star,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { apiClient } from '@/integrations/api/client';

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

interface CallSummaryReportProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CallSummaryReport({ isOpen, onClose }: CallSummaryReportProps) {
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedFormat, setSelectedFormat] = useState('pdf');

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen, selectedPeriod]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.request(`/calls/analytics/summary?period=${selectedPeriod}`);
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getSuccessRate = () => {
    if (!analytics) return 0;
    return Math.round((analytics.stats.completedCalls / analytics.stats.totalCalls) * 100);
  };

  const getMissedRate = () => {
    if (!analytics) return 0;
    return Math.round((analytics.stats.missedCalls / analytics.stats.totalCalls) * 100);
  };

  const generateReport = async () => {
    if (!analytics) return;

    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      if (selectedFormat === 'txt') {
        content = generateTextReport(analytics, selectedPeriod);
        filename = `call-summary-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
      } else if (selectedFormat === 'json') {
        content = JSON.stringify(analytics, null, 2);
        filename = `call-summary-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const generateTextReport = (data: CallAnalytics, period: string) => {
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    return `
CALL SUMMARY REPORT
===================

Period: ${period}
Date Range: ${formatDate(data.dateRange.start)} to ${formatDate(data.dateRange.end)}
Generated: ${new Date().toLocaleString()}

OVERVIEW
--------
Total Calls: ${data.stats.totalCalls}
Completed Calls: ${data.stats.completedCalls}
Missed Calls: ${data.stats.missedCalls}
Success Rate: ${getSuccessRate()}%
Missed Call Rate: ${getMissedRate()}%

CALL TYPES
----------
Voice Calls: ${data.stats.voiceCalls}
Video Calls: ${data.stats.videoCalls}

CALL DIRECTION
--------------
Outgoing Calls: ${data.stats.outgoingCalls}
Incoming Calls: ${data.stats.incomingCalls}

DURATION STATISTICS
------------------
Total Duration: ${formatDuration(data.stats.totalDuration)}
Average Call Duration: ${data.stats.totalCalls > 0 ? formatDuration(Math.round(data.stats.totalDuration / data.stats.completedCalls)) : '0s'}

CALL QUALITY
------------
Average Audio Quality: ${data.qualityStats.avgAudioQuality.toFixed(1)}/5
Average Video Quality: ${data.qualityStats.avgVideoQuality.toFixed(1)}/5
Average Connection Stability: ${data.qualityStats.avgConnectionStability.toFixed(1)}/5
Calls with Quality Data: ${data.qualityStats.totalQualityCalls}

TOP CONTACTS
------------
${data.topContacts.slice(0, 10).map((contact, index) => 
  `${index + 1}. ${contact.email} - ${contact.callCount} calls, ${formatDuration(contact.totalDuration)}`
).join('\n')}

DAILY CALL VOLUME
-----------------
${data.dailyVolume.slice(-7).map(day => 
  `${day._id}: ${day.count} calls, ${formatDuration(day.totalDuration)}`
).join('\n')}

NOTES
-----
This report shows your call activity and quality metrics for the specified period.
Data is based on logged calls in the Kenya Connect application.
    `.trim();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Call Summary Report
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : analytics ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Calls</p>
                          <p className="text-2xl font-bold">{analytics.stats.totalCalls}</p>
                        </div>
                        <Phone className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Success Rate</p>
                          <p className="text-2xl font-bold text-green-600">{getSuccessRate()}%</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Missed Calls</p>
                          <p className="text-2xl font-bold text-red-600">{analytics.stats.missedCalls}</p>
                        </div>
                        <PhoneMissed className="w-8 h-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Duration</p>
                          <p className="text-2xl font-bold">
                            {Math.floor(analytics.stats.totalDuration / 60)}m
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Call Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Voice Calls</span>
                        <Badge variant="outline">{analytics.stats.voiceCalls}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Video Calls</span>
                        <Badge variant="outline">{analytics.stats.videoCalls}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Outgoing</span>
                        <Badge variant="outline">{analytics.stats.outgoingCalls}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Incoming</span>
                        <Badge variant="outline">{analytics.stats.incomingCalls}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Average Duration</span>
                        <Badge variant="outline">
                          {analytics.stats.completedCalls > 0 
                            ? formatDuration(Math.round(analytics.stats.totalDuration / analytics.stats.completedCalls))
                            : '0s'
                          }
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Completion Rate</span>
                        <Badge variant="outline">{getSuccessRate()}%</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rejection Rate</span>
                        <Badge variant="outline">
                          {analytics.stats.totalCalls > 0 
                            ? Math.round((analytics.stats.rejectedCalls / analytics.stats.totalCalls) * 100)
                            : 0
                          }%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Call Quality Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-2">
                          {analytics.qualityStats.avgAudioQuality.toFixed(1)}/5
                        </div>
                        <p className="text-sm text-muted-foreground">Average Audio Quality</p>
                        <div className="flex justify-center mt-2">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(analytics.qualityStats.avgAudioQuality)
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600 mb-2">
                          {analytics.qualityStats.avgVideoQuality.toFixed(1)}/5
                        </div>
                        <p className="text-sm text-muted-foreground">Average Video Quality</p>
                        <div className="flex justify-center mt-2">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(analytics.qualityStats.avgVideoQuality)
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          {analytics.qualityStats.avgConnectionStability.toFixed(1)}/5
                        </div>
                        <p className="text-sm text-muted-foreground">Connection Stability</p>
                        <div className="flex justify-center mt-2">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(analytics.qualityStats.avgConnectionStability)
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.topContacts.slice(0, 10).map((contact, index) => (
                        <div key={contact.userId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium">{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{contact.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Last call: {new Date(contact.lastCall).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{contact.callCount} calls</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDuration(contact.totalDuration)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Call Volume (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.dailyVolume.slice(-7).map((day) => (
                        <div key={day._id} className="flex items-center justify-between">
                          <span className="text-sm">{new Date(day._id).toLocaleDateString()}</span>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline">{day.count} calls</Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatDuration(day.totalDuration)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No data available for the selected period</p>
            </div>
          )}

          {analytics && (
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <div className="flex items-center gap-2">
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="txt">Text Report</SelectItem>
                    <SelectItem value="json">JSON Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={generateReport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}