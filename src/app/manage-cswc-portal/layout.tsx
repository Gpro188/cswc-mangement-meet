'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, Map, Calendar, FileText, Users, BellRing, MessageSquare } from 'lucide-react';
import styles from './admin-layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/manage-cswc-portal/dashboard', icon: LayoutDashboard },
    { name: 'Institutions', path: '/manage-cswc-portal/institutions', icon: Building2 },
    { name: 'Zones', path: '/manage-cswc-portal/zones', icon: Map },
    { name: 'Meetings', path: '/manage-cswc-portal/meetings', icon: Calendar },
    { name: 'Registrations', path: '/manage-cswc-portal/registrations', icon: Users },
    { name: 'Reports', path: '/manage-cswc-portal/reports', icon: FileText },
    { name: 'Reminders', path: '/manage-cswc-portal/reminders', icon: BellRing },
    { name: 'WhatsApp Setup', path: '/manage-cswc-portal/whatsapp', icon: MessageSquare },
  ];

  return (
    <div className={styles.adminLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>CSWC Admin</h2>
        </div>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
