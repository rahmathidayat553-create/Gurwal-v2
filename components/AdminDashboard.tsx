import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface MissingRecord {
  tanggal: string;
  nama_siswa: string;
  nama_guru: string;
}

interface GroupedMissing {
  guru: string;
  items: MissingRecord[];
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    guru: 0,
    siswa: 0,
    kelas: 0,
    mapel: 0
  });
  const [loading, setLoading] = useState(true);

  // Monitoring State
  const [monitorMonth, setMonitorMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [checkPerformed, setCheckPerformed] = useState(false);
  const [missingData, setMissingData] = useState<GroupedMissing[]>([]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const { count: guruCount } = await supabase.from('guru').select('*', { count: 'exact', head: true }).neq('peran', 'ADMIN');
        const { count: siswaCount } = await supabase.from('siswa').select('*', { count: 'exact', head: true });
        const { count: kelasCount } = await supabase.from('kelas').select('*', { count: 'exact', head: true });
        const { count: mapelCount } = await supabase.from('mapel').select('*', { count: 'exact', head: true });

        setStats({
          guru: guruCount || 0,
          siswa: siswaCount || 0,
          kelas: kelasCount || 0,
          mapel: mapelCount || 0
        });
      } catch (error) {
        console.error('Error loading admin stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // --- LOGIC MONITORING ---
  const handleCheckCompleteness = async () => {
      setMonitorLoading(true);
      setCheckPerformed(false);
      setMissingData([]);

      try {
          // 1. Get Settings (Hari Sekolah)
          const { data: sekolah } = await supabase.from('sekolah').select('hari_sekolah').limit(1).maybeSingle();
          const hariSekolah = sekolah?.hari_sekolah || 5;

          // 2. Define Date Boundaries (Strict String Logic to avoid Timezone shifts)
          const [yearStr, monthStr] = monitorMonth.split('-'); // e.g., "2026", "01"
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);

          // Awal Bulan (YYYY-MM-01)
          const startDateStr = `${yearStr}-${monthStr}-01`;

          // Akhir Bulan (YYYY-MM-LastDay)
          const lastDayOfMonth = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
          const endDateStr = `${yearStr}-${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

          // Hari Ini (YYYY-MM-DD)
          const todayStr = new Date().toISOString().split('T')[0];

          // Tentukan Batas Akhir Pengecekan (Check Until)
          // Default: Akhir Bulan
          let checkUntilStr = endDateStr;

          // Jika Hari Ini LEBIH KECIL dari Akhir Bulan (artinya kita sedang di tengah bulan tsb atau bulan sebelumnya)
          // Maka batasi sampai Hari Ini.
          // Tapi HANYA JIKA Hari Ini >= Awal Bulan (jangan mundur ke bulan sebelumnya jika user pilih bulan depan)
          if (todayStr < endDateStr) {
              checkUntilStr = todayStr;
          }

          // --- GUARD CLAUSE / VALIDASI TAMBAHAN ---
          // Jika batas akhir pengecekan (misal Hari Ini: 26 Jan) LEBIH KECIL dari Tanggal Awal Bulan yg dipilih (misal: 1 Feb)
          // Artinya Admin memilih bulan masa depan.
          // Maka: Stop proses, return kosong.
          if (checkUntilStr < startDateStr) {
              setCheckPerformed(true);
              setMonitorLoading(false);
              setMissingData([]); // Hasil kosong valid
              return;
          }

          // 3. Get Holidays (Strictly within range)
          const { data: holidays } = await supabase
            .from('kalender_pendidikan')
            .select('tanggal')
            .gte('tanggal', startDateStr)
            .lte('tanggal', checkUntilStr);
          
          const holidaySet = new Set(holidays?.map(h => h.tanggal));

          // 4. Generate Valid Active Days
          const validDates: string[] = [];
          
          // Loop Date object (set jam 12 siang untuk aman dari shifting)
          let current = new Date(year, month - 1, 1, 12, 0, 0); 
          // Parse checkUntilStr untuk limit loop
          const checkUntilDate = new Date(checkUntilStr + 'T12:00:00');

          while (current <= checkUntilDate) {
              const day = current.getDay(); // 0=Sun, 6=Sat
              const dateStr = current.toISOString().split('T')[0];

              let isSchoolDay = true;
              if (day === 0) isSchoolDay = false; // Minggu Libur
              if (hariSekolah === 5 && day === 6) isSchoolDay = false; // Sabtu Libur jika 5 hari
              
              if (isSchoolDay && !holidaySet.has(dateStr)) {
                  validDates.push(dateStr);
              }
              
              current.setDate(current.getDate() + 1);
          }

          if (validDates.length === 0) {
              setCheckPerformed(true);
              setMonitorLoading(false);
              return;
          }

          // 5. Get All Assignments (Siswa & Guru Wali)
          const { data: assignments } = await supabase
            .from('bimbingan')
            .select('id_siswa, id_guru, siswa(nama), guru(nama)');

          if (!assignments || assignments.length === 0) {
              setCheckPerformed(true);
              setMonitorLoading(false);
              return;
          }

          // 6. Get Existing Attendance (STRICT QUERY BOUNDARIES)
          // Pastikan query dibatasi gte(startDateStr) agar data bulan sebelumnya TIDAK bocor.
          const { data: attendance } = await supabase
            .from('kehadiran')
            .select('id_siswa, tanggal')
            .gte('tanggal', validDates[0]) // Minimal tanggal valid pertama
            .lte('tanggal', validDates[validDates.length - 1]); // Maksimal tanggal valid terakhir

          // Buat Set untuk lookup cepat: "YYYY-MM-DD_ID_SISWA"
          const attendanceSet = new Set(attendance?.map(a => `${a.tanggal}_${a.id_siswa}`));

          // 7. Cross Check
          const missing: MissingRecord[] = [];

          // Loop Tanggal Aktif -> Loop Siswa Binaan
          validDates.forEach(date => {
              // @ts-ignore
              assignments.forEach((b: any) => {
                  const key = `${date}_${b.id_siswa}`;
                  if (!attendanceSet.has(key)) {
                      missing.push({
                          tanggal: date,
                          nama_siswa: b.siswa?.nama || 'Unknown',
                          nama_guru: b.guru?.nama || 'Unknown'
                      });
                  }
              });
          });

          // 8. Grouping by Guru
          const groupedMap = new Map<string, MissingRecord[]>();
          missing.forEach(item => {
              if (!groupedMap.has(item.nama_guru)) {
                  groupedMap.set(item.nama_guru, []);
              }
              groupedMap.get(item.nama_guru)?.push(item);
          });

          // Sort by Date inside groups
          const groupedResult: GroupedMissing[] = [];
          groupedMap.forEach((items, guru) => {
              items.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
              groupedResult.push({ guru, items });
          });

          // Sort Groups by Guru Name
          groupedResult.sort((a, b) => a.guru.localeCompare(b.guru));

          setMissingData(groupedResult);
          setCheckPerformed(true);

      } catch (error) {
          console.error("Error monitoring:", error);
      } finally {
          setMonitorLoading(false);
      }
  };

  const Card = ({ title, count, color, icon }: any) => (
    <div className={`bg-gray-800 p-6 rounded-lg shadow border-l-4 ${color} flex items-center justify-between`}>
      <div>
        <h3 className="text-gray-400 text-sm font-medium uppercase">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{loading ? '...' : count}</p>
      </div>
      <div className="text-3xl opacity-50">{icon}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Dashboard Administrator</h2>
        <p className="text-gray-400">Ringkasan data sistem dan alat monitoring.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Guru" count={stats.guru} icon="👩‍🏫" color="border-blue-500" />
        <Card title="Total Siswa" count={stats.siswa} icon="🎓" color="border-green-500" />
        <Card title="Jumlah Kelas" count={stats.kelas} icon="🏫" color="border-purple-500" />
        <Card title="Mata Pelajaran" count={stats.mapel} icon="📘" color="border-yellow-500" />
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h3 className="text-xl font-bold text-white">📡 Monitoring Kelengkapan Absensi</h3>
                <p className="text-gray-400 text-sm mt-1">Cek guru wali yang belum mengisi absensi pada hari aktif.</p>
            </div>
            <div className="flex gap-2">
                <input 
                    type="month" 
                    value={monitorMonth}
                    onChange={(e) => setMonitorMonth(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
                <button 
                    onClick={handleCheckCompleteness} 
                    disabled={monitorLoading}
                    className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded font-bold shadow-lg disabled:opacity-50 text-sm flex items-center gap-2"
                >
                    {monitorLoading ? 'Memeriksa...' : '🔍 Cek Kelengkapan'}
                </button>
            </div>
        </div>

        {checkPerformed && (
            <div className="mt-6 animate-fade-in">
                {missingData.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-green-500/30 rounded-lg bg-green-500/10">
                        <span className="text-4xl block mb-2">✅</span>
                        <h4 className="text-lg font-bold text-green-400">Semua Data Lengkap!</h4>
                        <p className="text-green-200/70 text-sm">Tidak ditemukan kekosongan absensi pada periode ini.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg flex justify-between items-center">
                            <span className="text-red-300 font-bold">⚠️ Ditemukan data kosong pada {missingData.length} guru wali.</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {missingData.map((group, idx) => (
                                <div key={idx} className="bg-gray-900 p-4 rounded border border-gray-700">
                                    <h5 className="font-bold text-white border-b border-gray-700 pb-2 mb-2">{group.guru}</h5>
                                    <ul className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                        {group.items.map((item, i) => (
                                            <li key={i} className="text-sm text-gray-400 flex justify-between">
                                                <span>{item.tanggal}</span>
                                                <span className="text-red-400">{item.nama_siswa} (Kosong)</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
