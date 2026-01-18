import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Guru, Siswa, Kelas } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface CrudAnggotaGurwalProps {
  showToast: (msg: string, type: 'success' | 'error', duration?: number, position?: 'top-right' | 'center') => void;
}

export const CrudAnggotaGurwal: React.FC<CrudAnggotaGurwalProps> = ({ showToast }) => {
  const [guruWaliList, setGuruWaliList] = useState<Guru[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasOptions, setKelasOptions] = useState<Kelas[]>([]);
  
  const [selectedGuru, setSelectedGuru] = useState<string>('');
  const [assignedSiswaIds, setAssignedSiswaIds] = useState<Set<string>>(new Set());
  
  // Confirmation State for Removal
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; nama: string } | null>(null);

  // Filters
  const [filterKelas, setFilterKelas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Initial Load: Gurus & Kelas
  useEffect(() => {
    const fetchInitial = async () => {
      // Mengambil data guru dengan peran 'GURU' 
      const { data: gurus } = await supabase
        .from('guru')
        .select('*')
        .eq('peran', 'GURU') 
        .order('nama');

      const { data: kelas } = await supabase.from('kelas').select('*').order('nama');
      const { data: siswa } = await supabase.from('siswa').select('*, kelas(nama)').order('nama');
      
      if (gurus) setGuruWaliList(gurus);
      if (kelas) setKelasOptions(kelas);
      // @ts-ignore
      if (siswa) setSiswaList(siswa);
    };
    fetchInitial();
  }, []);

  // 2. Load Bimbingan when Guru Selected
  useEffect(() => {
    if (selectedGuru) {
      fetchBimbingan();
    } else {
      setAssignedSiswaIds(new Set());
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGuru]);

  const fetchBimbingan = async () => {
    if (!selectedGuru) return;
    setLoading(true);
    const { data } = await supabase.from('bimbingan').select('id_siswa').eq('id_guru', selectedGuru);
    if (data) {
      setAssignedSiswaIds(new Set(data.map(item => item.id_siswa)));
    }
    setLoading(false);
  };

  // Logic to execute DB changes
  const executeToggle = async (id_siswa: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('bimbingan')
          .delete()
          .eq('id_guru', selectedGuru)
          .eq('id_siswa', id_siswa);
        if (error) throw error;
      } else {
        // Add assignment
        const { error } = await supabase
          .from('bimbingan')
          .insert([{ id_guru: selectedGuru, id_siswa: id_siswa }]);
        if (error) throw error;

        // Tambahkan Toast Sukses TEPAT DI TENGAH
        showToast('Berhasil simpan anggota binaan', 'success', 2000, 'center');
        setSearchTerm(''); 
      }
      
      // Optimistic update for UI responsiveness
      const newSet = new Set(assignedSiswaIds);
      if (isAssigned) newSet.delete(id_siswa);
      else newSet.add(id_siswa);
      setAssignedSiswaIds(newSet);

    } catch (e) {
      showToast('Gagal mengubah data', 'error');
      fetchBimbingan(); // Revert on error
    }
  };

  // Handler triggered by checkbox click
  const handleToggleClick = (siswa: Siswa, isAssigned: boolean) => {
    if (!selectedGuru) {
      showToast('Pilih Guru Wali terlebih dahulu', 'error');
      return;
    }

    if (isAssigned) {
      // Jika sudah assigned (dicentang) dan diklik -> berarti ingin menghapus (uncheck)
      // Tampilkan Konfirmasi
      setPendingRemoval({ id: siswa.id, nama: siswa.nama });
    } else {
      // Jika belum assigned -> berarti ingin menambah
      // Langsung eksekusi
      executeToggle(siswa.id, false);
    }
  };

  const handleConfirmRemoval = () => {
    if (pendingRemoval) {
      executeToggle(pendingRemoval.id, true); // true indicates "currently assigned", so logic will delete
      setPendingRemoval(null);
    }
  };

  const filteredSiswa = siswaList
    .filter(s => {
      const matchSearch = s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm);
      const matchKelas = filterKelas === '' || s.id_kelas === filterKelas;
      return matchSearch && matchKelas;
    })
    .sort((a, b) => {
      const aAssigned = assignedSiswaIds.has(a.id);
      const bAssigned = assignedSiswaIds.has(b.id);
      
      // Sort priority 1: Assigned (Checked) items go to top
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      
      // Sort priority 2: Alphabetical name
      return a.nama.localeCompare(b.nama);
    });

  return (
    <div>
      {/* Dialog Konfirmasi Hapus Anggota */}
      <ConfirmDialog 
        isOpen={!!pendingRemoval}
        message={`Apakah Anda yakin menghapus anggota ${pendingRemoval?.nama}?`}
        onConfirm={handleConfirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />

      <h2 className="text-2xl font-bold text-white mb-6">Manajemen Anggota GurWal</h2>
      <p className="text-gray-400 mb-4">
        Tetapkan siswa binaan kepada guru. Siswa yang dipilih di sini akan muncul di menu <strong>Binaan</strong> pada dashboard Guru tersebut.
      </p>

      {/* Main Filter Section */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Pilih Guru (Calon Guru Wali)</label>
        <div className="flex flex-col md:flex-row gap-4 items-center">
            <select
            value={selectedGuru}
            onChange={(e) => setSelectedGuru(e.target.value)}
            className="w-full md:w-1/2 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
            >
            <option value="">-- Pilih Guru --</option>
            {guruWaliList.map(g => (
                <option key={g.id} value={g.id}>{g.nama} - {g.nip || 'No NIP'}</option>
            ))}
            </select>
            {selectedGuru && (
                 <span className="text-sm text-green-400 bg-green-900/30 px-3 py-1 rounded-full border border-green-800 font-medium">
                    ✅ Guru Terpilih
                 </span>
            )}
        </div>
        {!selectedGuru && <p className="text-yellow-500 text-sm mt-2">Silakan pilih guru terlebih dahulu untuk mengelola siswa binaannya.</p>}
      </div>

      {/* Siswa List Section */}
      {selectedGuru && (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Cari Siswa / NISN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
              />
            </div>
            <div className="w-full md:w-64">
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="">Semua Kelas</option>
                {kelasOptions.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-gray-800 shadow overflow-hidden rounded-lg border border-gray-700">
            {loading ? <p className="p-4 text-gray-400">Memuat data bimbingan...</p> : (
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase w-10">Pilih</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nama Siswa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Kelas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredSiswa.map(siswa => {
                    const isAssigned = assignedSiswaIds.has(siswa.id);
                    return (
                      <tr 
                        key={siswa.id} 
                        className={`transition-all duration-300 ${isAssigned 
                            ? 'bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.15)] border-l-4 border-green-500' // EFEK LAMPU HIJAU
                            : 'hover:bg-gray-700 border-l-4 border-transparent'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => handleToggleClick(siswa, isAssigned)}
                            className="w-5 h-5 text-green-500 border-gray-300 rounded focus:ring-green-500 bg-gray-700 cursor-pointer accent-green-600"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`font-medium ${isAssigned ? 'text-green-400 drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]' : 'text-white'}`}>
                              {siswa.nama}
                            </div>
                            <div className="text-xs text-gray-500">{siswa.nisn}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                            {siswa.kelas?.nama || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isAssigned ? (
                            <span className="bg-green-900 text-green-200 text-xs px-2 py-1 rounded-full font-bold border border-green-700 shadow-[0_0_5px_rgba(34,197,94,0.4)]">
                                ✓ Binaan Aktif
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSiswa.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500">Tidak ada siswa ditemukan.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};