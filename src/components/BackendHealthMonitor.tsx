import { useEffect } from 'react';
import { startHealthPolling } from '../services/backendHealthService';

const BackendHealthMonitor: React.FC = () => {
  useEffect(() => {
    // Start health checks (immediately + every 30 minutes)
    const cleanup = startHealthPolling(30 * 60 * 1000);

    // Cleanup on component unmount
    return cleanup;
  }, []);

  // This component renders nothing
  return null;
};

export default BackendHealthMonitor;