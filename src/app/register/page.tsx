'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import styles from './register.module.css';
import { CheckCircle, MapPin, Calendar, Clock, Plus, Trash2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Participant {
  name: string;
  designation: string;
  phone: string;
  email: string;
}

export default function Register() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [zones, setZones] = useState<{id: string, name: string, centerId: string}[]>([]);
  const [institutions, setInstitutions] = useState<{id: string, name: string, zone: string}[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  
  // Form State
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([{ name: '', designation: '', phone: '', email: '' }]);
  const [existingRegistration, setExistingRegistration] = useState<any>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [zonesSnap, centersSnap, instSnap] = await Promise.all([
          getDocs(collection(db, 'zones')),
          getDocs(collection(db, 'meetingCenters')),
          getDocs(collection(db, 'institutions'))
        ]);
        
        setZones(zonesSnap.docs.map(d => ({ id: d.id, name: d.data().name, centerId: d.data().centerId })));
        setCenters(centersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setInstitutions(instSnap.docs.map(d => ({ id: d.id, name: d.data().name, zone: d.data().zone })));
      } catch (error) {
        toast.error('Error loading form data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleZoneSelect = (zoneName: string) => {
    setSelectedZone(zoneName);
    setSelectedInstitution('');
    setExistingRegistration(null);
  };

  const handleInstitutionSelect = async (instId: string) => {
    setSelectedInstitution(instId);
    if (!instId) return;

    // Check if registration exists
    setLoading(true);
    try {
      const q = query(collection(db, 'registrations'), where('institutionId', '==', instId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingData = querySnapshot.docs[0].data();
        setExistingRegistration({ id: querySnapshot.docs[0].id, ...existingData });
        setParticipants([{ name: '', designation: '', phone: '', email: '' }]); // clear new form
      } else {
        setExistingRegistration(null);
        setParticipants([{ name: '', designation: '', phone: '', email: '' }]);
      }
    } catch (error) {
      toast.error('Error checking existing registration');
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = () => {
    setParticipants([...participants, { name: '', designation: '', phone: '', email: '' }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty rows
    const validParticipants = participants.filter(p => p.name.trim() !== '' && p.phone.trim() !== '');
    
    if (validParticipants.length === 0 && !existingRegistration) {
      return toast.error('Please add at least one valid participant with name and phone number.');
    }

    setSubmitting(true);
    
    // Check for duplicate phones locally
    const phoneSet = new Set();
    let hasDuplicate = false;
    
    // Add existing phones to set
    if (existingRegistration?.participants) {
      existingRegistration.participants.forEach((p: any) => phoneSet.add(p.phone));
    }
    
    // Check new phones
    validParticipants.forEach(p => {
      if (phoneSet.has(p.phone)) {
        hasDuplicate = true;
      }
      phoneSet.add(p.phone);
    });

    if (hasDuplicate) {
      setSubmitting(false);
      return toast.error('Duplicate phone numbers are not allowed within the same institution.');
    }

    try {
      const selectedZoneData = zones.find(z => z.name === selectedZone);
      const centerId = selectedZoneData?.centerId || '';
      
      let allParticipants = [];
      if (existingRegistration) {
        allParticipants = [...existingRegistration.participants, ...validParticipants];
      } else {
        allParticipants = validParticipants;
      }

      const docId = existingRegistration ? existingRegistration.id : `reg-${Date.now()}`;
      
      await setDoc(doc(db, 'registrations', docId), {
        institutionId: selectedInstitution,
        centerId: centerId,
        zone: selectedZone,
        participants: allParticipants,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (error: any) {
      toast.error('Registration failed: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && step === 1) {
    return <div className={styles.pageLoader}>Loading Registration System...</div>;
  }

  const filteredInstitutions = institutions.filter(i => i.zone === selectedZone);
  const activeZone = zones.find(z => z.name === selectedZone);
  const activeCenter = activeZone ? centers.find(c => c.assignedZones?.includes(activeZone.id)) : undefined;

  if (success) {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <CheckCircle size={64} />
          </div>
          <h1>Registration Successful!</h1>
          <p>Thank you for registering for the CSWC Management Meet.</p>

          {activeCenter && (
            <div className={styles.meetingDetails} style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'left', backgroundColor: 'var(--color-gray-50)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-maroon)' }}>Meeting Details</h3>
              <div className={styles.infoItem} style={{ marginBottom: '0.5rem' }}>
                <MapPin size={18} />
                <span><strong>Venue:</strong> {activeCenter.venue || activeCenter.title}</span>
              </div>
              <div className={styles.infoItem} style={{ marginBottom: '0.5rem' }}>
                <Calendar size={18} />
                <span><strong>Date:</strong> {activeCenter.date || 'TBD'}</span>
              </div>
              <div className={styles.infoItem}>
                <Clock size={18} />
                <span><strong>Time:</strong> {activeCenter.time || 'TBD'} {activeCenter.timeTo ? `- ${activeCenter.timeTo}` : ''}</span>
              </div>
            </div>
          )}

          <p style={{ fontWeight: 600, color: 'var(--color-gray-700)', marginTop: '1rem' }}>
            We hope you will participate in the meeting.
          </p>

          <Button onClick={() => window.location.reload()} variant="outline" style={{ marginTop: '2rem' }}>
            Register Another Institution
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.logoWrapper}>
          <img src="/logo.png" alt="CSWC Logo" className={styles.logoImage} />
        </div>
        <h1>Management Meet Registration</h1>
        <p>Complete the form below to register your institution members.</p>
      </div>

      <div className={styles.formCard}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Step 1: Select Your Zone</h2>
            <div className={styles.inputGroup}>
              <select 
                value={selectedZone} 
                onChange={(e) => handleZoneSelect(e.target.value)}
                className={styles.select}
              >
                <option value="">-- Choose Zone --</option>
                {[...new Set(zones.map(z => z.name))].sort().map((zoneName, idx) => (
                  <option key={idx} value={zoneName}>{zoneName}</option>
                ))}
              </select>
            </div>
            <div className={styles.stepActions}>
              <Button 
                onClick={() => setStep(2)} 
                disabled={!selectedZone}
              >
                Continue <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Step 2: Select Institution</h2>
            <div className={styles.inputGroup}>
              <select 
                value={selectedInstitution} 
                onChange={(e) => handleInstitutionSelect(e.target.value)}
                className={styles.select}
                disabled={loading}
              >
                <option value="">-- Choose Institution --</option>
                {filteredInstitutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>

            {selectedInstitution && activeCenter && (
              <div className={styles.meetingDetails}>
                <h3>Assigned Management Meeting Center</h3>
                <div className={styles.meetingInfo}>
                  <div className={styles.infoItem}>
                    <MapPin size={18} />
                    <span><strong>Venue:</strong> {activeCenter.venue || activeCenter.title}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <Calendar size={18} />
                    <span><strong>Date:</strong> {activeCenter.date || 'TBD'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <Clock size={18} />
                    <span><strong>Time:</strong> {activeCenter.time || 'TBD'} {activeCenter.timeTo ? `- ${activeCenter.timeTo}` : ''}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedInstitution && !loading && (
              <form onSubmit={handleSubmit}>
                
                {existingRegistration && existingRegistration.participants?.length > 0 && (
                  <div className={styles.existingMembers}>
                    <h3>Already Registered Members</h3>
                    <div className={styles.memberList}>
                      {existingRegistration.participants.map((p: any, idx: number) => (
                        <div key={idx} className={styles.memberItem}>
                          <div className={styles.memberAvatar}>{p.name.charAt(0)}</div>
                          <div className={styles.memberDetails}>
                            <strong>{p.name}</strong>
                            <span>{p.designation} • {p.phone}</span>
                          </div>
                          <div className={styles.registeredBadge}>Registered</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.participantsSection}>
                  <div className={styles.sectionHeader}>
                    <h3>{existingRegistration ? 'Add Additional Members' : 'Register Members'}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
                      <Plus size={16} style={{ marginRight: '4px' }} /> Add Row
                    </Button>
                  </div>
                  
                  {participants.map((p, idx) => (
                    <div key={idx} className={styles.participantRow}>
                      <div className={styles.participantNum}>{idx + 1}</div>
                      <div className={styles.participantFields}>
                        <input 
                          placeholder="Full Name" 
                          value={p.name} 
                          onChange={(e) => updateParticipant(idx, 'name', e.target.value)} 
                          required={idx === 0 && !existingRegistration}
                        />
                        <input 
                          placeholder="Designation (e.g. Principal)" 
                          value={p.designation} 
                          onChange={(e) => updateParticipant(idx, 'designation', e.target.value)} 
                        />
                        <input 
                          placeholder="Phone Number" 
                          value={p.phone} 
                          onChange={(e) => updateParticipant(idx, 'phone', e.target.value)} 
                          required={idx === 0 && !existingRegistration}
                        />
                        <input 
                          placeholder="Email (Optional)" 
                          value={p.email} 
                          onChange={(e) => updateParticipant(idx, 'email', e.target.value)} 
                        />
                      </div>
                      {participants.length > 1 && (
                        <button type="button" className={styles.removeBtn} onClick={() => removeParticipant(idx)}>
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className={styles.formActions}>
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button type="submit" isLoading={submitting}>Complete Registration</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
