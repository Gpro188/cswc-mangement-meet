'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { collection, getDocs } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Send, AlertTriangle } from 'lucide-react';
import styles from './reminders.module.css';

export default function RemindersPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string>('CONNECTING...');
  const [centers, setCenters] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [participantsList, setParticipantsList] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [sendingState, setSendingState] = useState<{
    status: 'IDLE' | 'STARTED' | 'SENDING' | 'COMPLETED' | 'ERROR';
    total: number;
    sent: number;
    current?: string;
    log: string;
  }>({ status: 'IDLE', total: 0, sent: 0, log: '' });

  useEffect(() => {
    // Connect socket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('whatsapp-status', (data) => {
      setWhatsappStatus(data.status);
    });

    newSocket.on('reminder-progress', (data) => {
      setSendingState(prev => ({
        ...prev,
        status: data.status,
        total: data.total,
        sent: data.sent,
        current: data.current,
        log: data.current ? prev.log + `\nSent to: ${data.current}` : prev.log
      }));
    });

    newSocket.on('reminder-error', (msg) => {
      setSendingState(prev => ({
        ...prev,
        log: prev.log + `\nERROR: ${msg}`
      }));
    });

    fetchData();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    const [centersSnap, zonesSnap, regsSnap] = await Promise.all([
      getDocs(collection(db, 'meetingCenters')),
      getDocs(collection(db, 'zones')),
      getDocs(collection(db, 'registrations'))
    ]);

    setCenters(centersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setZones(zonesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setRegistrations(regsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (!selectedCenter) {
      setParticipantsList([]);
      setMessageTemplate('');
      setPosterUrl('');
      return;
    }

    const center = centers.find(c => c.id === selectedCenter);
    if (!center) return;

    // Build default message
    const defaultMsg = `Dear [Name],\n\nThis is a reminder from CSWC. The Management Meet for your center is scheduled for ${center.date || 'TBD'} at ${center.time || 'TBD'}${center.timeTo ? ` - ${center.timeTo}` : ''}.\n\nVenue: ${center.venue || center.title}${center.locationUrl ? `\nLocation Map: ${center.locationUrl}` : ''}\n\nWe hope you will participate in the meeting.`;
    setMessageTemplate(defaultMsg);
    setPosterUrl(center.posterUrl || '');

    // Get participants
    const assignedZoneNames = center.assignedZones?.map((zId: string) => zones.find(z => z.id === zId)?.name).filter(Boolean) || [];
    const centerRegs = registrations.filter(r => r.centerId === center.id || assignedZoneNames.includes(r.zone));
    
    let allParticipants: any[] = [];
    centerRegs.forEach(reg => {
      if (reg.participants) {
        // Only include those with phone numbers
        allParticipants = [...allParticipants, ...reg.participants.filter((p: any) => p.phone && p.phone.trim() !== '')];
      }
    });

    setParticipantsList(allParticipants);

  }, [selectedCenter, centers, zones, registrations]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1048576) {
      toast.error('File size must be under 1MB. Please compress it or use a URL.');
      return;
    }

    setUploadingImage(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPosterUrl(base64String);
      setUploadingImage(false);
      toast.success('Image attached successfully');
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setUploadingImage(false);
    };
    
    reader.readAsDataURL(file);
  };

  const handleStartSending = () => {
    if (!socket || whatsappStatus !== 'CONNECTED') {
      alert('WhatsApp is not connected!');
      return;
    }
    if (participantsList.length === 0) {
      alert('No participants found with phone numbers.');
      return;
    }
    if (!confirm(`Are you sure you want to send ${participantsList.length} messages? This will take approximately ${(participantsList.length * 20 / 60).toFixed(1)} minutes due to the anti-spam delay.`)) {
      return;
    }

    setSendingState({ status: 'STARTED', total: participantsList.length, sent: 0, log: 'Starting queue...' });
    
    socket.emit('start-reminders', {
      participants: participantsList,
      messageTemplate,
      posterUrl
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Send Reminders</h1>
        <p className={styles.subtitle}>Send automated WhatsApp reminders to registered participants</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.mainContent}>
          <div className={styles.card}>
            <h2>Configure Message</h2>
            
            <div className={styles.formGroup}>
              <label>Select Meeting Center</label>
              <select 
                className={styles.select}
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                disabled={sendingState.status === 'STARTED' || sendingState.status === 'SENDING'}
              >
                <option value="">-- Choose Center --</option>
                {centers.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {selectedCenter && (
              <>
                <div className={styles.infoBox}>
                  <p><strong>Total Recipients:</strong> {participantsList.length} (participants with phone numbers)</p>
                  <p><strong>Estimated Sending Time:</strong> ~{(participantsList.length * 20 / 60).toFixed(1)} minutes</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Poster Image (Upload or enter URL)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="url"
                      className={styles.input}
                      style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-300)' }}
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      disabled={sendingState.status === 'STARTED' || sendingState.status === 'SENDING'}
                      placeholder="Direct link to image"
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', whiteSpace: 'nowrap' }}>OR</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      disabled={uploadingImage || sendingState.status === 'STARTED' || sendingState.status === 'SENDING'}
                      style={{ flex: 1, padding: '0.75rem' }}
                    />
                    {uploadingImage && <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Uploading...</span>}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Message Template</label>
                  <textarea 
                    className={styles.textarea}
                    rows={10}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    disabled={sendingState.status === 'STARTED' || sendingState.status === 'SENDING'}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>
                    Available variables: [Name], [Designation]
                  </p>
                </div>

                {whatsappStatus === 'CONNECTED' ? (
                  <Button 
                    onClick={handleStartSending} 
                    disabled={sendingState.status === 'STARTED' || sendingState.status === 'SENDING' || participantsList.length === 0}
                  >
                    <Send size={18} style={{ marginRight: '8px' }} />
                    {sendingState.status === 'SENDING' ? 'Sending in Progress...' : 'Start Sending Messages'}
                  </Button>
                ) : (
                  <div style={{ color: 'red', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                    <AlertTriangle size={18} /> Please connect WhatsApp in the Setup tab first.
                  </div>
                )}
              </>
            )}
          </div>

          {(sendingState.status !== 'IDLE') && (
            <div className={styles.progressContainer}>
              <div className={styles.progressHeader}>
                <span>Sending Progress</span>
                <span>{sendingState.sent} / {sendingState.total}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${(sendingState.sent / sendingState.total) * 100}%` }}
                />
              </div>
              <div className={styles.progressLog}>
                {sendingState.log}
                {sendingState.status === 'SENDING' && '\n...waiting 15-30s before next message...'}
                {sendingState.status === 'COMPLETED' && '\n\n✅ All messages sent successfully!'}
              </div>
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.warningBox}>
            <h3>Anti-Spam Delay Active</h3>
            <p style={{ marginBottom: '1rem' }}>
              To protect your office WhatsApp number from being banned by Meta, this system deliberately waits between 15 to 30 seconds before sending the next message.
            </p>
            <p>
              Please leave this browser tab open while messages are sending. You will see live progress below.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
