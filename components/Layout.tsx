import React, { useState } from 'react';
import { ViewState, Guru } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useSekolah } from '../hooks/useSekolah';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: Guru | null;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, currentView, onChangeView, onLogout }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const sekolah = useSekolah(); // Use centralized hook

  const adminMenu: { id: ViewState; label: string; icon: string }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'GURU', label: 'Data Guru', icon: '👩‍🏫' },
    { id: 'SISWA', label: 'Data Siswa', icon: '🎓' },
    { id: 'KELAS', label: 'Data Kelas', icon: '🏫' },
    { id: 'MAPEL', label: 'Mata Pelajaran', icon: '📘' },
    { id: 'KALENDER_PENDIDIKAN', label: 'Kalender Akademik', icon: '📅' },
    { id: 'ANGGOTA_GURWAL', label: 'Anggota GurWal', icon: '🤝' },
    { id: 'INPUT_KEHADIRAN_ADMIN', label: 'Input Kehadiran', icon: '📝' },
    { id: 'REKAP_KEHADIRAN', label: 'Rekap Kehadiran', icon: '📊' },
    { id: 'DATA_PENGAJAR', label: 'Data Pengajar', icon: '📚' },
    { id: 'PENGATURAN_SEKOLAH', label: 'Pengaturan Sekolah', icon: '🏫' },
  ];

  // Unified Guru Menu (Combines Wali & Pengajar)
  const guruMenu = [
    { type: 'link', id: 'GURU_DASHBOARD', label: 'Dashboard', icon: '🏠' },
    
    { type: 'header', label: 'BINAAN (WALI KELAS)' },
    { type: 'link', id: 'GURU_BINAAN_LIST', label: 'Daftar Binaan', icon: '👩‍🎓' },
    { type: 'link', id: 'GURU_BINAAN_KEHADIRAN', label: 'Kehadiran', icon: '🗓️' },
    { type: 'link', id: 'GURU_IMPORT_KEHADIRAN', label: 'Import Kehadiran (Custom)', icon: '📥' },
    { type: 'link', id: 'GURU_BINAAN_PELANGGARAN', label: 'Pelanggaran', icon: '⚠️' },
    { type: 'link', id: 'GURU_BINAAN_PRESTASI', label: 'Prestasi', icon: '🏅' },
    { type: 'link', id: 'GURU_BINAAN_LAPORAN', label: 'Laporan Binaan', icon: '📊' },

    { type: 'header', label: 'PENGAJARAN (MAPEL)' },
    { type: 'link', id: 'GURU_PENGAJAR_JADWAL', label: 'Kelas Ajar', icon: '📚' },
    { type: 'link', id: 'GURU_PENGAJAR_NILAI', label: 'Input Nilai', icon: '📝' },
    { type: 'link', id: 'GURU_PENGAJAR_REKAP', label: 'Rekap Nilai', icon: '📈' },
  ];

  const isAdmin = currentUser?.peran === 'ADMIN';

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 shadow-md hidden md:flex flex-col border-r border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            {sekolah.logo_url ? (
                <img src={sekolah.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded bg-white/10 p-1" />
            ) : (
                <span className="text-3xl">🏫</span>
            )}
            <div>
                 <h1 className="text-sm font-bold text-white uppercase leading-tight line-clamp-2">
                    {sekolah.nama || 'GurWal System'}
                 </h1>
                 <p className="text-[10px] text-gray-400">Sistem Informasi</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm font-semibold text-white truncate">{currentUser?.nama}</p>
            <p className="text-xs text-primary font-medium mt-0.5">
              {isAdmin ? 'Administrator' : 'Guru'}
            </p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {isAdmin ? (
            adminMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                  currentView === item.id
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))
          ) : (
            guruMenu.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <div key={idx} className="pt-4 pb-1 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {item.label}
                  </div>
                );
              }
              // Link
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeView(item.id as ViewState)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                    currentView === item.id
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })
          )}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"
          >
            <span>🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-900">
        {/* Mobile Header */}
        <header className="bg-gray-800 shadow-sm md:hidden p-4 flex justify-between items-center z-10 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {sekolah.logo_url && <img src={sekolah.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded bg-white/10 p-1" />}
            <h1 className="text-lg font-bold text-white truncate max-w-[200px]">{sekolah.nama || 'GurWal'}</h1>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="text-sm text-red-400 font-medium">Logout</button>
        </header>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={showLogoutConfirm}
        message="Apakah Anda yakin ingin keluar dari aplikasi?"
        onConfirm={() => {
            setShowLogoutConfirm(false);
            onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};