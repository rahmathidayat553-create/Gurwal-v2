import React, { useState, useRef, useEffect } from 'react';
import { ViewState, Guru } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { useSekolah } from '../hooks/useSekolah';
import { NotificationItem } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: Guru | null;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  notifications: NotificationItem[];
  onClearNotifications: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
    children, 
    currentUser, 
    currentView, 
    onChangeView, 
    onLogout,
    notifications,
    onClearNotifications
}) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const sekolah = useSekolah();

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifRef]);

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
  const unreadCount = notifications.filter(n => !n.read).length;

  const getPageTitle = (view: ViewState) => {
      const allItems = [...adminMenu, ...guruMenu.filter(m => m.type === 'link')];
      // @ts-ignore
      const found = allItems.find(i => i.id === view);
      return found ? found.label : 'Dashboard';
  };

  const NotificationDropdown = () => (
      <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 animate-bounce-in origin-top-right">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
              <h3 className="text-sm font-bold text-white">Notifikasi</h3>
              {notifications.length > 0 && (
                  <button 
                    onClick={onClearNotifications}
                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                      Hapus Semua
                  </button>
              )}
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                      <span className="text-2xl block mb-1">🔕</span>
                      Tidak ada notifikasi baru
                  </div>
              ) : (
                  notifications.map((notif) => (
                      <div key={notif.id} className="p-3 border-b border-gray-700/50 hover:bg-gray-700/50 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  notif.type === 'success' ? 'bg-green-900 text-green-200' :
                                  notif.type === 'error' ? 'bg-red-900 text-red-200' :
                                  'bg-blue-900 text-blue-200'
                              }`}>
                                  {notif.title}
                              </span>
                              <span className="text-[10px] text-gray-500">{notif.time}</span>
                          </div>
                          <p className="text-sm text-gray-300 leading-snug">{notif.message}</p>
                      </div>
                  ))
              )}
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-gray-800 shadow-md hidden md:flex flex-col border-r border-gray-700 z-30">
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
                    ? 'bg-primary text-white shadow-lg shadow-indigo-900/50'
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
                      ? 'bg-primary text-white shadow-lg shadow-indigo-900/50'
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-900 relative">
        
        {/* Header Desktop (NEW) */}
        <header className="hidden md:flex bg-gray-800 border-b border-gray-700 h-16 items-center justify-between px-8 shadow-md z-20">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <span className="text-primary opacity-80">
                   {/* Icon based on view? Simplification: Just generic icon */}
                   📂
               </span>
               {getPageTitle(currentView)}
            </h2>

            <div className="flex items-center gap-6">
                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative p-2 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-700 focus:outline-none"
                    >
                        <span className="text-xl">🔔</span>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                        )}
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-800"></span>
                        )}
                    </button>
                    {isNotifOpen && <NotificationDropdown />}
                </div>

                {/* Profile Mini */}
                <div className="flex items-center gap-3 pl-6 border-l border-gray-700">
                    <div className="text-right hidden lg:block">
                        <p className="text-sm font-bold text-white leading-none">{currentUser?.nama}</p>
                        <p className="text-xs text-gray-400 mt-1">{currentUser?.nip || 'No ID'}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                        {currentUser?.nama?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>
        </header>

        {/* Header Mobile (UPDATED) */}
        <header className="bg-gray-800 shadow-sm md:hidden p-4 flex justify-between items-center z-20 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {sekolah.logo_url && <img src={sekolah.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded bg-white/10 p-1" />}
            <h1 className="text-lg font-bold text-white truncate max-w-[150px]">{sekolah.nama || 'GurWal'}</h1>
          </div>
          
          <div className="flex items-center gap-3">
              {/* Notification Bell Mobile */}
              <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative p-1 text-gray-300"
                    >
                        <span className="text-xl">🔔</span>
                        {unreadCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>
                    {isNotifOpen && (
                        <div className="absolute right-[-50px] top-10 w-[300px]">
                            <NotificationDropdown />
                        </div>
                    )}
              </div>

              <button onClick={() => setShowLogoutConfirm(true)} className="text-sm text-red-400 font-medium border border-red-900/50 px-3 py-1 rounded bg-red-900/10">
                  Logout
              </button>
          </div>
        </header>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
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