import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PhoneNumberRestrictionWarningProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhoneNumberRestrictionWarning({ isOpen, onClose }: PhoneNumberRestrictionWarningProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    navigate('/subscription');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <Crown className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            Subscription Required
          </CardTitle>
          <CardDescription>
            Phone number sharing is a premium feature
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p className="mb-2">
              You need an active subscription to share phone numbers in chat messages.
            </p>
            <p className="text-sm">
              Upgrade your account to unlock this feature and connect with others more easily!
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button 
              onClick={handleUpgrade}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}