import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MessageLimitWarningProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessageLimitWarning({ isOpen, onClose }: MessageLimitWarningProps) {
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
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            Free Messages Used Up
          </CardTitle>
          <CardDescription>
            You've reached your free message limit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p className="mb-2">
              You can send a maximum of 5 messages for free. 
            </p>
            <p className="mb-2">
              Subscribe to continue chatting without limits!
            </p>
            <p className="text-sm">
              Plus, subscribers can share phone numbers in messages.
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Subscribe Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}