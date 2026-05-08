const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface HealthStatus {
  ok: boolean;
  statusCode?: number;
  message?: string;
  timestamp: string;
  url: string;
}

export const checkBackendHealth = async (): Promise<HealthStatus> => {
  const url = `${BACKEND_URL}/health`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const ok = response.ok;
    const statusCode = response.status;

    let message = ok ? '✅ Backend is healthy' : `⚠️ Backend responded with status ${statusCode}`;
    if (statusCode === 503) {
      message = '❌ Backend is unavailable (503). It might be spinning down or down.';
    }

    console.log(`[Health Check] ${new Date().toISOString()} - ${message}`, { statusCode, url });

    return {
      ok,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      url,
    };
  } catch (error: any) {
    console.error(`[Health Check] ${new Date().toISOString()} - ❌ Network error:`, error.message);
    return {
      ok: false,
      message: `Network error: ${error.message}`,
      timestamp: new Date().toISOString(),
      url,
    };
  }
};

// Optional: Start periodic polling
export const startHealthPolling = (intervalMs: number = 30 * 60 * 1000) => {
  // Check immediately on load
  checkBackendHealth();

  // Then every `intervalMs`
  const intervalId = setInterval(() => {
    checkBackendHealth();
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
};