// ============================================================
// Splash.tsx — Écran de démarrage Ping Manager
// À coller dans un projet Google AI Studio (React + TypeScript)
// ============================================================
import { useEffect, useState } from 'react';

import trophyUrl from './public/logo.png';

const SPARKS = [
  { x: 0,   delay: 1.0, dx: 0,   dist: 100 },
  { x: -26, delay: 1.3, dx: -14, dist: 80 },
  { x: 20,  delay: 1.6, dx: 7,   dist: 110 },
  { x: -10, delay: 1.9, dx: -3,  dist: 130 },
  { x: 28,  delay: 2.2, dx: 10,  dist: 90 },
  { x: -30, delay: 2.5, dx: -15, dist: 95 },
];

export default function Splash({ onDone }: { onDone?: () => void }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Cache le splash après 2,6 s (ou appelle onDone quand ton app est prête)
    const t = setTimeout(() => { setHidden(true); onDone?.(); }, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  if (hidden) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="pm-splash">
        <div className="pm-splash__stage">
          <img className="pm-splash__trophy" src={trophyUrl} alt="Ping Manager" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="pm-splash__spark"
              style={{
                left: `calc(50% + ${s.x}px - 3px)`,
                top: 30,
                animationDelay: `${s.delay}s`,
                // @ts-ignore — variables CSS custom
                '--dx': `${s.dx}px`,
                '--dist': `${s.dist}px`,
              }}
            />
          ))}
        </div>
        <div className="pm-splash__word">
          <b>Ping<span>Manager</span></b>
          <div className="pm-splash__tag">GÉREZ&nbsp;&nbsp;VOS&nbsp;&nbsp;TOURNOIS</div>
        </div>
      </div>
    </>
  );
}

const CSS = `
.pm-splash{
  --pm-bg:#0a1729;--pm-paper:#fbf9f5;--pm-orange:#f26a1f;--pm-amber:#ffb84a;
  position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:22px;background:var(--pm-bg);
  font-family:"Inter",system-ui,sans-serif;
  animation:pm-splash-out 700ms ease 2.6s forwards;
}
.pm-splash__stage{position:relative;}
.pm-splash__trophy{
  height:200px;width:auto;display:block;transform-origin:50% 80%;
  filter:drop-shadow(0 8px 30px rgba(242,106,31,.35));
  animation:pm-rise 800ms cubic-bezier(.34,1.56,.64,1) both,
            pm-flicker 1.8s ease-in-out 800ms infinite;
}
.pm-splash__spark{
  position:absolute;width:7px;height:7px;border-radius:50%;
  background:radial-gradient(circle,#ffe6a8 0%,#f26a1f 60%,transparent 100%);
  animation:pm-spark 2s ease-out infinite;pointer-events:none;
}
.pm-splash__word{text-align:center;opacity:0;animation:pm-word 600ms ease-out 700ms forwards;}
.pm-splash__word b{font-weight:800;letter-spacing:-.04em;font-size:52px;color:var(--pm-paper);}
.pm-splash__word b span{font-weight:300;}
.pm-splash__tag{margin-top:10px;font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:.3em;color:var(--pm-amber);font-weight:600;}
@keyframes pm-rise{0%{opacity:0;transform:translateY(60px) scale(.85);}70%{opacity:1;transform:translateY(-8px) scale(1.03);}100%{opacity:1;transform:translateY(0) scale(1);}}
@keyframes pm-flicker{0%,100%{filter:brightness(1) drop-shadow(0 8px 26px rgba(242,106,31,.35));}35%{filter:brightness(1.14) drop-shadow(0 8px 34px rgba(255,184,74,.55));}70%{filter:brightness(.97) drop-shadow(0 8px 22px rgba(242,106,31,.3));}}
@keyframes pm-spark{0%{opacity:0;transform:translate(0,0) scale(.5);}15%{opacity:1;transform:translate(var(--dx,0),-10px) scale(1);}100%{opacity:0;transform:translate(var(--dx,0),calc(-1 * var(--dist,90px))) scale(.3);}}
@keyframes pm-word{0%{opacity:0;transform:translateY(12px);}100%{opacity:1;transform:translateY(0);}}
@keyframes pm-splash-out{to{opacity:0;visibility:hidden;}}
@media (prefers-reduced-motion:reduce){
  .pm-splash__trophy{animation:none;}.pm-splash__spark{display:none;}
  .pm-splash__word{animation:none;opacity:1;}.pm-splash{animation:pm-splash-out 400ms ease 2s forwards;}
}
`;
