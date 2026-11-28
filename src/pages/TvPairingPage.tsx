import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/signageApi';

/** Shown on a TV that does not know its screen yet. The admin adopts the code in the CMS (Control Center). */
export const TvPairingPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const codeRef = useRef('');

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const embedded = new URLSearchParams(window.location.search).get('embedded') === '1';
    if (embedded) window.parent.postMessage({ type: 'dypiu-os', event: 'pairing' }, '*');

    const start = async () => {
      try {
        const res = await fetch(`${API_BASE}/device/pair/start`, { method: 'POST' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Pairing is not available.');
        codeRef.current = json.code;
        setCode(json.code);
        setSecondsLeft(json.expiresInSeconds || 600);
        setError('');
      } catch {
        setError('Cannot reach the NEXORA server. Retrying…');
        codeRef.current = '';
        setCode('');
      }
    };

    const tick = async () => {
      if (stopped) return;
      if (!codeRef.current) {
        await start();
      } else {
        try {
          const res = await fetch(`${API_BASE}/device/pair/status/${codeRef.current}`);
          const json = await res.json();
          if (json.state === 'paired' && json.screenId) {
            try {
              window.localStorage.setItem('nexora_screen_id', json.screenId);
              window.localStorage.setItem('nexora_device_key', json.deviceKey || '');
            } catch {
              /* storage unavailable: the URL below still carries the id */
            }
            const key = json.deviceKey ? `&key=${encodeURIComponent(json.deviceKey)}` : '';
            window.location.replace(`/tv?kiosk=1&ticker=1${embedded ? '&embedded=1' : ''}&tv=${encodeURIComponent(json.screenId)}${key}`);
            return;
          }
          if (json.state === 'expired') {
            codeRef.current = '';
            await start();
          }
        } catch {
          setError('Waiting for the NEXORA server…');
        }
      }
      timer = window.setTimeout(tick, 3000);
    };

    tick();
    const countdown = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(countdown);
    };
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0F051D',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        gap: 18,
        padding: 32,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 20, padding: 14 }}>
        <img src="/dypiu-logo.png" alt="DYPIU" style={{ width: 150, display: 'block' }} />
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: '#EEE3B0', letterSpacing: 3 }}>NEXORA TV</div>
      <div style={{ fontSize: 20, opacity: 0.7 }}>Pair this display</div>
      <div
        style={{
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: 14,
          fontFamily: 'monospace',
          background: 'rgba(255,255,255,0.08)',
          border: '2px solid rgba(238,227,176,0.4)',
          borderRadius: 18,
          padding: '14px 40px',
          minWidth: 480,
        }}
      >
        {code || '······'}
      </div>
      <div style={{ fontSize: 20, maxWidth: 720, lineHeight: 1.5, opacity: 0.85 }}>
        On your computer open the NEXORA CMS → <b>Control Center</b> → <b>New TVs found on the network</b>, give this
        TV a name and click <b>Adopt TV</b>.
      </div>
      <div style={{ fontSize: 16, opacity: 0.5 }}>
        {error || (code ? `Code valid for ${mm}:${ss}` : 'Requesting a code…')}
      </div>
    </div>
  );
};
