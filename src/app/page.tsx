'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './page.module.css';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Calendar, MapPin, Map } from 'lucide-react';
import toast from 'react-hot-toast';

interface MeetingCenter {
  id: string;
  title: string;
  date: string;
  time: string;
  timeTo?: string;
  venue: string;
  assignedZones: string[];
}

interface Zone {
  id: string;
  name: string;
}

export default function Home() {
  const [meetings, setMeetings] = useState<MeetingCenter[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [meetingsSnap, zonesSnap] = await Promise.all([
          getDocs(collection(db, 'meetingCenters')),
          getDocs(collection(db, 'zones'))
        ]);
        
        // Sort meetings by date if available
        const meetingsData = meetingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingCenter));
        meetingsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setMeetings(meetingsData);
        setZones(zonesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Zone)));
      } catch (error: any) {
        toast.error('Error fetching meetings: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoWrapper}>
          <img src="/logo.png" alt="CSWC Logo" className={styles.logoImage} />
        </div>
        <h1 className={styles.title}>Council of Samastha Women's Colleges</h1>
        <p className={styles.subtitle}>Management Meet 2026</p>
      </header>

      <main className={styles.main}>
        <div className={styles.registerSection}>
          <h2>Institution Registration is Open</h2>
          <p>Please register your institution members for the upcoming management meetings in your respective zones.</p>
          <Link href="/register">
            <Button size="lg">Go to Registration Portal</Button>
          </Link>
        </div>

        <div className={styles.scheduleSection}>
          <h2 className={styles.sectionTitle}>Scheduled Meetings</h2>
          
          {loading ? (
            <div className={styles.loading}>Loading schedule...</div>
          ) : meetings.length > 0 ? (
            <div className={styles.grid}>
              {meetings.map((meeting) => (
                <div key={meeting.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3>{meeting.title}</h3>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                      <Calendar className={styles.icon} size={20} />
                      <div>
                        <strong>Date & Time</strong>
                        <p>{meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date TBD'}</p>
                        <p>{meeting.time || 'Time TBD'}{meeting.timeTo ? ` - ${meeting.timeTo}` : ''}</p>
                      </div>
                    </div>
                    
                    <div className={styles.infoRow}>
                      <MapPin className={styles.icon} size={20} />
                      <div>
                        <strong>Venue</strong>
                        <p>{meeting.venue || 'Venue TBD'}</p>
                      </div>
                    </div>

                    <div className={styles.infoRow}>
                      <Map className={styles.icon} size={20} />
                      <div>
                        <strong>Participating Zones</strong>
                        <div className={styles.tags}>
                          {meeting.assignedZones?.map(zoneId => {
                            const zone = zones.find(z => z.id === zoneId);
                            return <span key={zoneId} className={styles.tag}>{zone?.name || 'Unknown'}</span>;
                          })}
                          {(!meeting.assignedZones || meeting.assignedZones.length === 0) && (
                            <span className={styles.emptyTag}>None Assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No meetings have been scheduled yet. Please check back later.</div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Council of Samastha Women's Colleges. All rights reserved.</p>
        {/* The hidden admin link you requested, distinct from others */}
        <Link href="/manage-cswc-portal/dashboard" className={styles.secretAdminLink}>
          Portal Access
        </Link>
      </footer>
    </div>
  );
}
