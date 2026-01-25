
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Guru, Bimbingan, Kehadiran } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface Props {
  currentUser: Guru;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Tipe Data Form Lokal
interface FormState {
  [id_siswa: string]: {
    id?: string; // ID Kehadiran (jika ada)
    status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA';
    catatan: string;
  };
}

// Tipe Info Libur
interface HolidayInfo {
  jenis: string;
  keterangan: string | null;
}

type ModeType = 'INPUT' | 'VIEW' | 'EDIT';

export const KehadiranBinaan: React.FC<Props> = ({ currentUser, showToast }) => {
  // Data Utama
  const [siswaList, setSiswaList] = useState<Bimbingan[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  
  // State UI & Logic
  const [mode, setMode] = useState<ModeType>('INPUT');
  const [formData, setFormData] = useState<FormState>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // State Hari Libur & Sekolah & Masa Depan
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);
  const [hariSekolah, setHariSekolah] = useState<number>(5); // Default 5 hari

  // Variable Today untuk batasan
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Fetch Daftar Siswa & Setting Sekolah (Sekali saat mount)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      // Fetch Siswa
      const siswaPromise = supabase
        .from('bimbingan')
        .select('*, siswa(id, nama, nisn, jenis_kelamin, kelas(nama))')
        .eq('id_guru', currentUser.id)
        .order('created_at', { ascending: true });

      // Fetch Setting Sekolah
      const sekolahPromise = supabase
        .from('sekolah')
        .select('hari_sekolah')
        .limit(1)
        .maybeSingle();

      const [siswaRes, sekolahRes] = await Promise.all([siswaPromise, sekolahPromise]);

      if (siswaRes.data) {
         // @ts-ignore
         setSiswaList(siswaRes.data);
      }
      if (sekolahRes.data) {
         setHariSekolah(sekolahRes.data.hari_sekolah);
      }

      setLoading(false);
    };
    fetchInitialData();
  }, [currentUser.id]);

  // 2. Fetch Kehadiran & Cek Libur saat Tanggal/Siswa/HariSekolah Berubah
  useEffect(() => {
    if (siswaList.length > 0) {
      fetchDataAndCheckHoliday();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, siswaList, hariSekolah]);

  const fetchDataAndCheckHoliday = async () => {
    setLoading(true);
    setMode('INPUT'); 
    setIsHoliday(false);
    setHolidayInfo(null);

    try {
      // --- PRIORITY 1: CEK TANGGAL MASA DEPAN ---
      if (tanggal > todayStr) {
          setIsHoliday(true);
          setHolidayInfo({
              jenis: 'FUTURE_DATE',
              keterangan: 'Tanggal Masa Depan (Belum dapat diisi)'
          });
          // Jangan return, tetap fetch data jika ada (walau harusnya kosong) agar UI konsisten
          // Tapi input tetap disable karena isHoliday=true
      }

      // --- PRIORITY 2: CEK HARI SEKOLAH (SENIN-JUMAT / SABTU) ---
      const dateObj = new Date(tanggal);
      const dayOfWeek = dateObj.getDay(); // 0=Minggu, 6=Sabtu
      
      let isWeekend = false;
      let weekendLabel = '';

      if (dayOfWeek === 0) {
          isWeekend = true;
          weekendLabel = 'Hari Minggu';
      } else if (hariSekolah === 5 && dayOfWeek === 6) {
          isWeekend = true;
          weekendLabel = 'Hari Sabtu (Sekolah 5 Hari Kerja)';
      }

      if (isWeekend) {
          // Jika sudah terdeteksi masa depan, biarkan error masa depan prioritas.
          // Jika tidak, baru set weekend.
          if (tanggal <= todayStr) {
              setIsHoliday(true);
              setHolidayInfo({ 
                  jenis: 'HARI_NON_AKTIF', 
                  keterangan: weekendLabel 
              });
          }
      }

      // Parallel Request: Cek Kehadiran & Cek Kalender Pendidikan
      const queries: any[] = [
        supabase
          .from('kehadiran')
          .select('*')
          .eq('id_guru', currentUser.id)
          .eq('tanggal', tanggal)
      ];

      // Hanya query kalender jika valid date (bukan masa depan, bukan weekend)
      const shouldCheckCalendar = tanggal <= todayStr && !isWeekend;

      if (shouldCheckCalendar) {
          queries.push(
            supabase
              .from('kalender_pendidikan')
              .select('jenis, keterangan')
              .eq('tanggal', tanggal)
              .maybeSingle()
          );
      }

      const results = await Promise.all(queries);
      const kehadiranRes = results[0];
      const kalenderRes = shouldCheckCalendar ? results[1] : null;

      // --- PRIORITY 3: CEK KALENDER PENDIDIKAN ---
      if (kalenderRes?.data) {
        setIsHoliday(true);
        setHolidayInfo(kalenderRes.data);
      }

      // 3. Handle Data Kehadiran
      const existingData = kehadiranRes.data as Kehadiran[] || [];
      const newFormState: FormState = {};

      if (existingData.length > 0) {
        // DATA ADA -> MODE VIEW
        setMode('VIEW');
        
        siswaList.forEach(item => {
          const record = existingData.find(k => k.id_siswa === item.id_siswa);
          if (record) {
            newFormState[item.id_siswa] = {
              id: record.id,
              status: record.status,
              catatan: record.catatan || ''
            };
          } else {
            newFormState[item.id_siswa] = { status: 'HADIR', catatan: '' };
          }
        });
      } else {
        // DATA KOSONG -> MODE INPUT (Default HADIR)
        setMode('INPUT');
        siswaList.forEach(item => {
          newFormState[item.id_siswa] = { status: 'HADIR', catatan: '' };
        });
      }

      setFormData(newFormState);

    } catch (error) {
      console.error(error);
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handleStatusChange = (id_siswa: string, val: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA') => {
    if (isHoliday) return; // Prevent change if holiday/future
    setFormData(prev => ({
      ...prev,
      [id_siswa]: { ...prev[id_siswa], status: val }
    }));
  };

  const handleCatatanChange = (id_siswa: string, val: string) => {
    if (isHoliday) return; // Prevent change if holiday/future
    setFormData(prev => ({
      ...prev,
      [id_siswa]: { ...prev[id_siswa], catatan: val }
    }));
  };

  const handleSave = async () => {
    // VALIDASI FINAL SEBELUM SAVE
    if (isHoliday) {
        showToast(`Gagal: ${holidayInfo?.keterangan || 'Hari Libur / Masa Depan'}.`, 'error');
        return;
    }

    setProcessing(true);
    try {
      const payload = siswaList.map(item => ({
        id_guru: currentUser.id,
        id_siswa: item.id_siswa,
        tanggal: tanggal,
        status: formData[item.id_siswa].status,
        catatan: formData[item.id_siswa].catatan
      }));

      const { error } = await supabase.from('kehadiran').insert(payload);
      if (error) throw error;

      showToast('✅ Kehadiran berhasil disimpan', 'success');
      await fetchDataAndCheckHoliday(); // Refresh ke mode VIEW
    } catch (e) {
      showToast('Gagal menyimpan data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    // VALIDASI FINAL SEBELUM UPDATE
    if (isHoliday) {
        showToast(`Gagal: ${holidayInfo?.keterangan || 'Hari Libur / Masa Depan'}.`, 'error');
        return;
    }

    setProcessing(true);
    try {
      // Upsert: Jika ID ada (update), jika tidak (insert - kasus siswa baru)
      const payload = siswaList.map(item => {
        const form = formData[item.id_siswa];
        return {
          id: form.id, // Supabase Upsert pakai ID ini untuk update
          id_guru: currentUser.id,
          id_siswa: item.id_siswa,
          tanggal: tanggal,
          status: form.status,
          catatan: form.catatan
        };
      });

      const { error } = await supabase.from('kehadiran').upsert(payload);
      if (error) throw error;

      showToast('✅ Kehadiran berhasil diperbarui', 'success');
      await fetchDataAndCheckHoliday(); // Kembali ke mode VIEW
    } catch (e) {
      showToast('Gagal memperbarui data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    // Validasi Delete: Tidak boleh hapus masa depan (meskipun datanya anehnya ada)
    if (tanggal > todayStr) {
        showToast('Tidak dapat menghapus data masa depan.', 'error');
        return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('kehadiran')
        .delete()
        .eq('id_guru', currentUser.id)
        .eq('tanggal', tanggal);

      if (error) throw error;

      showToast('🗑️ Data kehadiran dihapus', 'success');
      setShowDeleteConfirm(false);
      await fetchDataAndCheckHoliday(); // Kembali ke mode INPUT
    } catch (e) {
      showToast('Gagal menghapus data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // --- Components ---

  const RadioButton = ({ id_siswa, val, label, colorClass }: any) => {
    const isSelected = formData[id_siswa]?.status === val;
    const isDisabled = mode === 'VIEW' || isHoliday; // Disabled if VIEW mode OR Holiday/Future

    return (
      <label className={`
        relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200
        ${isSelected 
          ? `${colorClass} text-white shadow-lg scale-110 font-bold ring-2 ring-white` 
          : 'bg-gray-700 text-gray-400 border border-gray-600'}
        ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-600'}
      `}>
        <input
          type="radio"
          name={`status-${id_siswa}`}
          value={val}
          checked={isSelected}
          onChange={() => !isDisabled && handleStatusChange(id_siswa, val)}
          disabled={isDisabled}
          className="hidden"
        />
        {label}
      </label>
    );
  };

  return (
    <div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        message={`Yakin ingin menghapus seluruh data kehadiran pada tanggal ${tanggal}?`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white">Input Kehadiran</h2>
           <p className="text-gray-400 text-sm">Kelola absensi harian siswa binaan.</p>
        </div>
      </div>

      {/* --- CONTROL PANEL (Sticky) --- */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl mb-6 sticky top-0 z-20">
        <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            
            {/* Date Picker & Badge */}
            <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="relative">
                    <input
                    type="date"
                    value={tanggal}
                    max={todayStr} // Prevent selecting future dates via UI
                    onChange={(e) => setTanggal(e.target.value)}
                    className="bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent shadow-inner"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-400">📅</span>
                </div>

                {/* Mode Badge */}
                {mode === 'INPUT' && !isHoliday && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                    Mode Input
                </span>
                )}
                {mode === 'VIEW' && !isHoliday && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-full text-xs font-bold uppercase tracking-wider">
                    Mode Lihat
                </span>
                )}
                {mode === 'EDIT' && !isHoliday && (
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                    Mode Edit
                </span>
                )}
                {isHoliday && (
                    <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                        holidayInfo?.jenis === 'FUTURE_DATE' 
                        ? 'bg-gray-700 text-gray-400 border-gray-500' 
                        : 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                    }`}>
                        ⛔ {holidayInfo?.jenis === 'HARI_NON_AKTIF' ? 'HARI LIBUR' : holidayInfo?.jenis === 'FUTURE_DATE' ? 'MASA DEPAN' : 'LIBUR NASIONAL'}
                    </span>
                )}
            </div>

            {/* Action Buttons based on Mode */}
            <div className="flex gap-2 w-full lg:w-auto justify-end">
                
                {/* 1. Jika Mode INPUT (Belum ada data) */}
                {mode === 'INPUT' && (
                <button
                    onClick={handleSave}
                    disabled={processing || siswaList.length === 0 || isHoliday}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {processing ? 'Menyimpan...' : '💾 Simpan Kehadiran'}
                </button>
                )}

                {/* 2. Jika Mode VIEW (Data ada, hanya lihat) */}
                {mode === 'VIEW' && (
                <>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isHoliday && holidayInfo?.jenis === 'FUTURE_DATE'} // Disable hapus jika future date
                        className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        🗑️ Hapus
                    </button>
                    {!isHoliday && (
                        <button
                            onClick={() => setMode('EDIT')}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2"
                        >
                            ✏️ Ubah Data
                        </button>
                    )}
                </>
                )}

                {/* 3. Jika Mode EDIT (Sedang mengedit) */}
                {mode === 'EDIT' && (
                <>
                    <button
                        onClick={() => { setMode('VIEW'); fetchDataAndCheckHoliday(); }} 
                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition"
                        disabled={processing}
                    >
                        ❌ Batal
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={processing || isHoliday}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                    >
                        {processing ? 'Memproses...' : '✅ Perbarui Kehadiran'}
                    </button>
                </>
                )}
            </div>
            </div>

            {/* ALERT HARI LIBUR / FUTURE */}
            {isHoliday && holidayInfo && (
                <div className={`w-full p-3 rounded-lg flex items-start gap-3 animate-slide-in border ${
                    holidayInfo.jenis === 'FUTURE_DATE' 
                    ? 'bg-gray-700/50 border-gray-600 text-gray-300' 
                    : 'bg-red-900/30 border-red-600/50 text-red-200'
                }`}>
                    <span className="text-2xl">{holidayInfo.jenis === 'FUTURE_DATE' ? '⏳' : '🚫'}</span>
                    <div>
                        <h4 className={`font-bold ${holidayInfo.jenis === 'FUTURE_DATE' ? 'text-gray-200' : 'text-red-100'}`}>
                            {holidayInfo.jenis === 'FUTURE_DATE' ? 'Tanggal Belum Dapat Diisi' : 'Tidak dapat menginput kehadiran'}
                        </h4>
                        <p className="text-sm">
                            Status: <strong>{holidayInfo.jenis === 'FUTURE_DATE' ? 'Masa Depan' : holidayInfo.jenis.replace(/_/g, ' ')}</strong>.
                            {holidayInfo.keterangan && <span className="block mt-1 italic opacity-80">"{holidayInfo.keterangan}"</span>}
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- TABLE CONTENT --- */}
      <div className="bg-gray-800 shadow-xl overflow-hidden rounded-xl border border-gray-700">
        {loading ? (
          <div className="p-10 flex justify-center items-center text-gray-400 gap-3">
            <span className="animate-spin text-2xl">⏳</span> Memuat data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-750 text-gray-400">
                <tr>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase w-12">No</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">Siswa</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase">Status Kehadiran</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase">Catatan</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {siswaList.map((item, index) => {
                  const currentStatus = formData[item.id_siswa]?.status;
                  // Highlight row based on status
                  let rowBg = 'hover:bg-gray-750';
                  if (currentStatus === 'SAKIT') rowBg = 'bg-yellow-900/10 hover:bg-yellow-900/20';
                  if (currentStatus === 'IZIN') rowBg = 'bg-blue-900/10 hover:bg-blue-900/20';
                  if (currentStatus === 'ALPHA') rowBg = 'bg-red-900/10 hover:bg-red-900/20';
                  
                  // Dimmed row if holiday
                  if (isHoliday) rowBg = 'bg-gray-900 opacity-60';

                  return (
                    <tr key={item.id} className={`transition-colors duration-200 ${rowBg}`}>
                      <td className="px-6 py-4 text-center text-gray-500 text-sm">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{item.siswa?.nama}</span>
                          <span className="text-xs text-gray-400 flex gap-2">
                             <span>{item.siswa?.nisn}</span>
                             <span className="text-gray-600">•</span>
                             <span>{item.siswa?.jenis_kelamin}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <RadioButton 
                            id_siswa={item.id_siswa} val="HADIR" label="H" 
                            colorClass="bg-green-600" 
                          />
                          <RadioButton 
                            id_siswa={item.id_siswa} val="SAKIT" label="S" 
                            colorClass="bg-yellow-500" 
                          />
                          <RadioButton 
                            id_siswa={item.id_siswa} val="IZIN" label="I" 
                            colorClass="bg-blue-500" 
                          />
                          <RadioButton 
                            id_siswa={item.id_siswa} val="ALPHA" label="A" 
                            colorClass="bg-red-500" 
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={formData[item.id_siswa]?.catatan || ''}
                          onChange={(e) => handleCatatanChange(item.id_siswa, e.target.value)}
                          placeholder={mode === 'VIEW' ? "" : "Keterangan tambahan..."}
                          disabled={mode === 'VIEW' || isHoliday}
                          className={`
                            w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg px-3 py-2
                            focus:ring-1 focus:ring-primary focus:border-primary transition
                            disabled:opacity-50 disabled:bg-gray-800 disabled:border-transparent
                            disabled:cursor-not-allowed
                          `}
                        />
                      </td>
                    </tr>
                  );
                })}
                {siswaList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-gray-500 italic flex flex-col items-center">
                      <span className="text-4xl mb-2">📭</span>
                      Belum ada siswa binaan yang ditugaskan kepada Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex gap-6 justify-center text-xs text-gray-400 font-medium">
         <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-600"></div> H (Hadir)</span>
         <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500"></div> S (Sakit)</span>
         <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500"></div> I (Izin)</span>
         <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500"></div> A (Alpha)</span>
      </div>

    </div>
  );
};