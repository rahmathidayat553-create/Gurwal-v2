import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Added import
import { Layout } from './components/Layout';
import { Login } from './components/Login';
// Admin Components
import { AdminDashboard } from './components/AdminDashboard';
import { CrudGuru } from './components/CrudGuru';
import { CrudSiswa } from './components/CrudSiswa';
import { CrudKelas } from './components/CrudKelas';
import { CrudMapel } from './components/CrudMapel';
import { CrudKalender } from './components/CrudKalender'; // NEW IMPORT
import { CrudAnggotaGurwal } from './components/CrudAnggotaGurwal';
import { CrudDataPengajar } from './components/CrudDataPengajar';
import { CrudSekolah } from './components/CrudSekolah';
import { RekapKehadiranAdmin } from './components/RekapKehadiranAdmin';
import { InputKehadiranAdmin } from './components/InputKehadiranAdmin'; 

// Unified Guru Components
import { GuruDashboard } from './components/GuruDashboard';
// Binaan
import { DaftarBinaan } from './components/GuruBinaan/DaftarBinaan';
import { KehadiranBinaan } from './components/GuruBinaan/KehadiranBinaan';
import { ImportKehadiranTemplate } from './components/GuruBinaan/ImportKehadiranTemplate';
import { PelanggaranBinaan } from './components/GuruBinaan/PelanggaranBinaan';
import { PrestasiBinaan } from './components/GuruBinaan/PrestasiBinaan';
import { LaporanBinaan } from './components/GuruBinaan/LaporanBinaan';
// Pengajar
import { DaftarKelasAjar } from './components/GuruPengajar/DaftarKelasAjar';
import { InputNilai } from './components/GuruPengajar/InputNilai';
import { RekapNilai } from './components/GuruPengajar/RekapNilai';

import { Toast } from './components/Toast';
import { Guru, ViewState } from './types';

interface ToastState {
  message: string;
  type: 'success' | 'error';
  duration?: number;
  position?: 'top-right' | 'center';
}

function App() {
  const [session, setSession] = useState<Guru | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    // Check localStorage for persisted session
    const storedUser = localStorage.getItem('gurwal_admin_user');
    const storedView = localStorage.getItem('gurwal_current_view') as ViewState;

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setSession(user);
        
        if (storedView) {
          setCurrentView(storedView);
        } else {
          // Default views
          if (user.peran === 'ADMIN') setCurrentView('DASHBOARD');
          else setCurrentView('GURU_DASHBOARD');
        }
      } catch (e) {
        localStorage.removeItem('gurwal_admin_user');
        localStorage.removeItem('gurwal_current_view');
      }
    }
  }, []);

  // GLOBAL REALTIME ACTIVITY NOTIFICATION (Only for ADMIN)
  useEffect(() => {
    if (session?.peran === 'ADMIN') {
       const channel = supabase
        .channel('global_toast_activity')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kehadiran' }, async (payload) => {
            // Fetch detailed info for the toast message
            // payload.new contains the raw inserted row
            const { data } = await supabase
              .from('kehadiran')
              .select('status, guru(nama), siswa(nama)')
              .eq('id', payload.new.id)
              .single();

            if (data) {
                // @ts-ignore
                const guruName = data.guru?.nama || 'Seorang Guru';
                // @ts-ignore
                const siswaName = data.siswa?.nama || 'Siswa';
                const status = data.status;

                // Trigger Toast
                showToast(
                    `🔔 Aktivitas Baru:\n${guruName} menginput ${siswaName} (${status})`, 
                    'success', 
                    5000
                );
            }
        })
        .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [session]);

  const handleLoginSuccess = (user: Guru) => {
    setSession(user);
    localStorage.setItem('gurwal_admin_user', JSON.stringify(user));
    
    let defaultView: ViewState = 'DASHBOARD';
    if (user.peran !== 'ADMIN') defaultView = 'GURU_DASHBOARD';
    
    setCurrentView(defaultView);
    localStorage.setItem('gurwal_current_view', defaultView);
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('gurwal_admin_user');
    localStorage.removeItem('gurwal_current_view');
    showToast('Anda telah keluar', 'success');
  };

  const handleChangeView = (view: ViewState) => {
    setCurrentView(view);
    localStorage.setItem('gurwal_current_view', view);
  };

  const showToast = (
    message: string, 
    type: 'success' | 'error', 
    duration: number = 3000, 
    position: 'top-right' | 'center' = 'top-right'
  ) => {
    setToast({ message, type, duration, position });
  };

  // Render Logic
  if (!session) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            position={toast.position}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      // ADMIN
      case 'GURU': return <CrudGuru showToast={showToast} />;
      case 'SISWA': return <CrudSiswa showToast={showToast} />;
      case 'KELAS': return <CrudKelas showToast={showToast} />;
      case 'MAPEL': return <CrudMapel showToast={showToast} />;
      case 'KALENDER_PENDIDIKAN': return <CrudKalender showToast={showToast} />; // NEW CASE
      case 'ANGGOTA_GURWAL': return <CrudAnggotaGurwal showToast={showToast} />;
      case 'DATA_PENGAJAR': return <CrudDataPengajar showToast={showToast} />;
      case 'PENGATURAN_SEKOLAH': return <CrudSekolah showToast={showToast} />;
      case 'INPUT_KEHADIRAN_ADMIN': return <InputKehadiranAdmin currentUser={session} showToast={showToast} />; 
      case 'REKAP_KEHADIRAN': return <RekapKehadiranAdmin showToast={showToast} />;
      case 'DASHBOARD': return <AdminDashboard />;
      
      // UNIFIED GURU
      case 'GURU_DASHBOARD': return <GuruDashboard currentUser={session} />;
      
      // BINAAN (WALI)
      case 'GURU_BINAAN_LIST': return <DaftarBinaan currentUser={session} showToast={showToast} />;
      case 'GURU_BINAAN_KEHADIRAN': return <KehadiranBinaan currentUser={session} showToast={showToast} />;
      case 'GURU_IMPORT_KEHADIRAN': return <ImportKehadiranTemplate currentUser={session} showToast={showToast} />;
      case 'GURU_BINAAN_PELANGGARAN': return <PelanggaranBinaan currentUser={session} showToast={showToast} />;
      case 'GURU_BINAAN_PRESTASI': return <PrestasiBinaan currentUser={session} showToast={showToast} />;
      case 'GURU_BINAAN_LAPORAN': return <LaporanBinaan currentUser={session} />;
      
      // PENGAJAR
      case 'GURU_PENGAJAR_JADWAL': return <DaftarKelasAjar currentUser={session} />;
      case 'GURU_PENGAJAR_NILAI': return <InputNilai currentUser={session} showToast={showToast} />;
      case 'GURU_PENGAJAR_REKAP': return <RekapNilai currentUser={session} />;
        
      default:
        return <div className="p-6 text-white">Halaman tidak ditemukan</div>;
    }
  };

  return (
    <Layout
      currentUser={session}
      currentView={currentView}
      onChangeView={handleChangeView}
      onLogout={handleLogout}
    >
      {renderContent()}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          position={toast.position}
          onClose={() => setToast(null)}
        />
      )}
    </Layout>
  );
}

export default App;