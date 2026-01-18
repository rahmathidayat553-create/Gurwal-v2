import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  duration?: number;
  position?: 'top-right' | 'center';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type, 
  duration = 3000, 
  position = 'top-right', 
  onClose 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  
  // Base classes
  const baseClasses = `fixed z-[100] ${bgColor} text-white rounded shadow-2xl flex items-start gap-3 transition-all duration-300`;
  
  // Position classes
  let positionClasses = '';
  let containerClasses = '';

  if (position === 'center') {
    // For center, we want a modal-like appearance but auto-dismissing
    containerClasses = "fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"; // Container centers it
    positionClasses = "pointer-events-auto max-w-lg p-6 text-lg border-2 border-white/20 animate-bounce-in"; // Box style
  } else {
    // Default top-right
    positionClasses = "top-4 right-4 px-6 py-3 max-w-sm animate-slide-in";
  }

  const content = (
    <div className={`${baseClasses} ${positionClasses}`}>
      <span className="text-2xl">{type === 'success' ? '✅' : '⚠️'}</span>
      <div className="flex-1">
        <h4 className="font-bold mb-1">{type === 'success' ? 'Berhasil' : 'Peringatan'}</h4>
        <p className="font-medium whitespace-pre-wrap leading-relaxed">{message}</p>
      </div>
      <button onClick={onClose} className="opacity-75 hover:opacity-100 text-xl font-bold p-1">✕</button>
    </div>
  );

  if (position === 'center') {
    return (
      <div className={containerClasses}>
        {content}
      </div>
    );
  }

  return content;
};