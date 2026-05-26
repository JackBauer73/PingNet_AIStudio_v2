import React, { useState, useEffect } from 'react';

interface Props {
  matchId: string;
  timeoutSeconds?: number;
  onTimeout: () => void;
  startTime?: string | Date;
}

export function ValidationCountdown({ matchId, timeoutSeconds = 120, onTimeout, startTime }: Props) {
  const [remaining, setRemaining] = useState(timeoutSeconds);

  useEffect(() => {
    // We compute countdown based on a newly mounted view or simulated timestamp
    const start = startTime ? new Date(startTime).getTime() : Date.now();
    const durationMs = timeoutSeconds * 1000;
    const expiresAt = start + durationMs;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(diff);

      if (diff === 0) {
        clearInterval(interval);
        onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [matchId, timeoutSeconds, startTime, onTimeout]);

  const percentage = Math.min(100, Math.max(0, (remaining / timeoutSeconds) * 100));

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 my-4 text-xs">
      <div className="flex justify-between items-center mb-1.5 font-semibold text-slate-400">
        <span>Validation automatique dans</span>
        <span className={remaining < 25 ? 'text-red-400 font-extrabold animate-pulse' : 'text-slate-200'}>
          {remaining}s
        </span>
      </div>
      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            remaining < 25 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-orange-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
export default ValidationCountdown;
