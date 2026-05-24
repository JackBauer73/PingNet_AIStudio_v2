import React from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();
  
  if (isOnline) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-center py-3 text-sm font-bold shadow-lg animate-bounce">
      📵 Pas de réseau — Les scores seront envoyés dès la reconnexion
    </div>
  );
}
