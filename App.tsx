import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
// Admin Components
import { AdminDashboard } from './components/AdminDashboard';
import { CrudGuru } from './components/CrudGuru';
import { CrudSiswa } from './components/CrudSiswa';
import { CrudKelas } from './components/CrudKelas';
import { CrudMapel } from './components/CrudMapel';
import { CrudAnggotaGurwal } from './components/CrudAnggotaGurwal';
import { CrudDataPengajar } from './components/CrudDataPengajar';

// Unified Guru Components
import { GuruDashboard } from './components/GuruDashboard';
// Binaan
import { DaftarBinaan } from './components/GuruBinaan/DaftarBinaan';
import { KehadiranBinaan } from './components/GuruBinaan/KehadiranBinaan';
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
      case 'ANGGOTA_GURWAL': return <CrudAnggotaGurwal showToast={showToast} />;
      case 'DATA_PENGAJAR': return <CrudDataPengajar showToast={showToast} />;
      case 'DASHBOARD': return <AdminDashboard />;
      
      // UNIFIED GURU
      case 'GURU_DASHBOARD': return <GuruDashboard currentUser={session} />;
      
      // BINAAN (WALI)
      case 'GURU_BINAAN_LIST': return <DaftarBinaan currentUser={session} showToast={showToast} />;
      case 'GURU_BINAAN_KEHADIRAN': return <KehadiranBinaan currentUser={session} showToast={showToast} />;
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