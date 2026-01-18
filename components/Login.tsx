import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Guru } from '../types';

interface LoginProps {
  onLoginSuccess: (user: Guru) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, showToast }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('guru')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        showToast('Username atau password salah', 'error');
        setLoading(false);
        return;
      }

      // Check role - Allow ADMIN, GURU, GURU_WALI, GURU_PENGAJAR
      if (['ADMIN', 'GURU', 'GURU_WALI', 'GURU_PENGAJAR'].includes(data.peran)) {
        showToast(`Login berhasil!`, 'success');
        
        // Activate redirect loading state
        setIsRedirecting(true);
        
        // Delay navigation to show spinner effect
        setTimeout(() => {
          onLoginSuccess(data);
        }, 1500);
      } else {
         showToast('Peran pengguna tidak dikenali.', 'error');
         setLoading(false);
      }

    } catch (err) {
      showToast('Terjadi kesalahan sistem', 'error');
      console.error(err);
      setLoading(false);
    }
  };

  // Full Screen Loading Spinner View
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <div className="relative">
          {/* Outer Ring */}
          <div className="w-16 h-16 rounded-full absolute border-4 border-solid border-gray-700"></div>
          {/* Inner Spinner */}
          <div className="w-16 h-16 rounded-full animate-spin absolute border-4 border-solid border-primary border-t-transparent shadow-md"></div>
        </div>
        <h2 className="mt-8 text-xl font-semibold text-white animate-pulse">
          Memuat Dashboard...
        </h2>
        <p className="text-gray-400 text-sm mt-2">Mohon tunggu sebentar</p>
      </div>
    );
  }

  // Login Form View
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white mb-6">Login GurWal</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 border p-2 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 border p-2 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all duration-200"
          >
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
};