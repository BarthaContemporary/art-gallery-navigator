
import { useState, useEffect } from "react";

interface ConnectionInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  saveData: boolean;
  isOnline: boolean;
  rtt: number;
  downlink: number;
}

interface AdaptiveSettings {
  maxPreloadRadius: number;
  preferredImageTier: 'thumbnail' | 'medium' | 'full';
  enablePreloading: boolean;
  loadTimeout: number;
}

export function useConnectionMonitor() {
  const [connectionInfo, setConnectionInfo] = useState<Partial<ConnectionInfo>>({
    isOnline: true,
    effectiveType: '4g',
    saveData: false,
    rtt: 100,
    downlink: 10
  });

  const [adaptiveSettings, setAdaptiveSettings] = useState<AdaptiveSettings>({
    maxPreloadRadius: 3,
    preferredImageTier: 'medium',
    enablePreloading: true,
    loadTimeout: 5000
  });

  useEffect(() => {
    const updateConnectionInfo = () => {
      const connection = (navigator as any).connection;
      const isOnline = navigator.onLine;

      if (connection) {
        setConnectionInfo({
          effectiveType: connection.effectiveType || '4g',
          saveData: connection.saveData || false,
          isOnline,
          rtt: connection.rtt || 100,
          downlink: connection.downlink || 10
        });
      } else {
        setConnectionInfo(prev => ({ ...prev, isOnline }));
      }
    };

    // Initial check
    updateConnectionInfo();

    // Listen for connection changes
    window.addEventListener('online', updateConnectionInfo);
    window.addEventListener('offline', updateConnectionInfo);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', updateConnectionInfo);
      window.removeEventListener('offline', updateConnectionInfo);
      
      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, []);

  // Update adaptive settings based on connection
  useEffect(() => {
    const { effectiveType, saveData, isOnline, rtt } = connectionInfo;

    if (!isOnline) {
      setAdaptiveSettings({
        maxPreloadRadius: 0,
        preferredImageTier: 'thumbnail',
        enablePreloading: false,
        loadTimeout: 1000
      });
      return;
    }

    if (saveData) {
      setAdaptiveSettings({
        maxPreloadRadius: 1,
        preferredImageTier: 'thumbnail',
        enablePreloading: false,
        loadTimeout: 3000
      });
      return;
    }

    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        setAdaptiveSettings({
          maxPreloadRadius: 1,
          preferredImageTier: 'thumbnail',
          enablePreloading: false,
          loadTimeout: 8000
        });
        break;
      
      case '3g':
        setAdaptiveSettings({
          maxPreloadRadius: 2,
          preferredImageTier: 'medium',
          enablePreloading: true,
          loadTimeout: 6000
        });
        break;
      
      case '4g':
      default:
        const isFastConnection = (rtt || 100) < 200;
        setAdaptiveSettings({
          maxPreloadRadius: isFastConnection ? 3 : 2,
          preferredImageTier: isFastConnection ? 'full' : 'medium',
          enablePreloading: true,
          loadTimeout: isFastConnection ? 3000 : 5000
        });
        break;
    }
  }, [connectionInfo]);

  return {
    connectionInfo,
    adaptiveSettings,
    isSlowConnection: connectionInfo.effectiveType === 'slow-2g' || 
                     connectionInfo.effectiveType === '2g' ||
                     connectionInfo.saveData || 
                     !connectionInfo.isOnline
  };
}
