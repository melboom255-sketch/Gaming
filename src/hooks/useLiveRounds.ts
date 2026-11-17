import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLiveRounds } from '@/src/services/platformService';
import type { LiveRoundsSnapshot } from '@/src/types/platform';

export function useLiveRounds(room: 'keno' | 'bingo') {
  const [rounds, setRounds] = useState<LiveRoundsSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const fallbackPollRef = useRef<number | null>(null);

  const retryNow = useCallback(() => {
    setLiveError(null);
    setRetryToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let unmounted = false;
    let ws: WebSocket | null = null;
    let attempts = 0;
    let httpFailures = 0;

    const pullHttp = () =>
      fetchLiveRounds()
        .then((snap) => {
          if (!unmounted) {
            httpFailures = 0;
            setLiveError(null);
            setRounds(snap);
          }
        })
        .catch((err) => {
          if (!unmounted) {
            httpFailures += 1;
            if (httpFailures >= 2) {
              setLiveError(
                err instanceof Error
                  ? err.message
                  : 'Unable to reach live game clock.'
              );
            }
          }
        });

    // Immediate HTTP sync so UI renders right away while WebSocket upgrades
    void pullHttp();

    const startFallbackPolling = () => {
      if (fallbackPollRef.current !== null) return;
      fallbackPollRef.current = window.setInterval(() => {
        void pullHttp();
      }, 1000);
    };

    const stopFallbackPolling = () => {
      if (fallbackPollRef.current !== null) {
        window.clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
    };

    const connectWs = () => {
      if (unmounted || typeof window === 'undefined') return;
      if (typeof WebSocket === 'undefined') {
        startFallbackPolling();
        return;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/live-rounds`;

      try {
        ws = new WebSocket(wsUrl);
      } catch {
        startFallbackPolling();
        return;
      }

      ws.onopen = () => {
        if (unmounted) {
          ws?.close();
          return;
        }
        attempts = 0;
        setConnected(true);
        setLiveError(null);
        stopFallbackPolling();
        try {
          ws?.send(JSON.stringify({ type: 'presence:join', room }));
        } catch {
          // Ignore send failure during close
        }
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            data?: LiveRoundsSnapshot;
          };
          if (msg.type === 'rounds:sync' && msg.data) {
            setLiveError(null);
            setRounds(msg.data);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        startFallbackPolling();
        attempts += 1;
        const delayMs = Math.min(8000, 1000 * Math.pow(1.5, Math.min(attempts, 5)));
        reconnectTimerRef.current = window.setTimeout(connectWs, delayMs);
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // Ignore close failure
        }
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      stopFallbackPolling();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [room, retryToken]);

  return {
    rounds,
    setRounds,
    connected,
    liveError,
    retryNow,
  };
}
