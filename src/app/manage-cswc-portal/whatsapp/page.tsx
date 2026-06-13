'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import styles from './whatsapp.module.css';
import { Button } from '@/components/ui/Button';
import { MessageSquare, RefreshCw, LogOut } from 'lucide-react';

export default function WhatsAppSetup() {
  const [status, setStatus] = useState<string>('CONNECTING...');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to custom Node server socket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('whatsapp-status', async (data: { status: string, qr?: string }) => {
      setStatus(data.status);
      
      if (data.status === 'QR_READY' && data.qr) {
        try {
          const url = await QRCode.toDataURL(data.qr);
          setQrImageUrl(url);
        } catch (err) {
          console.error('Failed to generate QR Code', err);
        }
      } else {
        setQrImageUrl('');
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleLogout = () => {
    if (socket) {
      setStatus('DISCONNECTING...');
      socket.emit('logout-whatsapp');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>WhatsApp Connection</h1>
        <p className={styles.subtitle}>Link your office WhatsApp number to send automated reminders</p>
      </div>

      <div className={styles.card}>
        <div className={`
          ${styles.statusIndicator} 
          ${status === 'CONNECTED' ? styles.statusConnected : ''}
          ${status === 'DISCONNECTED' || status === 'CONNECTING...' ? styles.statusLoading : ''}
          ${status === 'QR_READY' ? styles.statusDisconnected : ''}
        `}>
          <MessageSquare size={18} />
          {status === 'CONNECTED' ? 'WhatsApp Connected' : 
           status === 'QR_READY' ? 'Waiting for Scan' : 
           status === 'DISCONNECTING...' ? 'Disconnecting...' : 'Connecting to Server...'}
        </div>

        {status === 'CONNECTED' && (
          <div>
            <p style={{ marginBottom: '2rem', color: 'var(--color-gray-700)' }}>
              Your WhatsApp account is successfully linked. You can now use the Reminders dashboard to send bulk messages.
            </p>
            <Button onClick={handleLogout} variant="outline" style={{ borderColor: 'red', color: 'red' }}>
              <LogOut size={18} style={{ marginRight: '8px' }} />
              Disconnect WhatsApp
            </Button>
          </div>
        )}

        {status === 'QR_READY' && qrImageUrl && (
          <div>
            <div className={styles.qrContainer}>
              <img src={qrImageUrl} alt="WhatsApp QR Code" width={256} height={256} />
            </div>
            
            <div className={styles.instructions}>
              <h3>How to link your account:</h3>
              <ol>
                <li>Open WhatsApp on your office phone</li>
                <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                <li>Tap on <strong>Link a Device</strong></li>
                <li>Point your phone to this screen to capture the QR code</li>
              </ol>
            </div>
          </div>
        )}

        {(status === 'DISCONNECTED' || status === 'CONNECTING...') && (
          <div style={{ padding: '3rem 0', color: 'var(--color-gray-500)' }}>
            <RefreshCw size={48} className={styles.spin} style={{ margin: '0 auto 1rem auto', display: 'block', animation: 'spin 2s linear infinite' }} />
            <p>Waiting for WhatsApp Client to start...</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>This may take a few moments if the server just started.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
