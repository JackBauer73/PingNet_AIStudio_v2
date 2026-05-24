import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => { 
      setIsOnline(true);  
      toast.success('✅ Reconnecté !'); 
    };
    const off = () => { 
      setIsOnline(false); 
      toast.error('📵 Connexion perdue'); 
    };

    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    return () => { 
      window.removeEventListener('online', on); 
      window.removeEventListener('offline', off); 
    };
  }, []);

  return isOnline;
}
