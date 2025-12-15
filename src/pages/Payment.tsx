import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Heart, ArrowLeft, Loader2, Phone, Shield, CheckCircle, XCircle } from 'lucide-react';
import { z } from 'zod';

const phoneSchema = z.string()
  .regex(/^(0|254|\+254)?[17]\d{8}$/, 'Please enter a valid Kenyan phone number');

export default function Payment() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const plan = (location.state as { plan?: string })?.plan || 'weekly';
  const amount = plan === 'weekly' ? 200 : 400;
  const period = plan === 'weekly' ? '7 days' : '30 days';
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Poll for payment status
  useEffect(() => {
    let interval;
    
    if (polling && checkoutRequestId) {
      interval = setInterval(async () => {
        try {
          const response = await apiClient.checkPaymentStatus(checkoutRequestId);
          
          if (response.success) {
            setPaymentStatus('success');
            setPolling(false);
            toast({
              title: 'Payment Successful!',
              description: 'Your subscription is now active.',
            });
            setTimeout(() => navigate('/subscription'), 2000);
          } else if (response.paymentStatus === 'cancelled') {
            setPaymentStatus('failed');
            setPolling(false);
            toast({
              variant: 'destructive',
              title: 'Payment Cancelled',
              description: 'You cancelled the payment request.',
            });
          }
        } catch (error) {
          console.error('Status check error:', error);
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, checkoutRequestId, navigate, toast]);

  const formatPhoneNumber = (phone: string) => {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle different formats and convert to 254 format
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      phoneSchema.parse(phoneNumber);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }
    
    setIsProcessing(true);
    
    try {
      // Format phone number
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const paymentData = {
        amount,
        phoneNumber: formattedPhone,
        planType: plan
      };

      const response = await apiClient.createPayment(paymentData);
      
      if (response.success) {
        setCheckoutRequestId(response.data.checkoutRequestId);
        setPaymentStatus('pending');
        setPolling(true);
        
        toast({
          title: 'STK Push Sent',
          description: 'Please check your phone and complete the payment.',
        });
      } else {
        setPaymentStatus('failed');
        toast({
          variant: 'destructive',
          title: 'Payment Failed',
          description: response.message || 'Failed to initiate payment',
        });
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-md mx-auto">
        <Link to="/subscription" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Complete Payment</h1>
          <p className="text-muted-foreground mt-2">Pay with M-Pesa</p>
        </div>

        {/* Order Summary */}
        <Card className="mb-6 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="capitalize">{plan} Plan</span>
              <span className="font-semibold">KES {amount}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground mt-1">
              <span>Duration</span>
              <span>{period}</span>
            </div>
            <div className="border-t border-border mt-4 pt-4">
              <div className="flex justify-between items-center font-semibold">
                <span>Total</span>
                <span className="text-xl">KES {amount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>M-Pesa Payment</CardTitle>
            <CardDescription>
              Enter your M-Pesa registered phone number
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentStatus === 'idle' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="0712345678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <p className="text-xs text-muted-foreground">
                    You'll receive an STK push on this number
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>Pay KES {amount}</>
                  )}
                </Button>
              </form>
            )}

            {paymentStatus === 'pending' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Payment Pending</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please check your phone and complete the M-Pesa payment.
                </p>
                <p className="text-xs text-muted-foreground">
                  We'll automatically update your subscription once payment is confirmed.
                </p>
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
                <p className="text-sm text-muted-foreground">
                  Your subscription is now active.
                </p>
              </div>
            )}

            {paymentStatus === 'failed' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Payment Failed</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The payment was not completed. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPaymentStatus('idle');
                    setCheckoutRequestId(null);
                    setPolling(false);
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Secured by Safaricom M-Pesa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
