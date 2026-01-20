import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Guru } from '../../types';
import * as XLSX from 'xlsx';

interface Props {
  currentUser: Guru;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const ImportKehadiranTemplate: React.FC<Props> = ({ currentUser, showToast }) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  // State Input
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC TANGGAL ---

  // 1. Tambah Satu Tanggal
  const handleAddSingleDate = () => {
    if (!singleDate) return;
    if (selectedDates.includes(singleDate)) {
      showToast('Tanggal sudah ada dalam daftar', 'error');
      return;
    }
    const newDates = [...selectedDates, singleDate].sort();
    setSelectedDates(newDates);
    setSingleDate('');
  };

  // 2. Tambah Rentang Tanggal (Multiselect Logic)
  const handleAddRange = () => {
    if (!startDate || !endDate) {
        showToast('Mohon isi Tanggal Mulai dan Tanggal Akhir', 'error');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        showToast('Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir', 'error');
        return;
    }

    const tempDates: string[] = [];
    let current = new Date(start);

    // Loop dari start sampai end
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (!selectedDates.includes(dateStr)) {
            tempDates.push(dateStr);
        }
        // Increment hari +1
        current.setDate(current.getDate() + 1);
    }

    if (tempDates.length === 0) {
        showToast('Semua tanggal dalam rentang ini sudah terpilih.', 'error');
    } else {
        const combinedDates = [...selectedDates, ...tempDates].sort();
        setSelectedDates(combinedDates);
        setStartDate('');
        setEndDate('');
        showToast(`Berhasil menambahkan ${tempDates.length} tanggal.`, 'success');
    }
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setSelectedDates(selectedDates.filter(d => d !== dateToRemove));
  };

  const handleClearDates = () => {
      setSelectedDates([]);
  };

  // --- LOGIC GENERATE & IMPORT ---

  const handleGenerateTemplate = async () => {
    if (selectedDates.length === 0) {
      showToast('Pilih minimal satu tanggal terlebih dahulu', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data: siswaData, error } = await supabase
        .from('bimbingan')
        .select('*, siswa(id, nama, nisn, kelas(nama))')
        .eq('id_guru', currentUser.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!siswaData || siswaData.length === 0) {
        showToast('Anda belum memiliki siswa binaan', 'error');
        setLoading(false);
        return;
      }

      const rows = siswaData.map((item, index) => {
        const row: any = {
          NO: index + 1,
          NISN: item.siswa?.nisn || '', 
          NAMA: item.siswa?.nama || '',
          KELAS: item.siswa?.kelas?.nama || '',
        };
        selectedDates.forEach(date => {
          row[date] = ''; 
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");

      const filename = `Template_Kehadiran_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast('Template berhasil dibuat!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Gagal membuat template: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportProgress(0); 
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          showToast('File Excel kosong', 'error');
          setLoading(false);
          return;
        }

        let processedCount = 0;
        let errorCount = 0;
        const totalRows = data.length;

        for (let i = 0; i < totalRows; i++) {
          const row: any = data[i];
          const nisn = row['NISN'] ? String(row['NISN']).trim() : '';
          const nama = row['NAMA'] ? String(row['NAMA']).trim() : '';

          if (!nisn && !nama) {
             const currentProgress = Math.round(((i + 1) / totalRows) * 100);
             setImportProgress(currentProgress);
             continue; 
          }

          let studentId = '';
          const { data: foundSiswa } = await supabase
             .from('siswa')
             .select('id')
             .eq('nisn', nisn)
             .maybeSingle();
             
          if (foundSiswa) {
            studentId = foundSiswa.id;
          } else {
            const { data: foundSiswaByName } = await supabase
                .from('siswa')
                .select('id')
                .ilike('nama', nama)
                .maybeSingle();
            if (foundSiswaByName) studentId = foundSiswaByName.id;
          }

          if (!studentId) {
            errorCount++;
          } else {
            const keys = Object.keys(row);
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/; 

            for (const key of keys) {
               if (dateRegex.test(key)) {
                  const rawStatus = row[key] ? String(row[key]).trim().toUpperCase() : '';
                  let statusDb: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA' | null = null;

                  if (['H', 'HADIR'].includes(rawStatus)) statusDb = 'HADIR';
                  else if (['S', 'SAKIT'].includes(rawStatus)) statusDb = 'SAKIT';
                  else if (['I', 'IZIN'].includes(rawStatus)) statusDb = 'IZIN';
                  else if (['A', 'ALPHA', 'ALPA'].includes(rawStatus)) statusDb = 'ALPHA';

                  if (statusDb) {
                      const { data: existing } = await supabase
                          .from('kehadiran')
                          .select('id')
                          .eq('id_guru', currentUser.id)
                          .eq('id_siswa', studentId)
                          .eq('tanggal', key)
                          .maybeSingle();

                      if (existing) {
                          await supabase.from('kehadiran').update({ status: statusDb }).eq('id', existing.id);
                      } else {
                          await supabase.from('kehadiran').insert([{
                              id_guru: currentUser.id,
                              id_siswa: studentId,
                              tanggal: key,
                              status: statusDb
                          }]);
                      }
                  }
               }
            }
            processedCount++;
          }

          const currentProgress = Math.round(((i + 1) / totalRows) * 100);
          setImportProgress(currentProgress);
        }

        showToast(`Import selesai. ${processedCount} siswa diproses.`, 'success');
        if (errorCount > 0) {
            setTimeout(() => showToast(`${errorCount} siswa tidak ditemukan di database.`, 'error'), 2000);
        }

      } catch (err: any) {
        console.error(err);
        showToast('Gagal memproses file: ' + err.message, 'error');
      } finally {
        setLoading(false);
        setImportProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-3xl font-bold text-white mb-2">Import Kehadiran (Custom)</h2>
      <p className="text-gray-400 mb-8">
        Fitur ini memungkinkan Anda mengisi absensi untuk beberapa tanggal sekaligus menggunakan Excel.
      </p>

      {/* STEP 1: PILIH TANGGAL */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">1. Pilih Tanggal & Buat Template</h3>
        
        <div className="space-y-6">
            
            {/* OPSI A: Tambah Rentang (Multiselect Logic) */}
            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                <label className="block text-sm font-bold text-white mb-3">🅰️ Opsi Cepat: Pilih Rentang Tanggal</label>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-xs text-gray-400 block mb-1">Dari Tanggal</label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-gray-700 border border-gray-500 text-white rounded px-3 py-2 w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center justify-center pb-2 text-gray-400">
                        ➡️
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs text-gray-400 block mb-1">Sampai Tanggal</label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-gray-700 border border-gray-500 text-white rounded px-3 py-2 w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <button 
                        onClick={handleAddRange}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition w-full md:w-auto h-[42px]"
                    >
                        + Tambahkan Rentang
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    *Semua tanggal di antara tanggal mulai dan akhir akan ditambahkan ke daftar.
                </p>
            </div>

            {/* OPSI B: Tambah Manual */}
            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 border-dashed">
                <label className="block text-sm font-bold text-gray-300 mb-3">🅱️ Opsi Manual: Tambah Satuan</label>
                <div className="flex flex-col md:flex-row gap-4">
                    <input 
                        type="date" 
                        value={singleDate}
                        onChange={(e) => setSingleDate(e.target.value)}
                        className="bg-gray-700 border border-gray-500 text-white rounded px-3 py-2 w-full md:w-64"
                    />
                    <button 
                        onClick={handleAddSingleDate}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-medium transition w-full md:w-auto"
                    >
                        + Tambah
                    </button>
                </div>
            </div>

            {/* Selected Dates Chips */}
            {selectedDates.length > 0 && (
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-300">Daftar Tanggal Terpilih ({selectedDates.length}):</span>
                        <button onClick={handleClearDates} className="text-xs text-red-400 hover:text-red-300 underline">Hapus Semua</button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedDates.map(date => (
                            <div key={date} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-primary/30">
                                <span>🗓️ {date}</span>
                                <button 
                                    onClick={() => handleRemoveDate(date)}
                                    className="text-red-400 hover:text-red-300 font-bold px-1 hover:bg-white/10 rounded"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="border-t border-gray-700 pt-4">
                <button 
                    onClick={handleGenerateTemplate}
                    disabled={loading || selectedDates.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Memproses...' : '📥 Buat & Download Template Excel'}
                </button>
            </div>
        </div>
      </div>

      {/* STEP 2: UPLOAD */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-lg font-semibold text-green-400 mb-4">2. Upload & Import Data</h3>
        <p className="text-sm text-gray-400 mb-4">
            Isi file Excel yang telah diunduh dengan kode: <strong>H</strong> (Hadir), <strong>S</strong> (Sakit), <strong>I</strong> (Izin), <strong>A</strong> (Alpha).
        </p>
        
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-10 bg-gray-700/30 hover:bg-gray-700/50 transition relative">
            <input 
                type="file" 
                accept=".xlsx, .xls"
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={loading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                id="file-upload"
            />
            <div className="text-center pointer-events-none">
                <span className="text-4xl mb-2 block">📂</span>
                <span className="text-white font-medium mb-1 block">Klik atau Seret File Excel ke Sini</span>
                <span className="text-xs text-gray-500 block">Format .xlsx atau .xls</span>
            </div>
        </div>
      </div>

      {/* PROGRESS OVERLAY */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-80 md:w-96 text-center">
            <h3 className="text-white font-bold mb-4 text-lg">Memproses Data...</h3>
            <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden">
               <div 
                 className="bg-green-500 h-4 rounded-full transition-all duration-300" 
                 style={{ width: `${importProgress}%` }}
               ></div>
            </div>
            <p className="text-gray-300 font-medium">{importProgress}%</p>
            <p className="text-gray-500 text-sm mt-1">Mohon jangan tutup halaman ini.</p>
          </div>
        </div>
      )}

    </div>
  );
};