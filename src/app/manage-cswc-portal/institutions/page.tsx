'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import styles from './institutions.module.css';
import { Upload, Trash2, Search, FileSpreadsheet, Edit, X } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface Institution {
  id: string; // Firestore document ID
  institutionId: string;
  name: string;
  zone: string;
  district: string;
  place?: string;
  principalName?: string;
  phone?: string;
  email?: string;
  status?: string;
}

export default function Institutions() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'institutions'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Institution));
      setInstitutions(data);
    } catch (error: any) {
      toast.error('Error fetching institutions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const processData = async (data: any[]) => {
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      const uniqueZones = new Set<string>();
      
      data.forEach((row: any) => {
        const institutionId = row['Institution ID'] || row.institutionId || `inst-${Date.now()}-${count}`;
        const name = row['Institution Name'] || row.name || row['Institution'];
        const zone = row['Zone'] || row.zone;
        const district = row['District'] || row.district;
        const place = row['Place'] || row.place;
        
        if (name && zone) {
          uniqueZones.add(String(zone));
          const docRef = doc(collection(db, 'institutions'));
          batch.set(docRef, {
            institutionId: String(institutionId),
            name: String(name),
            zone: String(zone),
            district: district ? String(district) : '',
            place: place ? String(place) : '',
            principalName: row['Principal Name'] || row.principalName || '',
            phone: row['Phone Number'] || row.phone || '',
            email: row['Email'] || row.email || '',
            status: row['Status'] || row.status || 'Active'
          });
          count++;
        }
      });

      // Check existing zones and create missing ones
      const existingZonesSnap = await getDocs(collection(db, 'zones'));
      const existingZones = new Set(existingZonesSnap.docs.map(d => d.data().name));
      
      let addedZonesCount = 0;
      Array.from(uniqueZones).forEach(zone => {
        if (!existingZones.has(zone)) {
          const zoneRef = doc(collection(db, 'zones'));
          batch.set(zoneRef, { 
            name: zone, 
            description: 'Auto-created from institutions import' 
          });
          addedZonesCount++;
        }
      });

      await batch.commit();
      toast.success(`Successfully imported ${count} institutions! ${addedZonesCount > 0 ? `Auto-created ${addedZonesCount} new zones.` : ''}`);
      fetchInstitutions();
    } catch (error: any) {
      toast.error('Error importing data: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processData(data);
        } catch (error) {
          toast.error('Error parsing Excel file');
          setUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => {
          toast.error('Error parsing CSV: ' + error.message);
          setUploading(false);
        }
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this institution?')) {
      try {
        await deleteDoc(doc(db, 'institutions', id));
        toast.success('Institution deleted');
        setInstitutions(institutions.filter(i => i.id !== id));
      } catch (error: any) {
        toast.error('Error deleting institution: ' + error.message);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (confirm('WARNING: Are you absolutely sure you want to delete ALL institutions? This cannot be undone.')) {
      setLoading(true);
      try {
        // Firestore batch deletes up to 500 at a time
        const chunks = [];
        for (let i = 0; i < institutions.length; i += 500) {
          chunks.push(institutions.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(inst => {
            const docRef = doc(db, 'institutions', inst.id);
            batch.delete(docRef);
          });
          await batch.commit();
        }

        toast.success(`Deleted all ${institutions.length} institutions.`);
        setInstitutions([]);
      } catch (error: any) {
        toast.error('Error deleting all institutions: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    
    try {
      const docRef = doc(db, 'institutions', editingInst.id);
      await updateDoc(docRef, {
        name: editingInst.name,
        zone: editingInst.zone,
        district: editingInst.district,
        place: editingInst.place,
        institutionId: editingInst.institutionId
      });
      
      toast.success('Institution updated successfully');
      setInstitutions(institutions.map(i => i.id === editingInst.id ? editingInst : i));
      setEditingInst(null);
    } catch (error: any) {
      toast.error('Error updating institution: ' + error.message);
    }
  };

  const filteredInstitutions = institutions.filter(inst => 
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inst.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Institutions</h1>
          <p className={styles.subtitle}>Manage all affiliated institutions</p>
        </div>
        
        <div className={styles.actions}>
          <Button 
            onClick={handleDeleteAll} 
            variant="outline" 
            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
          >
            <Trash2 size={18} style={{ marginRight: '8px' }} />
            Delete All
          </Button>
          
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            isLoading={uploading}
            variant="outline"
          >
            <Upload size={18} style={{ marginRight: '8px' }} />
            Import CSV/Excel
          </Button>
          <Button>Add Manually</Button>
        </div>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchInputWrapper}>
          <Search size={20} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by name, zone, or district..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading institutions...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Institution Name</th>
                <th>Place</th>
                <th>Zone</th>
                <th>District</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((inst) => (
                  <tr key={inst.id}>
                    <td>{inst.institutionId}</td>
                    <td className={styles.fontMedium}>{inst.name}</td>
                    <td>{inst.place || '-'}</td>
                    <td>{inst.zone}</td>
                    <td>{inst.district}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${inst.status === 'Active' ? styles.statusActive : styles.statusInactive}`}>
                        {inst.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={styles.editBtn} onClick={() => setEditingInst(inst)} title="Edit">
                          <Edit size={18} />
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(inst.id)} title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>No institutions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editingInst && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Edit Institution</h2>
              <button className={styles.closeBtn} onClick={() => setEditingInst(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Institution ID</label>
                <input 
                  type="text" 
                  value={editingInst.institutionId} 
                  onChange={(e) => setEditingInst({...editingInst, institutionId: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input 
                  type="text" 
                  value={editingInst.name} 
                  onChange={(e) => setEditingInst({...editingInst, name: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Place</label>
                <input 
                  type="text" 
                  value={editingInst.place || ''} 
                  onChange={(e) => setEditingInst({...editingInst, place: e.target.value})}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Zone</label>
                <input 
                  type="text" 
                  value={editingInst.zone} 
                  onChange={(e) => setEditingInst({...editingInst, zone: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>District</label>
                <input 
                  type="text" 
                  value={editingInst.district} 
                  onChange={(e) => setEditingInst({...editingInst, district: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={() => setEditingInst(null)}>Cancel</Button>
                <Button type="submit" variant="primary">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
