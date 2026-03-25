import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';
import type { SseEvent } from '@/shared/types';

interface UseSseOptions {
  onEvent: (event: SseEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export function useJobSse(jobId: string, options: UseSseOptions) {
  const { accessToken } = useAuthStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const { onEvent, onError, enabled = true } = options;

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!jobId || !enabled || !accessToken) return;

    const url = `/api/jobs/${jobId}/events?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SseEvent;
        onEventRef.current(event);
      } catch {
        // ignore parse errors
      }
    };

    // Handle typed events
    const eventTypes = [
      'EXECUTION_STARTED',
      'STEP_STARTED',
      'STEP_PROGRESSED',
      'STEP_COMPLETED',
      'STEP_FAILED',
      'EXECUTION_COMPLETED',
      'EXECUTION_CANCELLED',
      'RESULT_AVAILABLE',
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: Event) => {
        const msgEvent = e as MessageEvent;
        try {
          const event = JSON.parse(msgEvent.data) as SseEvent;
          onEventRef.current(event);
        } catch {
          // ignore
        }
      });
    });

    es.onerror = (e) => {
      onError?.(e);
      // Auto-reconnect after delay
      es.close();
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connect();
        }
      }, 5000);
    };
  }, [jobId, enabled, accessToken, onError]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);
}
