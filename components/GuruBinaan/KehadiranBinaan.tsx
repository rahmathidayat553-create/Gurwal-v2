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

  // 1. Fetch Daftar Siswa (Sekali saat mount)
  useEffect(() => {
    const fetchSiswa = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bimbingan')
        .select('*, siswa(id, nama, nisn, jenis_kelamin, kelas(nama))')
        .eq('id_guru', currentUser.id)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
         // @ts-ignore
         setSiswaList(data);
      }
      setLoading(false);
    };
    fetchSiswa();
  }, [currentUser.id]);

  // 2. Fetch Kehadiran saat Tanggal Berubah
  useEffect(() => {
    if (siswaList.length > 0) {
      fetchKehadiran();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, siswaList]);

  const fetchKehadiran = async () => {
    setLoading(true);
    setMode('INPUT'); // Reset asumsi awal ke INPUT

    try {
      const { data } = await supabase
        .from('kehadiran')
        .select('*')
        .eq('id_guru', currentUser.id)
        .eq('tanggal', tanggal);

      const existingData = data as Kehadiran[] || [];
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
            // Jika siswa baru masuk tapi data tanggal tsb sudah ada, default hadir
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
      showToast('Gagal memuat data kehadiran', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handleStatusChange = (id_siswa: string, val: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA') => {
    setFormData(prev => ({
      ...prev,
      [id_siswa]: { ...prev[id_siswa], status: val }
    }));
  };

  const handleCatatanChange = (id_siswa: string, val: string) => {
    setFormData(prev => ({
      ...prev,
      [id_siswa]: { ...prev[id_siswa], catatan: val }
    }));
  };

  const handleSave = async () => {
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
      await fetchKehadiran(); // Refresh ke mode VIEW
    } catch (e) {
      showToast('Gagal menyimpan data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
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
      await fetchKehadiran(); // Kembali ke mode VIEW
    } catch (e) {
      showToast('Gagal memperbarui data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
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
      await fetchKehadiran(); // Kembali ke mode INPUT
    } catch (e) {
      showToast('Gagal menghapus data', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // --- Components ---

  const RadioButton = ({ id_siswa, val, label, colorClass }: any) => {
    const isSelected = formData[id_siswa]?.status === val;
    const isDisabled = mode === 'VIEW'; // Disabled only in VIEW mode

    return (
      <label className={`
        relative flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer transition-all duration-200
        ${isSelected 
          ? `${colorClass} text-white shadow-lg scale-110 font-bold ring-2 ring-white` 
          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'}
        ${isDisabled ? 'cursor-default opacity-80' : 'cursor-pointer'}
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
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          
          {/* Date Picker & Badge */}
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="relative">
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent shadow-inner"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">📅</span>
            </div>

            {/* Mode Badge */}
            {mode === 'INPUT' && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                Mode Input
              </span>
            )}
            {mode === 'VIEW' && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-full text-xs font-bold uppercase tracking-wider">
                Mode Lihat
              </span>
            )}
            {mode === 'EDIT' && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                Mode Edit
              </span>
            )}
          </div>

          {/* Action Buttons based on Mode */}
          <div className="flex gap-2 w-full lg:w-auto justify-end">
            
            {/* 1. Jika Mode INPUT (Belum ada data) */}
            {mode === 'INPUT' && (
              <button
                onClick={handleSave}
                disabled={processing || siswaList.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {processing ? 'Menyimpan...' : '💾 Simpan Kehadiran'}
              </button>
            )}

            {/* 2. Jika Mode VIEW (Data ada, hanya lihat) */}
            {mode === 'VIEW' && (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                  🗑️ Hapus
                </button>
                <button
                  onClick={() => setMode('EDIT')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2"
                >
                  ✏️ Ubah Data
                </button>
              </>
            )}

            {/* 3. Jika Mode EDIT (Sedang mengedit) */}
            {mode === 'EDIT' && (
              <>
                <button
                  onClick={() => { setMode('VIEW'); fetchKehadiran(); }} // Cancel reverts to VIEW & refetches
                  className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition"
                  disabled={processing}
                >
                  ❌ Batal
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={processing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {processing ? 'Memproses...' : '✅ Perbarui Kehadiran'}
                </button>
              </>
            )}
          </div>
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
                          disabled={mode === 'VIEW'}
                          className={`
                            w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg px-3 py-2
                            focus:ring-1 focus:ring-primary focus:border-primary transition
                            disabled:opacity-50 disabled:bg-gray-800 disabled:border-transparent
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