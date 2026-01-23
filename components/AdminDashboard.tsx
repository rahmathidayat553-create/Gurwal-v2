import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface ActivityLog {
  id: string;
  created_at: string;
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA';
  siswa: { nama: string };
  guru: { nama: string };
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ guru: 0, siswa: 0, kelas: 0, mapel: 0 });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchActivities();
    
    // Realtime Subscription for Activities
    const channel = supabase
      .channel('dashboard_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kehadiran' }, (payload) => {
         // When new attendance is inserted, fetch specific details to update UI
         fetchNewActivity(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [guru, siswa, kelas, mapel] = await Promise.all([
        supabase.from('guru').select('*', { count: 'exact', head: true }),
        supabase.from('siswa').select('*', { count: 'exact', head: true }),
        supabase.from('kelas').select('*', { count: 'exact', head: true }),
        supabase.from('mapel').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        guru: guru.count || 0,
        siswa: siswa.count || 0,
        kelas: kelas.count || 0,
        mapel: mapel.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    // Get start of yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const dateStr = yesterday.toISOString();

    const { data } = await supabase
      .from('kehadiran')
      .select('id, created_at, status, siswa(nama), guru(nama)')
      .gte('created_at', dateStr)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
        // @ts-ignore
        setActivities(data);
    }
  };

  const fetchNewActivity = async (id: string) => {
      const { data } = await supabase
        .from('kehadiran')
        .select('id, created_at, status, siswa(nama), guru(nama)')
        .eq('id', id)
        .single();
      
      if (data) {
          // @ts-ignore
          setActivities(prev => [data, ...prev].slice(0, 10));
      }
  };

  const timeAgo = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Baru saja';
      const minutes = Math.floor(diffInSeconds / 60);
      if (minutes < 60) return `${minutes} menit lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam lalu`;
      return 'Kemarin';
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'HADIR': return 'bg-green-500/20 text-green-400 border-green-500/50';
          case 'SAKIT': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
          case 'IZIN': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
          case 'ALPHA': return 'bg-red-500/20 text-red-400 border-red-500/50';
          default: return 'bg-gray-500/20 text-gray-400';
      }
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'HADIR': return '✅';
          case 'SAKIT': return '🤒';
          case 'IZIN': return '📩';
          case 'ALPHA': return '❌';
          default: return '❓';
      }
  };

  const StatCard = ({ title, count, icon, color }: any) => (
    <div className={`bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden group hover:border-gray-500 transition-all duration-300`}>
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform scale-150`}>
         <span className="text-6xl">{icon}</span>
      </div>
      <div>
        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">{title}</h3>
        <p className="text-4xl font-extrabold text-white mt-2">{loading ? '...' : count}</p>
      </div>
      <div className={`mt-4 h-1 w-full rounded bg-gray-700`}>
         <div className={`h-1 rounded ${color.replace('border-', 'bg-')} w-1/2`}></div>
      </div>
    </div>
  );

  return (
    <div className="p-2 md:p-6 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h2>
        <p className="text-gray-400 mt-1">Ringkasan data statistik dan aktivitas sistem.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Guru" count={stats.guru} icon="👩‍🏫" color="border-indigo-500" />
        <StatCard title="Total Siswa" count={stats.siswa} icon="🎓" color="border-green-500" />
        <StatCard title="Total Kelas" count={stats.kelas} icon="🏫" color="border-yellow-500" />
        <StatCard title="Mata Pelajaran" count={stats.mapel} icon="📘" color="border-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: System Status */}
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Status Server
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                        <span className="text-gray-400 text-sm">Database</span>
                        <span className="text-green-400 text-xs font-bold bg-green-900/30 px-2 py-1 rounded">ONLINE</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                        <span className="text-gray-400 text-sm">Realtime Listener</span>
                        <span className="text-green-400 text-xs font-bold bg-green-900/30 px-2 py-1 rounded">ACTIVE</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                        <span className="text-gray-400 text-sm">Versi Aplikasi</span>
                        <span className="text-blue-400 text-xs font-bold">v1.0.0</span>
                    </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-xl border border-indigo-700 shadow-lg text-white">
                  <h3 className="font-bold text-lg mb-2">👋 Halo, Admin!</h3>
                  <p className="text-indigo-200 text-sm mb-4">
                      Jangan lupa untuk memeriksa data kehadiran siswa secara berkala.
                  </p>
                  <button className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-semibold transition">
                      Lihat Laporan Lengkap
                  </button>
              </div>
          </div>

          {/* Right Column: Activity Feed */}
          <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col h-full max-h-[500px]">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 sticky top-0 z-10 backdrop-blur-sm rounded-t-xl">
                      <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              ⚡ Aktivitas Terbaru
                          </h3>
                          <p className="text-xs text-gray-400 mt-1">Monitor input kehadiran (Hari ini & Kemarin)</p>
                      </div>
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full border border-gray-600">
                          Live Updates
                      </span>
                  </div>

                  <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {activities.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                              <span className="text-3xl mb-2">💤</span>
                              <p className="text-sm">Belum ada aktivitas baru.</p>
                          </div>
                      ) : (
                          activities.map((act) => (
                              <div key={act.id} className="flex items-start gap-4 p-4 rounded-lg bg-gray-700/20 hover:bg-gray-700/40 border border-gray-700/50 transition-all duration-200 animate-slide-in">
                                  {/* Icon Avatar */}
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-gray-700 border border-gray-600 shadow-sm`}>
                                      {getStatusIcon(act.status)}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start">
                                          <p className="text-sm text-gray-200 leading-snug">
                                              <span className="font-bold text-blue-400">{act.guru?.nama || 'Guru'}</span>
                                              <span className="text-gray-400 mx-1">menginput</span>
                                              <span className="font-bold text-white">{act.siswa?.nama || 'Siswa'}</span>
                                          </p>
                                          <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap ml-2">
                                              {timeAgo(act.created_at)}
                                          </span>
                                      </div>
                                      <div className="mt-2 flex items-center gap-2">
                                          <span className={`text-[10px] px-2 py-0.5 rounded border ${getStatusColor(act.status)} font-bold`}>
                                              {act.status}
                                          </span>
                                          <span className="text-[10px] text-gray-500">
                                              • {new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                  
                  <div className="p-3 border-t border-gray-700 text-center bg-gray-800/50 rounded-b-xl">
                      <p className="text-[10px] text-gray-500">Menampilkan 10 aktivitas terakhir</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};