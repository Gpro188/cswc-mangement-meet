'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import styles from './reports.module.css';
import { Printer, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface Registration {
  id: string;
  institutionId: string;
  centerId: string;
  zone: string;
  participants: any[];
}

export default function Reports() {
  const [reportType, setReportType] = useState('center'); // 'center', 'zone', 'district', 'institution'
  const [filterValue, setFilterValue] = useState('');
  
  // Data
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [regSnap, instSnap, centerSnap, zoneSnap] = await Promise.all([
          getDocs(collection(db, 'registrations')),
          getDocs(collection(db, 'institutions')),
          getDocs(collection(db, 'meetingCenters')),
          getDocs(collection(db, 'zones'))
        ]);
        
        setRegistrations(regSnap.docs.map(d => ({ id: d.id, ...d.data() } as Registration)));
        setInstitutions(instSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCenters(centerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setZones(zoneSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error fetching data for reports', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getInstitutionDetails = (id: string) => institutions.find(i => i.id === id);
  const getCenterDetails = (id: string) => centers.find(c => c.id === id);

  const handlePrint = () => {
    window.print();
  };

  const handlePDFDownload = async () => {
    const input = printRef.current;
    if (!input) return;
    
    // Briefly hide print-hidden elements if necessary, html2canvas renders what it sees
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`CSWC_Report_${reportType}_${new Date().getTime()}.pdf`);
  };

  const handleExcelExport = () => {
    // Generate data based on current view
    let data: any[] = [];
    
    if (reportType === 'center') {
      const center = centers.find(c => c.id === filterValue);
      if (!center) return;

      const assignedZoneNames = center.assignedZones?.map((zoneId: string) => {
        const z = zones.find((z: any) => z.id === zoneId);
        return z?.name;
      }).filter(Boolean) || [];

      const filteredRegs = registrations.filter(r => r.centerId === filterValue || assignedZoneNames.includes(r.zone));
      filteredRegs.forEach(reg => {
        const inst = getInstitutionDetails(reg.institutionId);
        reg.participants.forEach((p: any) => {
          data.push({
            'Meeting Center': center.title,
            'Date': center.date,
            'Institution': inst?.name || 'Unknown',
            'District': inst?.district || '',
            'Participant Name': p.name,
            'Designation': p.designation,
            'Phone': p.phone
          });
        });
      });
    } else if (reportType === 'zone') {
      const filteredRegs = registrations.filter(r => r.zone === filterValue);
      filteredRegs.forEach(reg => {
        const inst = getInstitutionDetails(reg.institutionId);
        reg.participants.forEach((p: any) => {
          data.push({
            'Zone': reg.zone,
            'Institution': inst?.name || 'Unknown',
            'District': inst?.district || '',
            'Participant Name': p.name,
            'Designation': p.designation,
            'Phone': p.phone
          });
        });
      });
    } else if (reportType === 'district') {
      const districtInsts = institutions.filter(i => i.district === filterValue).map(i => i.id);
      const filteredRegs = registrations.filter(r => districtInsts.includes(r.institutionId));
      filteredRegs.forEach(reg => {
        const inst = getInstitutionDetails(reg.institutionId);
        reg.participants.forEach((p: any) => {
          data.push({
            'District': inst?.district,
            'Institution': inst?.name || 'Unknown',
            'Zone': reg.zone,
            'Participant Name': p.name,
            'Designation': p.designation,
            'Phone': p.phone
          });
        });
      });
    } else if (reportType === 'institution') {
      const reg = registrations.find(r => r.institutionId === filterValue);
      const inst = getInstitutionDetails(filterValue);
      if (reg) {
        reg.participants.forEach((p: any) => {
          data.push({
            'Institution Name': inst?.name,
            'Zone': reg.zone,
            'Participant Name': p.name,
            'Designation': p.designation,
            'Phone': p.phone
          });
        });
      }
    } else if (reportType === 'unregistered') {
      const registeredInstIds = new Set(registrations.map(r => r.institutionId));
      let unregisteredInsts = institutions.filter(i => !registeredInstIds.has(i.id));
      
      if (filterValue !== 'all') {
        unregisteredInsts = unregisteredInsts.filter(i => i.zone === filterValue);
      }

      unregisteredInsts.forEach(inst => {
        data.push({
          'Institution Name': inst.name,
          'Zone': inst.zone || 'N/A',
          'District': inst.district || 'N/A'
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `CSWC_${reportType}_Report.xlsx`);
  };

  const renderReportContent = () => {
    if (!filterValue) return <div className={styles.emptyReport}>Select a filter to generate the report.</div>;

    if (reportType === 'center') {
      const center = centers.find(c => c.id === filterValue);
      const assignedZoneNames = center?.assignedZones?.map((zoneId: string) => {
        const z = zones.find(z => z.id === zoneId);
        return z?.name;
      }).filter(Boolean) || [];

      const filteredRegs = registrations.filter(r => r.centerId === filterValue || assignedZoneNames.includes(r.zone));
      let totalParticipants = 0;
      filteredRegs.forEach(r => totalParticipants += (r.participants?.length || 0));

      return (
        <div className={styles.reportData}>
          <div className={styles.reportSummary}>
            <p><strong>Meeting Center:</strong> {center?.title}</p>
            <p><strong>Date:</strong> {center?.date || 'TBD'}</p>
            <p><strong>Venue:</strong> {center?.venue || 'TBD'}</p>
            <p><strong>Total Institutions:</strong> {filteredRegs.length}</p>
            <p><strong>Total Participants:</strong> {totalParticipants}</p>
          </div>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Participants</th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegs.map(reg => {
                const inst = getInstitutionDetails(reg.institutionId);
                return (
                  <tr key={reg.id}>
                    <td><strong>{inst?.name || 'Unknown'}</strong><br/><small>{inst?.district}</small></td>
                    <td>
                      <ul className={styles.participantList}>
                        {reg.participants?.map((p: any, i: number) => (
                          <li key={i}>{p.name} <small>({p.designation})</small></li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <ul className={styles.participantList}>
                        {reg.participants?.map((p: any, i: number) => (
                          <li key={i}>{p.phone}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (reportType === 'zone') {
      const filteredRegs = registrations.filter(r => r.zone === filterValue);
      let totalParticipants = 0;
      filteredRegs.forEach(r => totalParticipants += (r.participants?.length || 0));

      return (
        <div className={styles.reportData}>
          <div className={styles.reportSummary}>
            <p><strong>Zone:</strong> {filterValue}</p>
            <p><strong>Total Institutions:</strong> {filteredRegs.length}</p>
            <p><strong>Total Participants:</strong> {totalParticipants}</p>
          </div>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Institution</th>
                <th>District</th>
                <th>Participants Count</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegs.map(reg => {
                const inst = getInstitutionDetails(reg.institutionId);
                return (
                  <tr key={reg.id}>
                    <td>{inst?.name || 'Unknown'}</td>
                    <td>{inst?.district}</td>
                    <td>{reg.participants?.length || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'district') {
      const districtInsts = institutions.filter(i => i.district === filterValue).map(i => i.id);
      const filteredRegs = registrations.filter(r => districtInsts.includes(r.institutionId));
      let totalParticipants = 0;
      filteredRegs.forEach(r => totalParticipants += (r.participants?.length || 0));

      return (
        <div className={styles.reportData}>
          <div className={styles.reportSummary}>
            <p><strong>District:</strong> {filterValue}</p>
            <p><strong>Total Institutions:</strong> {filteredRegs.length}</p>
            <p><strong>Total Participants:</strong> {totalParticipants}</p>
          </div>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Zone</th>
                <th>Participants Count</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegs.map(reg => {
                const inst = getInstitutionDetails(reg.institutionId);
                return (
                  <tr key={reg.id}>
                    <td>{inst?.name || 'Unknown'}</td>
                    <td>{reg.zone}</td>
                    <td>{reg.participants?.length || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'institution') {
      const reg = registrations.find(r => r.institutionId === filterValue);
      const inst = getInstitutionDetails(filterValue);
      
      if (!reg) return <div className={styles.emptyReport}>No registration found for this institution.</div>;

      return (
        <div className={styles.reportData}>
          <div className={styles.reportSummary}>
            <p><strong>Institution:</strong> {inst?.name}</p>
            <p><strong>Zone:</strong> {inst?.zone}</p>
            <p><strong>District:</strong> {inst?.district}</p>
            <p><strong>Total Participants:</strong> {reg.participants?.length || 0}</p>
          </div>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {reg.participants?.map((p: any, i: number) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.designation}</td>
                  <td>{p.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'unregistered') {
      const registeredInstIds = new Set(registrations.map(r => r.institutionId));
      let unregisteredInsts = institutions.filter(i => !registeredInstIds.has(i.id));
      
      if (filterValue !== 'all') {
        unregisteredInsts = unregisteredInsts.filter(i => i.zone === filterValue);
      }

      return (
        <div className={styles.reportData}>
          <div className={styles.reportSummary}>
            <p><strong>Report:</strong> Unregistered Institutions</p>
            <p><strong>Filter:</strong> {filterValue === 'all' ? 'All Zones' : filterValue}</p>
            <p><strong>Total Unregistered:</strong> {unregisteredInsts.length}</p>
          </div>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Institution Name</th>
                <th>Zone</th>
                <th>District</th>
              </tr>
            </thead>
            <tbody>
              {unregisteredInsts.length > 0 ? unregisteredInsts.map((inst, i) => (
                <tr key={i}>
                  <td>{inst.name}</td>
                  <td>{inst.zone || 'N/A'}</td>
                  <td>{inst.district || 'N/A'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>All institutions in this filter have registered!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  const getUniqueDistricts = () => {
    const dists = new Set<string>();
    institutions.forEach(i => {
      if (i.district) dists.add(i.district);
    });
    return Array.from(dists).sort();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports & Analytics</h1>
          <p className={styles.subtitle}>Generate and export registration reports</p>
        </div>
      </div>

      <div className={styles.controlsSection}>
        <div className={styles.filters}>
          <div className={styles.inputGroup}>
            <label>Report Type</label>
            <select 
              value={reportType} 
              onChange={(e) => {
                setReportType(e.target.value);
                setFilterValue(e.target.value === 'unregistered' ? 'all' : '');
              }}
              className={styles.select}
            >
              <option value="center">Center Wise Report</option>
              <option value="zone">Zone Wise Report</option>
              <option value="district">District Wise Report</option>
              <option value="institution">Institution Wise Report</option>
              <option value="unregistered">Unregistered Institutions Report</option>
            </select>
          </div>
          
          <div className={styles.inputGroup}>
            <label>Filter By</label>
            <select 
              value={filterValue} 
              onChange={(e) => setFilterValue(e.target.value)}
              className={styles.select}
            >
              {reportType !== 'unregistered' && <option value="">-- Select --</option>}
              {reportType === 'center' && centers.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              {reportType === 'zone' && zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
              {reportType === 'district' && getUniqueDistricts().map(d => <option key={d} value={d}>{d}</option>)}
              {reportType === 'institution' && institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              {reportType === 'unregistered' && (
                <>
                  <option value="all">All Zones</option>
                  {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                </>
              )}
            </select>
          </div>
        </div>

        <div className={styles.exportActions}>
          <Button onClick={handlePrint} variant="outline" disabled={!filterValue}>
            <Printer size={18} style={{ marginRight: '8px' }} /> Print
          </Button>
          <Button onClick={handlePDFDownload} variant="outline" disabled={!filterValue}>
            <Download size={18} style={{ marginRight: '8px' }} /> PDF
          </Button>
          <Button onClick={handleExcelExport} variant="primary" disabled={!filterValue}>
            <FileSpreadsheet size={18} style={{ marginRight: '8px' }} /> Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading data...</div>
      ) : (
        <div className={styles.printArea} ref={printRef}>
          <div className={styles.printHeader}>
            <div className={styles.logoWrapper}>
              <img src="/logo.png" alt="CSWC Logo" className={styles.logoImage} />
            </div>
            <h2>Council of Samastha Women's Colleges</h2>
            <h1>Management Meet 2026</h1>
            <h3 className={styles.reportTypeTitle}>
              {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Wise Report
            </h3>
            <hr className={styles.printDivider} />
          </div>
          
          <div className={styles.reportContent}>
            {renderReportContent()}
          </div>
        </div>
      )}
    </div>
  );
}
