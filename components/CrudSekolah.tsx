import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Sekolah } from '../types';

interface CrudSekolahProps {
  showToast: (msg: string, type: 'success' | 'error', duration?: number, position?: 'top-right' | 'center') => void;
}

export const CrudSekolah: React.FC<CrudSekolahProps> = ({ showToast }) => {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<Sekolah>>({
    nama: '',
    npsn: '',
    alamat: '',
    email: '',
    no_telp: '',
    logo_url: ''
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sekolah')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;

      if (data) {
        setFormData(data);
      }
    } catch (error: any) {
      console.error('Error fetching data sekolah:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use a fixed UUID for Singleton pattern if no ID exists
      const singletonId = "00000000-0000-0000-0000-000000000001";
      
      const payload = {
        id: formData.id || singletonId,
        nama: formData.nama || '', // Column is 'nama', matches updated type
        npsn: formData.npsn || null,
        alamat: formData.alamat || null,
        email: formData.email || null,
        no_telp: formData.no_telp || null,
        logo_url: formData.logo_url || null
      };

      const { error } = await supabase
        .from('sekolah')
        .upsert([payload], { onConflict: 'id' });

      if (error) throw error;

      showToast('✅ Data sekolah berhasil disimpan!', 'success');
      fetchData(); 
    } catch (error: any) {
      console.error('Error saving data:', error);
      showToast('❌ Gagal menyimpan data sekolah: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-2">🏫 Pengaturan Sekolah</h2>
      <p className="text-gray-400 mb-8">Kelola identitas instansi dan logo sekolah (menggunakan URL gambar).</p>

      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="flex flex-col md:flex-row gap-8 items-start mb-8 border-b border-gray-700 pb-8">
            {/* Logo Preview & Input */}
            <div className="w-full md:w-1/3 flex flex-col items-center">
                <label className="block text-sm font-medium text-gray-300 mb-3">Preview Logo</label>
                <div className="relative w-40 h-40 bg-gray-700 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center overflow-hidden mb-4">
                    {formData.logo_url ? (
                        <img 
                          src={formData.logo_url} 
                          alt="Logo Sekolah" 
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                    ) : (
                        <div className="text-center p-4">
                             <span className="text-4xl block mb-2">🏫</span>
                             <span className="text-xs text-gray-400">Belum ada logo</span>
                        </div>
                    )}
                </div>
                
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-300 mb-1">URL Logo Sekolah</label>
                    <input 
                        type="text" 
                        name="logo_url"
                        value={formData.logo_url || ''}
                        onChange={handleInputChange}
                        placeholder="https://example.com/logo.png"
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">Tempelkan tautan gambar langsung</p>
                </div>
            </div>

            {/* Form Fields */}
            <div className="w-full md:w-2/3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nama Sekolah</label>
                        <input
                            type="text"
                            name="nama"
                            value={formData.nama || ''}
                            onChange={handleInputChange}
                            placeholder="Contoh: SMKN 1 INDONESIA"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">NPSN</label>
                        <input
                            type="text"
                            name="npsn"
                            value={formData.npsn || ''}
                            onChange={handleInputChange}
                            placeholder="Nomor Pokok Sekolah Nasional"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email Sekolah</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleInputChange}
                            placeholder="admin@sekolah.sch.id"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nomor Telepon</label>
                        <input
                            type="text"
                            name="no_telp"
                            value={formData.no_telp || ''}
                            onChange={handleInputChange}
                            placeholder="021-xxxxxxx"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Alamat Lengkap</label>
                    <textarea
                        name="alamat"
                        rows={3}
                        value={formData.alamat || ''}
                        onChange={handleInputChange}
                        placeholder="Jalan, Kelurahan, Kecamatan, Kota/Kabupaten..."
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2.5 text-white focus:ring-primary focus:border-primary"
                    />
                </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
                {loading ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};