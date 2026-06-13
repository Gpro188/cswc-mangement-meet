'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './dashboard.module.css';
import { Building2, Map, MapPin, Users } from 'lucide-react';

interface Stats {
  institutions: number;
  zones: number;
  centers: number;
  registrations: number;
  participants: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    institutions: 0,
    zones: 0,
    centers: 0,
    registrations: 0,
    participants: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const instSnap = await getDocs(collection(db, 'institutions'));
        const zonesSnap = await getDocs(collection(db, 'zones'));
        const centersSnap = await getDocs(collection(db, 'meetingCenters'));
        const regSnap = await getDocs(collection(db, 'registrations'));

        let totalParticipants = 0;
        regSnap.forEach(doc => {
          const data = doc.data();
          if (data.participants && Array.isArray(data.participants)) {
            totalParticipants += data.participants.length;
          }
        });

        setStats({
          institutions: instSnap.size,
          zones: zonesSnap.size,
          centers: centersSnap.size,
          registrations: regSnap.size,
          participants: totalParticipants
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStats();
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading Dashboard...</div>;
  }

  const statCards = [
    { title: 'Total Institutions', value: stats.institutions, icon: Building2, color: 'var(--color-maroon)' },
    { title: 'Total Zones', value: stats.zones, icon: Map, color: 'var(--color-gray-800)' },
    { title: 'Meeting Centers', value: stats.centers, icon: MapPin, color: 'var(--color-success)' },
    { title: 'Registered Institutions', value: stats.registrations, icon: Building2, color: 'var(--color-maroon-light)' },
    { title: 'Total Participants', value: stats.participants, icon: Users, color: '#3b82f6' },
  ];

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard Overview</h1>
        <p className={styles.subtitle}>Welcome to the CSWC Management Meet Registration System</p>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <Icon size={24} />
              </div>
              <div className={styles.statInfo}>
                <h3>{stat.value}</h3>
                <p>{stat.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
