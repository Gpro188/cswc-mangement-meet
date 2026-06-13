'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import styles from './registrations.module.css';
import { Trash2, Edit2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Registration {
  id: string;
  institutionId: string;
  centerId: string;
  zone: string;
  participants: any[];
}

interface Institution {
  id: string;
  name: string;
}

export default function Registrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regSnap, instSnap] = await Promise.all([
        getDocs(collection(db, 'registrations')),
        getDocs(collection(db, 'institutions'))
      ]);
      
      setRegistrations(regSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration)));
      setInstitutions(instSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Institution)));
    } catch (error: any) {
      toast.error('Error fetching registrations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getInstitutionName = (instId: string) => {
    const inst = institutions.find(i => i.id === instId);
    return inst ? inst.name : 'Unknown Institution';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this registration?')) {
      try {
        await deleteDoc(doc(db, 'registrations', id));
        toast.success('Registration deleted');
        setRegistrations(registrations.filter(r => r.id !== id));
      } catch (error: any) {
        toast.error('Error deleting registration: ' + error.message);
      }
    }
  };

  const openEditModal = (reg: Registration) => {
    setEditingReg(reg);
    // Deep clone participants array so we don't mutate state directly
    setParticipants(JSON.parse(JSON.stringify(reg.participants || [])));
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingReg(null);
    setParticipants([]);
    setIsModalOpen(false);
  };

  const addParticipant = () => {
    setParticipants([...participants, { name: '', designation: '', phone: '', email: '' }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  const saveRegistration = async () => {
    if (!editingReg) return;
    
    // Filter out completely empty participants
    const validParticipants = participants.filter(p => p.name.trim() !== '' || p.phone.trim() !== '');

    try {
      const docRef = doc(db, 'registrations', editingReg.id);
      await setDoc(docRef, { participants: validParticipants }, { merge: true });
      
      toast.success('Registration updated successfully');
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Error updating registration: ' + error.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Registrations</h1>
          <p className={styles.subtitle}>Manage all registered institutions and their participants</p>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading registrations...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Institution Name</th>
                <th>Zone</th>
                <th>Participants Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length > 0 ? (
                registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td className={styles.fontMedium}>{getInstitutionName(reg.institutionId)}</td>
                    <td>{reg.zone}</td>
                    <td>
                      <span className={styles.statusBadge + ' ' + styles.statusActive}>
                        {reg.participants?.length || 0} Registered
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button className={styles.iconBtn} onClick={() => openEditModal(reg)} title="Edit Participants">
                          <Edit2 size={18} />
                        </button>
                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(reg.id)} title="Delete Registration">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>No registrations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && editingReg && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Edit Registration - {getInstitutionName(editingReg.institutionId)}</h2>
              <button className={styles.closeBtn} onClick={closeEditModal}><X size={20} /></button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.addBtn}>
                <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
                  <Plus size={16} style={{ marginRight: '4px' }} /> Add Participant
                </Button>
              </div>

              {participants.map((p, idx) => (
                <div key={idx} className={styles.participantRow}>
                  <div className={styles.participantFields}>
                    <input 
                      placeholder="Name" 
                      value={p.name} 
                      onChange={(e) => updateParticipant(idx, 'name', e.target.value)} 
                    />
                    <input 
                      placeholder="Phone" 
                      value={p.phone} 
                      onChange={(e) => updateParticipant(idx, 'phone', e.target.value)} 
                    />
                    <input 
                      placeholder="Designation" 
                      value={p.designation} 
                      onChange={(e) => updateParticipant(idx, 'designation', e.target.value)} 
                    />
                    <input 
                      placeholder="Email" 
                      value={p.email} 
                      onChange={(e) => updateParticipant(idx, 'email', e.target.value)} 
                    />
                  </div>
                  <button type="button" className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => removeParticipant(idx)}>
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              
              {participants.length === 0 && (
                <p style={{ color: 'var(--color-gray-500)', textAlign: 'center' }}>No participants. Add one above.</p>
              )}
            </div>

            <div className={styles.modalActions}>
              <Button type="button" variant="outline" onClick={closeEditModal}>Cancel</Button>
              <Button onClick={saveRegistration}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
