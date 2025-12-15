import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Crown, Check, ArrowLeft, Loader2 } from 'lucide-react';

interface Subscription {
  id: string;
  planType: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function Subscription() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return;
      
      try {
        const response = await apiClient.getMySubscription();
        
        if (response.success && response.data) {
          setSubscription(response.data);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    if (user) {
      fetchSubscription();
    }
  }, [user]);

  if (loading || loadingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isActive = subscription && new Date(subscription.endDate) > new Date();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Premium Subscription</h1>
          <p className="text-muted-foreground mt-2">Unlock all features with a premium plan</p>
        </div>

        {/* Current Subscription Status */}
        {isActive && (
          <Card className="mb-8 border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">You're a Premium Member!</h3>
                  <p className="text-sm text-muted-foreground">
                    {subscription.planType === 'weekly' ? 'Weekly' : 'Monthly'} plan active until{' '}
                    {new Date(subscription.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          <PlanCard
            title="Weekly Plan"
            price="KES 200"
            period="7 days"
            features={[
              'Unlimited messaging',
              'View all profiles',
              'See who viewed you',
              'Priority support',
            ]}
            isCurrentPlan={isActive && subscription?.planType === 'weekly'}
            planType="weekly"
          />
          <PlanCard
            title="Monthly Plan"
            price="KES 400"
            period="30 days"
            features={[
              'Unlimited messaging',
              'View all profiles',
              'See who viewed you',
              'Priority support',
              'Best value - save 43%',
            ]}
            highlighted
            isCurrentPlan={isActive && subscription?.planType === 'monthly'}
            planType="monthly"
          />
        </div>

        {/* Payment Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Pay securely with M-Pesa. Instant activation after payment.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Heart className="w-4 h-4 text-primary" />
            <span>Safe and secure transactions</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  features,
  highlighted = false,
  isCurrentPlan = false,
  planType,
}: {
  title: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  isCurrentPlan?: boolean;
  planType: string;
}) {
  const navigate = useNavigate();

  return (
    <Card className={`relative ${highlighted ? 'border-primary shadow-lg' : 'border-border'}`}>
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            Best Value
          </span>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="px-4 py-1 text-xs font-medium bg-success text-success-foreground rounded-full">
            Current Plan
          </span>
        </div>
      )}
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>
          <span className="text-4xl font-bold text-foreground">{price}</span>
          <span className="text-muted-foreground"> / {period}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3">
              <Check className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={highlighted ? 'default' : 'outline'}
          disabled={isCurrentPlan}
          onClick={() => navigate('/payment', { state: { plan: planType } })}
        >
          {isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
        </Button>
      </CardContent>
    </Card>
  );
}
