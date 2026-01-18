import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Guru, Siswa, Kelas, Mapel, Nilai } from '../../types';

interface Props {
  currentUser: Guru;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const InputNilai: React.FC<Props> = ({ currentUser, showToast }) => {
  const [kelasOptions, setKelasOptions] = useState<Kelas[]>([]);
  const [mapelOptions, setMapelOptions] = useState<Mapel[]>([]);
  
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [selectedMapel, setSelectedMapel] = useState<string>('');
  
  const [students, setStudents] = useState<Siswa[]>([]);
  const [existingGrades, setExistingGrades] = useState<Nilai[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAssignments = async () => {
      const { data, error } = await supabase
        .from('pengajaran')
        .select('*, kelas(*), mapel(*)')
        .eq('id_guru', currentUser.id);

      if (!error && data) {
        // @ts-ignore
        setKelasOptions(Array.from(new Map(data.map(item => [item.id_kelas, item.kelas])).values()));
        // @ts-ignore
        setMapelOptions(Array.from(new Map(data.map(item => [item.id_mapel, item.mapel])).values()));
      }
    };
    fetchAssignments();
  }, [currentUser.id]);

  useEffect(() => {
    if (selectedKelas && selectedMapel) {
      const fetchData = async () => {
        setLoading(true);
        const { data: studentsData } = await supabase.from('siswa').select('*').eq('id_kelas', selectedKelas).order('nama');
        const studentIds = studentsData?.map(s => s.id) || [];
        
        let gradesData: Nilai[] = [];
        if (studentIds.length > 0) {
           const { data: grades } = await supabase.from('nilai').select('*').eq('id_guru', currentUser.id).eq('id_mapel', selectedMapel).in('id_siswa', studentIds);
           gradesData = grades || [];
        }
        setStudents(studentsData || []);
        setExistingGrades(gradesData);
        setLoading(false);
      };
      fetchData();
    }
  }, [selectedKelas, selectedMapel, currentUser.id]);

  const getGradeValue = (studentId: string, type: 'FORMATIF' | 'SUMATIF' | 'AKHIR_SUMATIF') => {
    return existingGrades.find(g => g.id_siswa === studentId && g.jenis === type)?.nilai || '';
  };

  const handleGradeChange = async (studentId: string, type: 'FORMATIF' | 'SUMATIF' | 'AKHIR_SUMATIF', value: string) => {
    const numVal = parseFloat(value);
    if (value !== '' && (isNaN(numVal) || numVal < 0 || numVal > 100)) return;
    
    const numericValue = value === '' ? null : numVal;
    const existing = existingGrades.find(g => g.id_siswa === studentId && g.jenis === type);
    
    try {
        if (numericValue === null) return;
        if (existing) {
             await supabase.from('nilai').update({ nilai: numericValue, tanggal: new Date().toISOString().split('T')[0] }).eq('id', existing.id);
        } else {
             await supabase.from('nilai').insert([{ id_guru: currentUser.id, id_siswa: studentId, id_mapel: selectedMapel, jenis: type, nilai: numericValue, tanggal: new Date().toISOString().split('T')[0] }]);
        }
        
        // Refresh local state to avoid flicker/stale data
        const { data } = await supabase.from('nilai').select('*').eq('id_guru', currentUser.id).eq('id_mapel', selectedMapel);
        if(data) setExistingGrades(data);
    } catch (e) {
        showToast('Gagal menyimpan', 'error');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Input Penilaian (Pengajar)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div>
           <label className="block text-sm font-medium text-gray-300 mb-1">Kelas</label>
           <select className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
             <option value="">-- Pilih Kelas --</option>
             {kelasOptions.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
           </select>
        </div>
        <div>
           <label className="block text-sm font-medium text-gray-300 mb-1">Mata Pelajaran</label>
           <select className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" value={selectedMapel} onChange={(e) => setSelectedMapel(e.target.value)}>
             <option value="">-- Pilih Mapel --</option>
             {mapelOptions.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
           </select>
        </div>
      </div>

      {selectedKelas && selectedMapel ? (
         <div className="bg-gray-800 shadow overflow-hidden rounded-lg border border-gray-700">
            {loading ? <p className="p-4 text-gray-400">Memuat...</p> : (
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nama Siswa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase w-32">Formatif</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase w-32">Sumatif</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase w-32">Akhir</th>
                </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                {students.map((student) => (
                    <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{student.nama}</td>
                    {(['FORMATIF', 'SUMATIF', 'AKHIR_SUMATIF'] as const).map(type => (
                        <td key={type} className="px-6 py-4">
                            <input type="number" className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-center"
                                placeholder="0-100" defaultValue={getGradeValue(student.id, type)}
                                onBlur={(e) => handleGradeChange(student.id, type, e.target.value)}
                            />
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
            )}
         </div>
      ) : <div className="p-10 text-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">Pilih Kelas & Mapel.</div>}
    </div>
  );
};