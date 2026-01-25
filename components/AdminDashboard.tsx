
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSekolah } from '../hooks/useSekolah';

interface ActivityLog {
  id: string;
  created_at: string;
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA';
  siswa: { nama: string };
  guru: { nama: string };
}

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
  const sekolah = useSekolah();
  const [stats, setStats] = useState({ guru: 0, siswa: 0, kelas: 0, mapel: 0 });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Monitoring State
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [monitorMonth, setMonitorMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [missingData, setMissingData] = useState<GroupedMissing[]>([]);
  const [checkPerformed, setCheckPerformed] = useState(false);

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

  // --- LOGIC MONITORING ---
  const handleCheckCompleteness = async () => {
      setMonitorLoading(true);
      setCheckPerformed(false);
      setMissingData([]);

      try {
          // 1. Get Settings (Hari Sekolah)
          const { data: sekolah } = await supabase.from('sekolah').select('hari_sekolah').limit(1).maybeSingle();
          const hariSekolah = sekolah?.hari_sekolah || 5;

          // 2. Define Date Range
          const [year, month] = monitorMonth.split('-');
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Batasi endDate tidak boleh melebihi hari ini (karena masa depan belum wajib input)
          const checkUntil = endDate > today ? today : endDate;

          // 3. Get Holidays
          const { data: holidays } = await supabase
            .from('kalender_pendidikan')
            .select('tanggal')
            .gte('tanggal', startDate.toISOString())
            .lte('tanggal', checkUntil.toISOString());
          
          const holidaySet = new Set(holidays?.map(h => h.tanggal));

          // 4. Generate Valid Active Days
          const validDates: string[] = [];
          let current = new Date(startDate);
          
          while (current <= checkUntil) {
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
          // Mengambil semua siswa yang punya guru wali
          const { data: assignments } = await supabase
            .from('bimbingan')
            .select('id_siswa, id_guru, siswa(nama), guru(nama)');

          if (!assignments || assignments.length === 0) {
              setCheckPerformed(true);
              setMonitorLoading(false);
              return;
          }

          // 6. Get Existing Attendance for this month
          // Optimasi: Hanya ambil field yang diperlukan untuk checking
          const { data: attendance } = await supabase
            .from('kehadiran')
            .select('id_siswa, tanggal')
            .gte('tanggal', validDates[0])
            .lte('tanggal', validDates[validDates.length - 1]);

          // Buat Set untuk lookup cepat: "YYYY-MM-DD_ID_SISWA"
          const attendanceSet = new Set(attendance?.map(a => `${a.tanggal}_${a.id_siswa}`));

          // 7. Cross Check
          const missing: MissingRecord[] = [];

          // Loop Tanggal Aktif -> Loop Siswa Binaan
          validDates.forEach(date => {
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

  // --- EXPORT LOGIC ---

  const getExportData = () => {
    if (missingData.length === 0) {
      return [{
        No: 1,
        Tanggal: '-',
        'Nama Siswa': '-',
        'Nama Guru Wali': '-',
        Status: 'Tidak ada data kehadiran yang belum diinput pada periode ini'
      }];
    }

    let counter = 1;
    // Flatten and Sort Globally by Guru then Date
    const flatRows: any[] = [];
    missingData.forEach(group => {
      group.items.forEach(item => {
        flatRows.push({
          No: counter++,
          Tanggal: item.tanggal,
          'Nama Siswa': item.nama_siswa,
          'Nama Guru Wali': group.guru,
          Status: 'Belum Input'
        });
      });
    });
    return flatRows;
  };

  const getPeriodLabel = () => {
    const [year, month] = monitorMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handleExportExcel = () => {
    const rows = getExportData();
    const exportDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Construct Array of Arrays for flexibility (Merging Kops)
    const wsData = [
      [(sekolah.nama || 'SEKOLAH ...').toUpperCase()],
      [`NPSN: ${sekolah.npsn || '-'} | Alamat: ${sekolah.alamat || '-'}`],
      [], // Spacing
      ['LAPORAN MONITORING KELENGKAPAN KEHADIRAN'],
      [`Periode: ${getPeriodLabel()}`],
      [`Tanggal Monitoring: ${exportDate}`],
      [],
      ['No', 'Tanggal', 'Nama Siswa', 'Nama Guru Wali', 'Status'], // Header
      ...rows.map(r => [r.No, r.Tanggal, r['Nama Siswa'], r['Nama Guru Wali'], r.Status])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add Sheet
    XLSX.utils.book_append_sheet(wb, ws, "Monitoring Kehadiran");
    XLSX.writeFile(wb, `Monitoring_Kehadiran_${monitorMonth}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // --- KOP SURAT ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text((sekolah.nama || "SEKOLAH ...").toUpperCase(), pageWidth / 2, yPos, { align: "center" });
    
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`NPSN: ${sekolah.npsn || '-'}`, pageWidth / 2, yPos, { align: "center" });
    
    yPos += 5;
    doc.text(sekolah.alamat || "Alamat Sekolah...", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(10, yPos, pageWidth - 10, yPos); 

    // --- JUDUL & METADATA ---
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN MONITORING KEHADIRAN", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const exportDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Periode Monitoring : ${getPeriodLabel()}`, 14, yPos);
    doc.text(`Tanggal Export     : ${exportDate}`, 14, yPos + 5);

    yPos += 10;

    // --- TABLE ---
    const rows = getExportData();
    const tableBody = rows.map(r => [r.No, r.Tanggal, r['Nama Siswa'], r['Nama Guru Wali'], r.Status]);

    autoTable(doc, {
        startY: yPos,
        head: [['No', 'Tanggal', 'Nama Siswa', 'Nama Guru Wali', 'Status']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [55, 65, 81] }, // Dark Gray
        styles: { fontSize: 9 },
        margin: { top: 10 }
    });

    // --- FOOTER ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Diekspor oleh Sistem GurWal', 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`Monitoring_Kehadiran_${monitorMonth}.pdf`);
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
              {/* REPLACED WELCOME CARD WITH MONITORING BUTTON */}
              <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-6 rounded-xl border border-blue-700 shadow-lg text-white">
                  <h3 className="font-bold text-lg mb-2">👋 Kontrol Kehadiran</h3>
                  <p className="text-blue-200 text-sm mb-4">
                      Cek kelengkapan input kehadiran siswa oleh Wali Kelas secara otomatis.
                  </p>
                  <button 
                    onClick={() => setIsMonitorOpen(true)}
                    className="w-full bg-white text-blue-900 py-3 rounded-lg text-sm font-bold hover:bg-blue-50 transition shadow-md flex items-center justify-center gap-2"
                  >
                      <span>🔍</span> Monitoring Kehadiran
                  </button>
              </div>

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

      {/* --- MODAL MONITORING --- */}
      {isMonitorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>🕵️</span> Monitoring Kelengkapan Input
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">Cek data kehadiran yang BELUM diinput oleh Guru Wali.</p>
                    </div>
                    <div className="flex gap-2">
                        {/* EXPORT BUTTONS (Only if Check Performed) */}
                        {checkPerformed && (
                            <>
                                <button 
                                    onClick={handleExportExcel}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition flex items-center gap-2"
                                    title="Export Excel"
                                >
                                    📊 Excel
                                </button>
                                <button 
                                    onClick={handleExportPDF}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition flex items-center gap-2"
                                    title="Export PDF"
                                >
                                    📄 PDF
                                </button>
                            </>
                        )}
                        <button 
                            onClick={() => setIsMonitorOpen(false)}
                            className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 w-8 h-8 rounded-full flex items-center justify-center transition ml-2"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                {/* Control Bar */}
                <div className="p-4 bg-gray-750 border-b border-gray-700 flex flex-col md:flex-row gap-4 items-center">
                    <input 
                        type="month"
                        value={monitorMonth}
                        onChange={(e) => setMonitorMonth(e.target.value)}
                        className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm focus:border-blue-500 outline-none w-full md:w-auto"
                    />
                    <button 
                        onClick={handleCheckCompleteness}
                        disabled={monitorLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition w-full md:w-auto justify-center"
                    >
                        {monitorLoading ? 'Memeriksa...' : '🚀 Mulai Pengecekan'}
                    </button>
                    <div className="text-xs text-gray-500 ml-auto hidden md:block text-right">
                        * Pengecekan mengecualikan hari libur & tanggal masa depan.
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-900/50">
                    {monitorLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                            <span className="text-4xl mb-3 animate-spin">⏳</span>
                            <p>Sedang memindai data kehadiran seluruh sekolah...</p>
                        </div>
                    ) : !checkPerformed ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                            <span className="text-4xl mb-3">📅</span>
                            <p>Pilih bulan dan klik tombol untuk mulai monitoring.</p>
                        </div>
                    ) : missingData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-green-400 bg-green-900/10 border border-green-900/30 rounded-lg animate-bounce-in">
                            <span className="text-5xl mb-3">🎉</span>
                            <h4 className="text-xl font-bold">Semua Lengkap!</h4>
                            <p className="text-green-300/70 text-sm mt-1">Tidak ada data kehadiran yang terlewat pada bulan ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-red-900/20 border border-red-800 p-3 rounded-lg text-red-200 text-sm flex items-center gap-2">
                                <span>⚠️</span> Ditemukan <strong>{missingData.reduce((acc, curr) => acc + curr.items.length, 0)}</strong> data belum diinput.
                            </div>

                            {missingData.map((group, idx) => (
                                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            👨‍🏫 {group.guru}
                                        </h4>
                                        <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                                            {group.items.length} Data
                                        </span>
                                    </div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-400 uppercase bg-gray-800 border-b border-gray-700">
                                            <tr>
                                                <th className="px-4 py-2">Tanggal</th>
                                                <th className="px-4 py-2">Nama Siswa</th>
                                                <th className="px-4 py-2 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {group.items.map((item, i) => (
                                                <tr key={i} className="hover:bg-gray-700/50">
                                                    <td className="px-4 py-2 text-white font-medium">
                                                        {item.tanggal}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-300">
                                                        {item.nama_siswa}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className="text-xs font-bold text-red-400 border border-red-900/50 bg-red-900/20 px-2 py-1 rounded">
                                                            Belum Input
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
