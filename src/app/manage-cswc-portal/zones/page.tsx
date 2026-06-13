'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import styles from './zones.module.css';
import { Trash2, Plus, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Zone {
  id: string;
  name: string;
  districts: string[];
  centerId: string;
}

interface MeetingCenter {
  id: string;
  title: string;
  assignedZones?: string[];
}

export default function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [centers, setCenters] = useState<MeetingCenter[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', districts: '', centerId: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesSnap, centersSnap] = await Promise.all([
        getDocs(collection(db, 'zones')),
        getDocs(collection(db, 'meetingCenters'))
      ]);
      
      setZones(zonesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Zone)));
      setCenters(centersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingCenter)));
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
    if (!formData.name) return toast.error('Zone name is required');

    try {
      const id = editingId || `zone-${Date.now()}`;
      const docRef = doc(db, 'zones', id);
      
      await setDoc(docRef, {
        name: formData.name,
        districts: formData.districts.split(',').map(d => d.trim()).filter(Boolean),
        centerId: formData.centerId
      });
      
      toast.success(editingId ? 'Zone updated' : 'Zone created');
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Error saving zone: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this zone?')) {
      try {
        await deleteDoc(doc(db, 'zones', id));
        toast.success('Zone deleted');
        setZones(zones.filter(z => z.id !== id));
      } catch (error: any) {
        toast.error('Error deleting zone: ' + error.message);
      }
    }
  };

  const openModal = (zone?: Zone) => {
    if (zone) {
      setEditingId(zone.id);
      setFormData({
        name: zone.name,
        districts: zone.districts ? zone.districts.join(', ') : '',
        centerId: zone.centerId || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', districts: '', centerId: '' });
    }
    setIsModalOpen(true);
  };

  const getCenterForZone = (zoneId: string) => {
    return centers.find(c => c.assignedZones?.includes(zoneId));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Zones</h1>
          <p className={styles.subtitle}>Manage regional zones and their assigned centers</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={18} style={{ marginRight: '8px' }} />
          Create Zone
        </Button>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading zones...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Zone Name</th>
                <th>Districts</th>
                <th>Assigned Center</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.length > 0 ? (
                zones.map((zone) => {
                  const assignedCenter = getCenterForZone(zone.id);
                  return (
                  <tr key={zone.id}>
                    <td className={styles.fontMedium}>{zone.name}</td>
                    <td>
                      <div className={styles.tags}>
                        {zone.districts && zone.districts.length > 0 ? (
                          zone.districts.map((d, i) => (
                            <span key={i} className={styles.tag}>{d}</span>
                          ))
                        ) : (
                          <span className={styles.emptyTag}>No districts added</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${assignedCenter ? styles.statusActive : styles.statusInactive}`}>
                        {assignedCenter ? assignedCenter.title : 'Not Assigned'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button className={styles.iconBtn} onClick={() => openModal(zone)}>
                          <Edit2 size={18} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(zone.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>No zones found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{editingId ? 'Edit Zone' : 'Create Zone'}</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="name">Zone Name</label>
                <input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Kasaragod"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="districts">Districts (comma separated)</label>
                <input 
                  id="districts" 
                  value={formData.districts} 
                  onChange={(e) => setFormData({...formData, districts: e.target.value})} 
                  placeholder="Kannur, Kasaragod"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="center">Assigned Meeting Center</label>
                <select 
                  id="center" 
                  value={formData.centerId} 
                  onChange={(e) => setFormData({...formData, centerId: e.target.value})}
                >
                  <option value="">-- Unassigned --</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>{center.title}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingId ? 'Save Changes' : 'Create Zone'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
