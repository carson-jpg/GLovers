import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Star,
  Volume2,
  Video,
  Wifi,
  Send,
  X
} from 'lucide-react';
import { apiClient } from '@/integrations/api/client';

interface CallQualityProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  callType: 'voice' | 'video';
}

interface QualityMetrics {
  audioQuality: number;
  videoQuality?: number;
  connectionStability: number;
}

export default function CallQualityFeedback({ 
  isOpen, 
  onClose, 
  callId, 
  callType 
}: CallQualityProps) {
  const [metrics, setMetrics] = useState<QualityMetrics>({
    audioQuality: 3,
    videoQuality: callType === 'video' ? 3 : undefined,
    connectionStability: 3
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      const qualityData: any = {
        callId,
        audioQuality: metrics.audioQuality,
        connectionStability: metrics.connectionStability
      };

      if (callType === 'video' && metrics.videoQuality) {
        qualityData.videoQuality = metrics.videoQuality;
      }

      await apiClient.request('/calls/quality', {
        method: 'POST',
        body: JSON.stringify(qualityData)
      });

      setSubmitted(true);
      
      // Auto-close after a delay
      setTimeout(() => {
        onClose();
        setSubmitted(false);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to submit call quality:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getQualityLabel = (value: number) => {
    if (value <= 1) return 'Poor';
    if (value <= 2) return 'Fair';
    if (value <= 3) return 'Good';
    if (value <= 4) return 'Very Good';
    return 'Excellent';
  };

  const getQualityColor = (value: number) => {
    if (value <= 2) return 'destructive';
    if (value <= 3) return 'secondary';
    return 'default';
  };

  const QualitySlider = ({ 
    label, 
    icon: Icon, 
    value, 
    onChange, 
    color 
  }: {
    label: string;
    icon: any;
    value: number;
    onChange: (value: number) => void;
    color?: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </Label>
        <Badge variant={color as any} className="font-mono">
          {getQualityLabel(value)} ({value}/5)
        </Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        max={5}
        min={1}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Poor</span>
        <span>Fair</span>
        <span>Good</span>
        <span>Very Good</span>
        <span>Excellent</span>
      </div>
    </div>
  );

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Thank you!</h3>
            <p className="text-muted-foreground">
              Your feedback has been recorded and will help improve call quality.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Rate Call Quality
          </DialogTitle>
          <DialogDescription>
            Help us improve by rating the quality of your recent {callType} call.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <QualitySlider
            label="Audio Quality"
            icon={Volume2}
            value={metrics.audioQuality}
            onChange={(value) => setMetrics(prev => ({ ...prev, audioQuality: value }))}
            color={getQualityColor(metrics.audioQuality)}
          />

          {callType === 'video' && (
            <QualitySlider
              label="Video Quality"
              icon={Video}
              value={metrics.videoQuality || 3}
              onChange={(value) => setMetrics(prev => ({ ...prev, videoQuality: value }))}
              color={getQualityColor(metrics.videoQuality || 3)}
            />
          )}

          <QualitySlider
            label="Connection Stability"
            icon={Wifi}
            value={metrics.connectionStability}
            onChange={(value) => setMetrics(prev => ({ ...prev, connectionStability: value }))}
            color={getQualityColor(metrics.connectionStability)}
          />

          {/* Overall Rating Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">Overall Call Rating</div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(
                        callType === 'video' 
                          ? (metrics.audioQuality + (metrics.videoQuality || 3) + metrics.connectionStability) / 3
                          : (metrics.audioQuality + metrics.connectionStability) / 2
                      )
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <Badge variant="outline" className="text-xs">
                {callType === 'video' 
                  ? getQualityLabel(Math.round((metrics.audioQuality + (metrics.videoQuality || 3) + metrics.connectionStability) / 3))
                  : getQualityLabel(Math.round((metrics.audioQuality + metrics.connectionStability) / 2))
                }
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={submitting}
          >
            <X className="w-4 h-4 mr-2" />
            Skip
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}