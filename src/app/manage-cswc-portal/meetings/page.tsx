'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/Button';
import styles from './meetings.module.css';
import { Trash2, Plus, Edit2, Calendar, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface MeetingCenter {
  id: string;
  title: string;
  date: string;
  time: string;
  timeTo: string;
  venue: string;
  locationUrl?: string;
  posterUrl?: string;
  assignedZones: string[];
}

interface Zone {
  id: string;
  name: string;
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<MeetingCenter[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', date: '', time: '', timeTo: '', venue: '', locationUrl: '', posterUrl: '', assignedZones: [] as string[] });
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [meetingsSnap, zonesSnap] = await Promise.all([
        getDocs(collection(db, 'meetingCenters')),
        getDocs(collection(db, 'zones'))
      ]);
      
      setMeetings(meetingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingCenter)));
      setZones(zonesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Zone)));
    } catch (error: any) {
      toast.error('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return toast.error('Meeting title is required');

    try {
      const id = editingId || `meeting-${Date.now()}`;
      const docRef = doc(db, 'meetingCenters', id);
      
      await setDoc(docRef, formData);
      
      toast.success(editingId ? 'Meeting updated' : 'Meeting created');
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Error saving meeting: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this meeting center?')) {
      try {
        await deleteDoc(doc(db, 'meetingCenters', id));
        toast.success('Meeting deleted');
        setMeetings(meetings.filter(m => m.id !== id));
      } catch (error: any) {
        toast.error('Error deleting meeting: ' + error.message);
      }
    }
  };

  const openModal = (meeting?: MeetingCenter) => {
    if (meeting) {
      setEditingId(meeting.id);
      setFormData({
        title: meeting.title,
        date: meeting.date || '',
        time: meeting.time || '',
        timeTo: meeting.timeTo || '',
        venue: meeting.venue || '',
        locationUrl: meeting.locationUrl || '',
        posterUrl: meeting.posterUrl || '',
        assignedZones: meeting.assignedZones || []
      });
    } else {
      setEditingId(null);
      setFormData({ title: '', date: '', time: '', timeTo: '', venue: '', locationUrl: '', posterUrl: '', assignedZones: [] });
    }
    setIsModalOpen(true);
  };

  const handleZoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, assignedZones: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `posters/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, posterUrl: url }));
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Meeting Centers</h1>
          <p className={styles.subtitle}>Schedule management meetings and assign zones</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          Create Meeting
        </Button>
      </div>

      <div className={styles.grid}>
        {loading ? (
          <div className={styles.loading}>Loading meetings...</div>
        ) : meetings.length > 0 ? (
          meetings.map((meeting) => (
            <div key={meeting.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{meeting.title}</h3>
                <div className={styles.actionButtons}>
                  <button className={styles.iconBtn} onClick={() => openModal(meeting)}>
                    <Edit2 size={16} />
                  </button>
                  <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(meeting.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                  <Calendar size={16} />
                  <span>{meeting.date || 'No Date'} | {meeting.time || 'No Time'}{meeting.timeTo ? ` - ${meeting.timeTo}` : ''}</span>
                </div>
                <div className={styles.infoRow}>
                  <strong>Venue:</strong> {meeting.venue || 'TBD'}
                </div>
                {meeting.locationUrl && (
                  <div className={styles.infoRow}>
                    <MapPin size={16} />
                    <a href={meeting.locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                      View on Map
                    </a>
                  </div>
                )}
                <div className={styles.zonesList}>
                  <strong>Zones:</strong>
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
          ))
        ) : (
          <div className={styles.emptyState}>No meetings found.</div>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{editingId ? 'Edit Meeting' : 'Create Meeting'}</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>Meeting Title / Center Name</label>
                <input 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})} 
                  placeholder="e.g. CSWC Main Meet 2026"
                  required
                />
              </div>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Date</label>
                  <input 
                    type="date"
                    value={formData.date} 
                    onChange={(e) => setFormData({...formData, date: e.target.value})} 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Time From</label>
                  <input 
                    type="time"
                    value={formData.time} 
                    onChange={(e) => setFormData({...formData, time: e.target.value})} 
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Time To</label>
                  <input 
                    type="time"
                    value={formData.timeTo} 
                    onChange={(e) => setFormData({...formData, timeTo: e.target.value})} 
                  />
                </div>
              </div>
                <div className={styles.inputGroup}>
                  <label>Venue / Location Name</label>
                  <input 
                    value={formData.venue} 
                    onChange={(e) => setFormData({...formData, venue: e.target.value})} 
                    placeholder="e.g. Main Auditorium"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Location Map URL</label>
                  <input 
                    type="url"
                    value={formData.locationUrl} 
                    onChange={(e) => setFormData({...formData, locationUrl: e.target.value})} 
                    placeholder="e.g. https://maps.google.com/..."
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Poster Image (Upload or enter URL)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="url"
                      value={formData.posterUrl} 
                      onChange={(e) => setFormData({...formData, posterUrl: e.target.value})} 
                      placeholder="Direct link to image"
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)', whiteSpace: 'nowrap' }}>OR</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      style={{ flex: 1, padding: '0.3rem' }}
                    />
                    {uploadingImage && <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Uploading...</span>}
                  </div>
                </div>
              <div className={styles.inputGroup}>
                <label>Assigned Zones (Hold Ctrl/Cmd to select multiple)</label>
                <select 
                  multiple 
                  value={formData.assignedZones} 
                  onChange={handleZoneSelect}
                  className={styles.multiSelect}
                >
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingId ? 'Save Changes' : 'Create Meeting'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
