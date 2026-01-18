import React, { useState } from 'react';
import { ViewState, Guru } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: Guru | null;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentUser, currentView, onChangeView, onLogout }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const adminMenu: { id: ViewState; label: string; icon: string }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'GURU', label: 'Data Guru', icon: '👩‍🏫' },
    { id: 'SISWA', label: 'Data Siswa', icon: '🎓' },
    { id: 'KELAS', label: 'Data Kelas', icon: '🏫' },
    { id: 'MAPEL', label: 'Mata Pelajaran', icon: '📘' },
    { id: 'ANGGOTA_GURWAL', label: 'Anggota GurWal', icon: '🤝' },
    { id: 'DATA_PENGAJAR', label: 'Data Pengajar', icon: '📚' },
  ];

  // Unified Guru Menu (Combines Wali & Pengajar)
  const guruMenu = [
    { type: 'link', id: 'GURU_DASHBOARD', label: 'Dashboard', icon: '🏠' },
    
    { type: 'header', label: 'BINAAN (WALI KELAS)' },
    { type: 'link', id: 'GURU_BINAAN_LIST', label: 'Daftar Binaan', icon: '👩‍🎓' },
    { type: 'link', id: 'GURU_BINAAN_KEHADIRAN', label: 'Kehadiran', icon: '🗓️' },
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
          <h1 className="text-xl font-bold text-primary">GurWal System</h1>
          <div className="mt-2">
            <p className="text-sm font-semibold text-white">{currentUser?.nama}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAdmin ? 'Administrator' : 'Guru'}
            </p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
          <h1 className="text-lg font-bold text-primary">GurWal</h1>
          <button onClick={() => setShowLogoutConfirm(true)} className="text-sm text-red-400">Logout</button>
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