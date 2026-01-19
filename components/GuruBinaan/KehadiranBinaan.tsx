import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Guru, Bimbingan, Kehadiran } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface Props {
  currentUser: Guru;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

// Tipe untuk state lokal form
interface AttendanceFormState {
  [id_siswa: string]: {
    id?: string; // ID kehadiran jika sudah ada (untuk update)
    status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA';
    catatan: string;
  };
}

export const KehadiranBinaan: React.FC<Props> = ({ currentUser, showToast }) => {
  const [siswaList, setSiswaList] = useState<Bimbingan[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // State Form Data
  const [formData, setFormData] = useState<AttendanceFormState>({});
  
  // State Mode: apakah data sudah tersimpan di DB?
  const [isDataSaved, setIsDataSaved] = useState(false);
  // State Mode: apakah user sedang mengklik tombol Edit?
  const [isEditing, setIsEditing] = useState(false);

  // Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 1. Fetch Daftar Siswa Binaan (Sekali saja saat mount)
  useEffect(() => {
    const fetchSiswa = async () => {
      const { data, error } = await supabase
        .from('bimbingan')
        .select('*, siswa(id, nama, nisn, jenis_kelamin, kelas(nama))')
        .eq('id_guru', currentUser.id)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
         // @ts-ignore
         setSiswaList(data);
      }
    };
    fetchSiswa();
  }, [currentUser.id]);

  // 2. Fetch Data Kehadiran ketika Tanggal atau Siswa berubah
  useEffect(() => {
    if (siswaList.length > 0) {
        fetchKehadiran();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, siswaList]);

  const fetchKehadiran = async () => {
    setLoading(true);
    setIsEditing(false); // Reset edit mode saat ganti tanggal

    try {
        const { data } = await supabase
        .from('kehadiran')
        .select('*')
        .eq('id_guru', currentUser.id)
        .eq('tanggal', tanggal);

        const currentData = data as Kehadiran[] || [];
        const newFormState: AttendanceFormState = {};
        const hasData = currentData.length > 0;

        setIsDataSaved(hasData);

        // Mapping data siswa ke form state
        siswaList.forEach(item => {
            const record = currentData.find(k => k.id_siswa === item.id_siswa);
            if (record) {
                // Jika data ada di DB
                newFormState[item.id_siswa] = {
                    id: record.id,
                    status: record.status,
                    catatan: record.catatan || ''
                };
            } else {
                // Default value jika data belum ada
                newFormState[item.id_siswa] = {
                    status: 'HADIR',
                    catatan: ''
                };
            }
        });

        setFormData(newFormState);

    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  // --- Handlers ---

  const handleRadioChange = (id_siswa: string, value: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA') => {
    setFormData(prev => ({
        ...prev,
        [id_siswa]: { ...prev[id_siswa], status: value }
    }));
  };

  const handleCatatanChange = (id_siswa: string, value: string) => {
    setFormData(prev => ({
        ...prev,
        [id_siswa]: { ...prev[id_siswa], catatan: value }
    }));
  };

  const handleSaveOrUpdate = async () => {
    setProcessing(true);
    try {
        // Siapkan payload untuk upsert
        const payload = siswaList.map(item => {
            const form = formData[item.id_siswa];
            const record: any = {
                id_guru: currentUser.id,
                id_siswa: item.id_siswa,
                tanggal: tanggal,
                status: form.status,
                catatan: form.catatan
            };
            
            // Sertakan ID hanya jika ada (untuk update)
            if (form.id) {
                record.id = form.id;
            }
            return record;
        });

        const { error } = await supabase.from('kehadiran').upsert(payload);

        if (error) throw error;

        showToast(isDataSaved ? '✅ Data berhasil diperbarui' : '✅ Data berhasil disimpan', 'success');
        await fetchKehadiran(); // Refresh data & mode

    } catch (error) {
        showToast('❌ Gagal menyimpan data', 'error');
        console.error(error);
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

        showToast('✅ Data kehadiran tanggal ini dihapus', 'success');
        setShowDeleteConfirm(false);
        await fetchKehadiran(); // Reset ke mode input baru
    } catch (error) {
        showToast('❌ Gagal menghapus data', 'error');
    } finally {
        setProcessing(false);
    }
  };

  // Helper UI Radio
  const RadioOption = ({ id_siswa, val, label, activeColorClass }: any) => {
      const isChecked = formData[id_siswa]?.status === val;
      // Jika mode VIEW (Saved & Not Editing) -> Disabled
      const isDisabled = isDataSaved && !isEditing;

      return (
          <label className={`
            cursor-pointer flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 transition-all select-none
            ${isChecked 
                ? `${activeColorClass} border-transparent text-white shadow-md transform scale-110` 
                : 'border-gray-600 text-gray-400 hover:bg-gray-700'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
              <input 
                type="radio" 
                name={`status-${id_siswa}`} 
                value={val}
                checked={isChecked}
                onChange={() => !isDisabled && handleRadioChange(id_siswa, val)}
                className="hidden"
                disabled={isDisabled}
              />
              <span className="font-bold text-xs md:text-sm">{label}</span>
          </label>
      );
  };

  return (
    <div>
      <ConfirmDialog 
        isOpen={showDeleteConfirm} 
        message={`Apakah Anda yakin ingin menghapus seluruh data kehadiran pada tanggal ${tanggal}?`} 
        onConfirm={handleDelete} 
        onCancel={() => setShowDeleteConfirm(false)} 
      />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Input Kehadiran Binaan</h2>
      </div>
      
      {/* Date Picker & Summary */}
      <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg sticky top-0 z-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <label className="text-gray-300 font-medium whitespace-nowrap">Tanggal:</label>
                <input 
                    type="date" 
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="bg-gray-700 border border-gray-600 text-white rounded px-4 py-2 focus:outline-none focus:border-primary w-full md:w-auto"
                />
                
                {/* LABEL MODE EDIT */}
                {isDataSaved && isEditing && (
                    <span className="px-3 py-1 rounded bg-yellow-600 text-white text-xs font-bold animate-pulse shadow-lg whitespace-nowrap">
                        MODE EDIT
                    </span>
                )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto justify-end">
                {isDataSaved && !isEditing ? (
                    // MODE VIEW: Tombol Edit & Hapus
                    <>
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded font-medium transition shadow-lg flex items-center gap-2"
                        >
                            ✏️ Edit Data
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded font-medium transition shadow-lg flex items-center gap-2"
                        >
                            🗑️ Hapus Data
                        </button>
                    </>
                ) : (
                    // MODE INPUT / EDITING
                    <>
                        {isEditing && (
                            <button 
                                onClick={() => { setIsEditing(false); fetchKehadiran(); }} // Batal = Reset fetch
                                className="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded font-medium transition"
                                disabled={processing}
                            >
                                Batal
                            </button>
                        )}
                        <button 
                            onClick={handleSaveOrUpdate}
                            disabled={processing || siswaList.length === 0}
                            className={`${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-secondary'} text-white px-6 py-2 rounded font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50`}
                        >
                            {processing ? 'Menyimpan...' : (isEditing ? '💾 Simpan Perubahan' : '💾 Simpan Absensi')}
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="bg-gray-800 shadow overflow-hidden rounded-lg border border-gray-700">
        {loading ? (
             <div className="p-10 text-center text-gray-400">Memuat data kehadiran...</div>
        ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
                <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase w-10">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nama Siswa</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase w-20">L/P</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Status Kehadiran</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Catatan</th>
                </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
                {siswaList.map((item, index) => {
                    const isDisabled = isDataSaved && !isEditing;
                    
                    return (
                        <tr key={item.id} className="hover:bg-gray-750 transition-colors">
                            <td className="px-6 py-4 text-center text-gray-500 text-sm">
                                {index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-white">{item.siswa?.nama}</div>
                                <div className="text-xs text-gray-400">{item.siswa?.nisn}</div>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-300">
                                {item.siswa?.jenis_kelamin || '-'}
                            </td>

                            {/* KOLOM STATUS RADIO BUTTON */}
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2 md:gap-4">
                                    <RadioOption 
                                        id_siswa={item.id_siswa} val="HADIR" label="H" 
                                        activeColorClass="bg-green-600" 
                                    />
                                    <RadioOption 
                                        id_siswa={item.id_siswa} val="IZIN" label="I" 
                                        activeColorClass="bg-blue-600" 
                                    />
                                    <RadioOption 
                                        id_siswa={item.id_siswa} val="SAKIT" label="S" 
                                        activeColorClass="bg-yellow-600" 
                                    />
                                    <RadioOption 
                                        id_siswa={item.id_siswa} val="ALPHA" label="A" 
                                        activeColorClass="bg-red-600" 
                                    />
                                </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                    type="text"
                                    value={formData[item.id_siswa]?.catatan || ''}
                                    onChange={(e) => handleCatatanChange(item.id_siswa, e.target.value)}
                                    placeholder={isDisabled ? "-" : "Keterangan..."}
                                    disabled={isDisabled}
                                    className={`bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 w-full focus:ring-primary focus:border-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                                />
                            </td>
                        </tr>
                    );
                })}
                {siswaList.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-gray-500 italic">Belum ada siswa binaan yang ditugaskan.</td></tr>
                )}
            </tbody>
            </table>
            </div>
        )}
      </div>

      {/* Footer Info / Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center md:justify-start text-xs text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-600 rounded-sm"></div> H : Hadir</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div> I : Izin</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-600 rounded-sm"></div> S : Sakit</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-600 rounded-sm"></div> A : Alpha</div>
      </div>
    </div>
  );
};