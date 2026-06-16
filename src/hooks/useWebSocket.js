import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const retryDelay = useRef(1000);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      console.log(`[WebSocket] Connecting to ${wsUrl}...`);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('[WebSocket] Connection established');
        retryDelay.current = 1000; // Reset retry delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      socket.onmessage = (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data);
          const { event, data } = payload;
          console.log(`[WebSocket] Received event: ${event}`, data);

          if (event === 'sync:completed') {
            toast.success('Live Sync Completed! Updating metrics...');
            // Invalidate React Query caches to trigger automatic reload of all UI values
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
            queryClient.invalidateQueries({ queryKey: ['productionData'] });
            queryClient.invalidateQueries({ queryKey: ['backendKPIs'] });
          } else if (event === 'alert:created') {
            const toastIcon = data.severity === 'CRITICAL' ? '🚨' : data.severity === 'WARNING' ? '⚠️' : 'ℹ️';
            toast(data.message, {
              icon: toastIcon,
              duration: 6000
            });
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
          } else if (event === 'timeline:created') {
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
          } else if (event === 'alerts:read_updated') {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
          } else if (event === 'alert_rules:changed') {
            queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message', err);
        }
      };

      socket.onclose = () => {
        console.log(`[WebSocket] Connection closed. Retrying in ${retryDelay.current}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 16000); // Exponential backoff max 16s
          connect();
        }, retryDelay.current);
      };

      socket.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
        socket.close();
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [queryClient]);

  return wsRef.current;
}
