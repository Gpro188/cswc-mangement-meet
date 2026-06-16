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

interface MeetingInfo {
  id: string;
  title: string;
  date: string;
  time: string;
  totalInstitutions: number;
  registeredInstitutions: number;
  pendingInstitutions: number;
  registeredMembers: number;
  registeredInstitutionList: any[];
  pendingInstitutionList: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    institutions: 0,
    zones: 0,
    centers: 0,
    registrations: 0,
    participants: 0
  });
  const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);

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

        const institutionsData = instSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const zonesData = zonesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const regsData = regSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const meetingsData = centersSnap.docs.map(doc => {
          const data = doc.data();
          const assignedZones = data.assignedZones || [];
          
          // Map assigned zone IDs to zone names
          const assignedZoneNames = assignedZones.map((zId: string) => {
            const z = zonesData.find(zone => zone.id === zId);
            return z ? (z as any).name : '';
          }).filter((name: string) => name);

          const totalInstitutionsList = institutionsData.filter(inst => assignedZoneNames.includes((inst as any).zone));
          const totalInstitutions = totalInstitutionsList.length;

          // Registrations for this center (check both centerId and zone mapping)
          const meetingRegs = regsData.filter(reg => {
            const r = reg as any;
            return r.centerId === doc.id || assignedZoneNames.includes(r.zone);
          });
          const registeredInstitutionList = totalInstitutionsList.filter(inst => 
            meetingRegs.some(reg => (reg as any).institutionId === inst.id || (reg as any).institutionName === (inst as any).name)
          );
          const pendingInstitutionList = totalInstitutionsList.filter(inst => 
            !meetingRegs.some(reg => (reg as any).institutionId === inst.id || (reg as any).institutionName === (inst as any).name)
          );

          const registeredInstitutions = registeredInstitutionList.length;
          const pendingInstitutions = pendingInstitutionList.length;
          
          let registeredMembers = 0;
          meetingRegs.forEach(reg => {
            const participants = (reg as any).participants;
            if (participants && Array.isArray(participants)) {
              registeredMembers += participants.length;
            }
          });

          return {
            id: doc.id,
            title: data.title || 'Untitled',
            date: data.date || '',
            time: data.time || '',
            totalInstitutions,
            registeredInstitutions,
            pendingInstitutions,
            registeredMembers,
            registeredInstitutionList,
            pendingInstitutionList
          };
        });

        // Sort by date (closest first)
        meetingsData.sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        setMeetings(meetingsData);
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
    { title: 'Created Meetings', value: stats.centers, icon: MapPin, color: 'var(--color-success)' },
    { title: 'Total Institutions', value: stats.institutions, icon: Building2, color: 'var(--color-maroon)' },
    { title: 'Registered Institutions', value: stats.registrations, icon: Building2, color: 'var(--color-maroon-light)' },
    { title: 'Pending Institutions', value: stats.institutions - stats.registrations, icon: Building2, color: '#f59e0b' },
    { title: 'Registered Members', value: stats.participants, icon: Users, color: '#3b82f6' },
  ];

  const getStatus = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    const meetingDate = new Date(dateStr);
    const today = new Date();
    meetingDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
  
    if (meetingDate < today) return 'Completed';
    if (meetingDate.getTime() === today.getTime()) return 'Ongoing';
    return 'Upcoming';
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Completed': return '#10b981'; // green
      case 'Ongoing': return '#3b82f6'; // blue
      case 'Upcoming': return '#f59e0b'; // orange
      default: return '#6b7280'; // gray
    }
  };

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

      <div className={styles.meetingsSection}>
        <h2 className={styles.sectionTitle}>Recent & Upcoming Meetings</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.meetingsTable}>
            <thead>
              <tr>
                <th>Meeting Name</th>
                <th>Total Inst.</th>
                <th>Reg. Inst.</th>
                <th>Pending Inst.</th>
                <th>Reg. Members</th>
                <th>Date & Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.length > 0 ? (
                meetings.map(meeting => {
                  const status = getStatus(meeting.date);
                  return (
                    <tr key={meeting.id}>
                      <td className={styles.meetingTitle}>{meeting.title}</td>
                      <td>{meeting.totalInstitutions}</td>
                      <td>
                        <button 
                          className={styles.clickableCount}
                          onClick={() => {
                            setModalTitle(`Registered Institutions - ${meeting.title}`);
                            setModalData(meeting.registeredInstitutionList);
                            setModalOpen(true);
                          }}
                        >
                          {meeting.registeredInstitutions}
                        </button>
                      </td>
                      <td>
                        <button 
                          className={styles.clickableCount}
                          onClick={() => {
                            setModalTitle(`Pending Institutions - ${meeting.title}`);
                            setModalData(meeting.pendingInstitutionList);
                            setModalOpen(true);
                          }}
                        >
                          {meeting.pendingInstitutions}
                        </button>
                      </td>
                      <td>{meeting.registeredMembers}</td>
                      <td>{meeting.date ? new Date(meeting.date).toLocaleDateString() : 'TBD'} {meeting.time ? `at ${meeting.time}` : ''}</td>
                      <td>
                        <span className={styles.statusBadge} style={{ backgroundColor: `${getStatusColor(status)}15`, color: getStatusColor(status) }}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>No meetings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{modalTitle}</h3>
              <button className={styles.closeButton} onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              {modalData && modalData.length > 0 ? (
                <ul className={styles.institutionList}>
                  {modalData.map((inst, index) => (
                    <li key={index} className={styles.institutionListItem}>
                      <strong>{inst.name || 'Unknown Institution'}</strong>
                      {inst.zone && <span>Zone: {inst.zone}</span>}
                      {inst.place && <span>Place: {inst.place}</span>}
                      {inst.headName && <span>Head: {inst.headName}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.noData}>No institutions found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
