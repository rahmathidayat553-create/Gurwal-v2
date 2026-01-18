import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ guru: 0, siswa: 0, kelas: 0, mapel: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchStats();
  }, []);

  const StatCard = ({ title, count, icon, color }: any) => (
    <div className={`bg-gray-800 p-6 rounded-lg shadow border-l-4 ${color} flex items-center justify-between`}>
      <div>
        <h3 className="text-gray-400 text-sm font-medium uppercase">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{loading ? '...' : count}</p>
      </div>
      <div className="text-4xl opacity-50">{icon}</div>
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold text-white mb-6">Dashboard Admin</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Guru" count={stats.guru} icon="👩‍🏫" color="border-indigo-500" />
        <StatCard title="Total Siswa" count={stats.siswa} icon="🎓" color="border-green-500" />
        <StatCard title="Total Kelas" count={stats.kelas} icon="🏫" color="border-yellow-500" />
        <StatCard title="Mata Pelajaran" count={stats.mapel} icon="📘" color="border-red-500" />
      </div>

      <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Status Sistem</h3>
        <p className="text-green-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Database Terhubung & Online
        </p>
      </div>
    </div>
  );
};