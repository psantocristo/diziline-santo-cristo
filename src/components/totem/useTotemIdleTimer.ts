import { useEffect, useRef, useState, useCallback } from "react";

interface UseTotemIdleTimerOptions {
  timeoutSeconds?: number;
  onTimeout: () => void;
}

export function useTotemIdleTimer({
  timeoutSeconds = 120,
  onTimeout,
}: UseTotemIdleTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  onTimeoutRef.current = onTimeout;

  const reset = useCallback(() => {
    setSecondsLeft(timeoutSeconds);
  }, [timeoutSeconds]);

  // Detectar qualquer interação do usuário
  useEffect(() => {
    const events = ["mousemove", "mousedown", "touchstart", "touchmove", "keydown", "click"];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [reset]);

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTimeoutRef.current();
          return timeoutSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutSeconds]);

  return { secondsLeft, reset };
}
