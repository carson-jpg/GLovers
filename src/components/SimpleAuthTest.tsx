import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { simpleApiClient } from '../integrations/simpleApiClient';

const SimpleAuthTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready to test');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logMessage]);
    console.log(logMessage);
  };

  const testBackend = async () => {
    setStatus('Testing backend connectivity...');
    addLog('Starting backend connectivity test');
    
    try {
      const response = await fetch('https://glovers.onrender.com/api/health', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      addLog(`Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        addLog(`Success: ${JSON.stringify(data)}`);
        setStatus('✅ Backend is working!');
      } else {
        addLog(`Error: ${response.status}`);
        setStatus('❌ Backend returned error');
      }
    } catch (error) {
      addLog(`Network error: ${error}`);
      setStatus('❌ Network connection failed');
    }
  };

  const testSimpleAuth = async () => {
    setStatus('Testing simple authentication...');
    addLog('Starting simple auth test');
    
    try {
      // Test signup with dummy data
      const response = await simpleApiClient.signUp('test@example.com', 'password123');
      addLog(`Signup response: ${JSON.stringify(response)}`);
      
      if (response.success) {
        setStatus('✅ Authentication test passed!');
      } else {
        setStatus('❌ Authentication test failed');
      }
    } catch (error) {
      addLog(`Auth error: ${error}`);
      setStatus('❌ Authentication failed');
    }
  };

  const testSimpleSignIn = async () => {
    setStatus('Testing simple sign in...');
    addLog('Starting simple sign in test');
    
    try {
      // Test signin with dummy data
      const response = await simpleApiClient.signIn('test@example.com', 'password123');
      addLog(`Signin response: ${JSON.stringify(response)}`);
      
      if (response.success) {
        setStatus('✅ Sign in test passed!');
      } else {
        setStatus('❌ Sign in test failed');
      }
    } catch (error) {
      addLog(`Signin error: ${error}`);
      setStatus('❌ Sign in failed');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Mobile App Test</h1>
      
      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '15px', 
        margin: '10px 0',
        borderRadius: '5px'
      }}>
        <strong>Status:</strong> {status}
      </div>
      
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={testBackend}
          style={{
            padding: '10px 20px',
            margin: '5px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔗 Test Backend Connection
        </button>
        
        <button
          onClick={testSimpleAuth}
          style={{
            padding: '10px 20px',
            margin: '5px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔐 Test Sign Up
        </button>
        
        <button
          onClick={testSimpleSignIn}
          style={{
            padding: '10px 20px',
            margin: '5px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔑 Test Sign In
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: '#000', 
        color: '#0f0', 
        padding: '15px', 
        margin: '10px 0',
        borderRadius: '5px',
        fontFamily: 'monospace',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        <h3>📋 Debug Logs:</h3>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
      
      <div style={{ 
        backgroundColor: '#e9ecef', 
        padding: '15px', 
        margin: '10px 0',
        borderRadius: '5px'
      }}>
        <h3>📱 Device Info:</h3>
        <p><strong>Platform:</strong> {Capacitor.getPlatform()}</p>
        <p><strong>Is Native:</strong> {Capacitor.isNativePlatform() ? 'Yes' : 'No'}</p>
        <p><strong>User Agent:</strong> {navigator.userAgent}</p>
      </div>
    </div>
  );
};

export default SimpleAuthTest;