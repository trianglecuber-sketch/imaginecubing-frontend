import { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, apiPost, apiGet } from './socket.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ms) {
  if (ms === null || ms === undefined || ms === Infinity) return '--:--.---';
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = ms % 1000;
  return m > 0
    ? `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(3,'0')}`
    : `${s}.${String(cs).padStart(3,'0')}`;
}

function parseManualTime(str) {
  // Accepts: 9.450  12.340  1:02.340
  str = str.trim();
  const mmss = str.match(/^(\d+):(\d{1,2})\.(\d{1,3})$/);
  const ss   = str.match(/^(\d+)\.(\d{1,3})$/);
  if (mmss) {
    const ms = parseInt(mmss[1])*60000 + parseInt(mmss[2])*1000 + parseInt(mmss[3].padEnd(3,'0'));
    return ms > 0 ? ms : null;
  }
  if (ss) {
    const ms = parseInt(ss[1])*1000 + parseInt(ss[2].padEnd(3,'0'));
    return ms > 0 ? ms : null;
  }
  return null;
}

const STATIC_LB = [
  { rank:1, username:'CubeKing99',  elo:1987, pb:'7.12s', wins:284 },
  { rank:2, username:'SpeedDemon',  elo:1876, pb:'7.89s', wins:201 },
  { rank:3, username:'TwistyFast',  elo:1754, pb:'8.34s', wins:178 },
  { rank:4, username:'RotateQueen', elo:1689, pb:'9.01s', wins:143 },
  { rank:5, username:'AlgoMaster',  elo:1634, pb:'9.78s', wins:129 },
];

const EVENT_COLORS = { '3x3':'#00d4ff','2x2':'#7c3aed','4x4':'#ff4060','5x5':'#ff8c00','OH':'#ffd700' };

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08090f;--bg2:#0d0f1a;--bg3:#12152a;--card:#0f1220;--card2:#141828;
  --border:#1e2340;--border2:#2a3060;
  --cyan:#00d4ff;--cyan2:#00a8cc;--purple:#7c3aed;--green:#00ff94;
  --red:#ff4060;--orange:#ff8c00;--yellow:#ffd700;
  --text:#e8ecff;--text2:#8892b0;--text3:#4a5568;
  --glow:0 0 20px rgba(0,212,255,0.3);--glow2:0 0 40px rgba(0,212,255,0.15);
}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;overflow-x:hidden}
.bg-grid{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(0,212,255,.03)1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.03)1px,transparent 1px);background-size:60px 60px;pointer-events:none}
.bg-glow{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(0,212,255,.08)0%,transparent 70%);pointer-events:none}
.app{position:relative;z-index:1;min-height:100vh}
nav{display:flex;align-items:center;justify-content:space-between;padding:0 2rem;height:56px;background:rgba(8,9,15,.9);border-bottom:1px solid var(--border);backdrop-filter:blur(20px);position:sticky;top:0;z-index:100}
.nav-logo{font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:900;letter-spacing:2px;cursor:pointer}
.nav-logo .c{color:var(--cyan)}.nav-logo .r{color:var(--text)}
.nav-links{display:flex;gap:.25rem;align-items:center}
.nav-link{padding:.4rem 1rem;border-radius:6px;cursor:pointer;font-size:.9rem;font-weight:600;letter-spacing:.5px;color:var(--text2);transition:all .2s;border:none;background:none}
.nav-link:hover{color:var(--text);background:var(--bg3)}.nav-link.active{color:var(--cyan);background:rgba(0,212,255,.08)}
.nav-actions{display:flex;gap:.5rem;align-items:center}
.btn{padding:.45rem 1.2rem;border-radius:8px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.9rem;letter-spacing:.5px;transition:all .2s;border:none}
.btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border)}.btn-ghost:hover{border-color:var(--border2);color:var(--text)}
.btn-primary{background:var(--cyan);color:#000;font-weight:800}.btn-primary:hover{background:#00eeff;box-shadow:var(--glow);transform:translateY(-1px)}
.btn-green{background:var(--green);color:#000;font-weight:800}.btn-green:hover{background:#00ffaa;box-shadow:0 0 20px rgba(0,255,148,.4)}
.btn-purple{background:var(--purple);color:#fff}.btn-purple:hover{background:#8b5cf6}
.btn-danger{background:var(--red);color:#fff}.btn-danger:hover{background:#ff6080}
.btn-lg{padding:.75rem 2rem;font-size:1.1rem}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
.hero{text-align:center;padding:5rem 2rem 4rem;display:flex;flex-direction:column;align-items:center;gap:1.5rem}
.hero-title{font-family:'Orbitron',sans-serif;font-size:clamp(3rem,8vw,5.5rem);font-weight:900;letter-spacing:4px;line-height:1}
.hero-title .cube{color:#fff}.hero-title .race{color:var(--cyan);text-shadow:0 0 30px rgba(0,212,255,.6)}
.hero-sub{color:var(--text2);font-size:1.05rem;max-width:480px;line-height:1.6}
.hero-actions{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center}
.stats-row{display:flex;gap:3rem;justify-content:center;margin-top:1rem;flex-wrap:wrap}
.stat-num{font-family:'Orbitron',sans-serif;font-size:2rem;font-weight:700;color:var(--cyan)}
.stat-label{font-size:.8rem;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-top:.2rem}
.page{padding:2rem;max-width:1100px;margin:0 auto}
.page-title{font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:700;color:var(--text);margin-bottom:1.5rem;display:flex;align-items:center;gap:.6rem}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.5rem;transition:border-color .2s}
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
.rooms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.room-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.2rem;cursor:pointer;transition:all .2s}
.room-card:hover{border-color:var(--cyan);transform:translateY(-2px);box-shadow:var(--glow2)}
.room-card.full{opacity:.5;cursor:not-allowed}
.room-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.8rem}
.room-name{font-size:1rem;font-weight:700;color:var(--text)}
.badge{padding:.2rem .6rem;border-radius:20px;font-size:.7rem;font-weight:800;letter-spacing:1px;text-transform:uppercase}
.badge-ranked{background:rgba(255,140,0,.15);color:var(--orange);border:1px solid rgba(255,140,0,.3)}
.badge-casual{background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3)}
.badge-h2h{background:rgba(0,255,148,.1);color:var(--green);border:1px solid rgba(0,255,148,.3)}
.badge-live{background:rgba(255,64,96,.15);color:var(--red);border:1px solid rgba(255,64,96,.3);display:flex;align-items:center;gap:.3rem}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--red);animation:pulse 1s ease-in-out infinite}
.room-meta{display:flex;gap:1.5rem;color:var(--text2);font-size:.85rem}
.room-meta span{display:flex;align-items:center;gap:.3rem}
.event-dot{width:10px;height:10px;border-radius:2px;display:inline-block}
.race-layout{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
.player-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:1.5rem;position:relative}
.player-card.you{border-color:var(--cyan);box-shadow:var(--glow2)}
.player-card.active-turn{border-color:var(--green);box-shadow:0 0 30px rgba(0,255,148,.15)}
.player-card.waiting-turn{opacity:.6}
.player-label{font-size:.7rem;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:.5rem}
.player-name{font-family:'Orbitron',sans-serif;font-size:.95rem;font-weight:700;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
.elo-badge{background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);color:var(--cyan);padding:.1rem .5rem;border-radius:4px;font-size:.75rem;font-family:'JetBrains Mono',monospace}
.scramble-box{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:1rem;margin:1rem 0}
.scramble-label{font-size:.7rem;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:.5rem}
.scramble-text{font-family:'JetBrains Mono',monospace;font-size:.9rem;color:var(--text);line-height:1.7;word-break:break-word}
.scramble-blur{filter:blur(8px);user-select:none}
.ready-text{font-family:'Orbitron',sans-serif;font-size:2.5rem;font-weight:900;color:var(--text);text-align:center;margin:1.5rem 0}
.hint-text{text-align:center;color:var(--text3);font-size:.85rem;margin-top:.5rem}
.timer-display{font-family:'Orbitron',sans-serif;font-size:4rem;font-weight:700;text-align:center;padding:1.5rem 0;letter-spacing:2px;transition:color .1s}
.timer-display.running{color:var(--green);text-shadow:0 0 20px rgba(0,255,148,.5)}
.timer-display.stopped{color:var(--cyan);text-shadow:var(--glow)}
.timer-display.idle{color:var(--text2)}.timer-display.holding{color:var(--orange)}
.inspect-bar{height:4px;background:var(--border);border-radius:2px;margin:.5rem 0;overflow:hidden}
.inspect-fill{height:100%;border-radius:2px;transition:width .1s linear,background .2s}
.overlay{position:fixed;inset:0;z-index:200;background:rgba(8,9,15,.92);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem}
.countdown-num{font-family:'Orbitron',sans-serif;font-size:8rem;font-weight:900;color:var(--cyan);text-shadow:0 0 60px rgba(0,212,255,.8);animation:countAnim .8s ease-out}
.countdown-label{font-size:1rem;color:var(--text2);letter-spacing:4px;text-transform:uppercase}
.countdown-sub{font-size:.85rem;color:var(--text3);letter-spacing:2px}
@keyframes countAnim{0%{transform:scale(1.5);opacity:0}30%{opacity:1}100%{transform:scale(1);opacity:1}}
.result-card{background:var(--card);border:2px solid var(--cyan);border-radius:20px;padding:3rem;text-align:center;max-width:480px;width:90%;box-shadow:var(--glow),0 0 80px rgba(0,212,255,.1)}
.result-title{font-family:'Orbitron',sans-serif;font-size:1.8rem;font-weight:900;margin-bottom:1.5rem}
.result-times{display:flex;gap:2rem;justify-content:center;margin:1.5rem 0}
.result-time-item{text-align:center}
.result-time-num{font-family:'Orbitron',sans-serif;font-size:2rem;font-weight:700;color:var(--cyan)}
.result-time-label{font-size:.8rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-top:.3rem}
.result-actions{display:flex;gap:1rem;justify-content:center;margin-top:1.5rem}
.status-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:20px;font-size:.85rem;font-weight:600;letter-spacing:.5px}
.status-waiting{background:rgba(74,85,104,.2);color:var(--text3);border:1px solid var(--border)}
.status-ready{background:rgba(0,212,255,.1);color:var(--cyan);border:1px solid rgba(0,212,255,.3)}
.status-solving{background:rgba(0,255,148,.1);color:var(--green);border:1px solid rgba(0,255,148,.3);animation:statusPulse 1.5s ease-in-out infinite}
.status-finished{background:rgba(0,212,255,.1);color:var(--cyan);border:1px solid rgba(0,212,255,.3)}
.status-inspecting{background:rgba(255,215,0,.1);color:var(--yellow);border:1px solid rgba(255,215,0,.3);animation:statusPulse 2s ease-in-out infinite}
.status-your-turn{background:rgba(0,255,148,.15);color:var(--green);border:1px solid rgba(0,255,148,.4);animation:statusPulse 1s ease-in-out infinite}
@keyframes statusPulse{0%,100%{opacity:1}50%{opacity:.6}}
.lb-table{width:100%;border-collapse:collapse}
.lb-table th{text-align:left;padding:.75rem 1rem;font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid var(--border)}
.lb-table td{padding:.9rem 1rem;border-bottom:1px solid var(--border);font-size:.95rem}
.lb-table tr:hover td{background:rgba(0,212,255,.03)}
.lb-rank{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--text3)}
.lb-rank.top1{color:var(--yellow)}.lb-rank.top2{color:#c0c0c0}.lb-rank.top3{color:#cd7f32}
.lb-elo{font-family:'JetBrains Mono',monospace;color:var(--cyan);font-weight:500}
.lb-pb{font-family:'JetBrains Mono',monospace;color:var(--green)}
.profile-header{display:flex;gap:2rem;align-items:center;margin-bottom:2rem;flex-wrap:wrap}
.avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--cyan));display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:1.8rem;font-weight:900;color:#fff;flex-shrink:0}
.pb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:1rem}
.pb-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem;text-align:center}
.pb-event{font-size:.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px}
.pb-time{font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:700;color:var(--cyan);margin-top:.3rem}
.divider{height:1px;background:var(--border);margin:1.5rem 0}
.auth-container{max-width:440px;margin:4rem auto;padding:0 1.5rem}
.auth-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2.5rem}
.auth-title{font-family:'Orbitron',sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:.5rem}
.auth-sub{color:var(--text2);font-size:.9rem;margin-bottom:2rem}
.form-group{margin-bottom:1.2rem}
.form-label{display:block;font-size:.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.5rem}
.form-input{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:1rem;transition:border-color .2s;outline:none}
.form-input:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,212,255,.1)}
.form-input::placeholder{color:var(--text3)}
.form-input.error{border-color:var(--red)}
.form-switch{text-align:center;margin-top:1.5rem;color:var(--text2);font-size:.9rem}
.form-switch a{color:var(--cyan);cursor:pointer}
.modal-overlay{position:fixed;inset:0;z-index:150;background:rgba(8,9,15,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem}
.modal{background:var(--card);border:1px solid var(--border2);border-radius:16px;padding:2rem;max-width:500px;width:100%;max-height:90vh;overflow-y:auto}
.modal-title{font-family:'Orbitron',sans-serif;font-size:1.2rem;font-weight:700;margin-bottom:1.5rem}
.modal-actions{display:flex;gap:.75rem;margin-top:1.5rem;justify-content:flex-end}
.select-input{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:1rem;outline:none}
.select-input:focus{border-color:var(--cyan)}
.chat-panel{background:var(--card);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;height:220px;margin-top:1rem}
.chat-header{padding:.8rem 1rem;border-bottom:1px solid var(--border);font-size:.8rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px}
.chat-messages{flex:1;overflow-y:auto;padding:.8rem 1rem;display:flex;flex-direction:column;gap:.4rem}
.chat-msg{font-size:.85rem;line-height:1.5}
.chat-user{font-weight:700;color:var(--cyan);margin-right:.4rem}
.chat-input-row{display:flex;border-top:1px solid var(--border)}
.chat-input{flex:1;background:transparent;border:none;padding:.75rem 1rem;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:.9rem;outline:none}
.chat-send{padding:.5rem 1rem;background:var(--cyan);border:none;color:#000;font-weight:700;font-family:'Rajdhani',sans-serif;cursor:pointer;border-radius:0 0 12px 0}
.mode-selector{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0}
.mode-btn{background:var(--bg2);border:2px solid var(--border);border-radius:12px;padding:1.2rem;cursor:pointer;text-align:center;transition:all .2s;color:var(--text2)}
.mode-btn:hover{border-color:var(--border2);color:var(--text)}
.mode-btn.selected{border-color:var(--cyan);color:var(--cyan);background:rgba(0,212,255,.05)}
.mode-btn .mode-icon{font-size:1.8rem;margin-bottom:.5rem}
.mode-btn .mode-name{font-weight:700;font-size:1rem}
.mode-btn .mode-desc{font-size:.8rem;margin-top:.3rem;color:inherit;opacity:.7}
.manual-entry{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1.2rem;margin:1rem 0}
.manual-time-input{font-family:'JetBrains Mono',monospace;font-size:2rem;text-align:center;background:transparent;border:none;border-bottom:2px solid var(--border);color:var(--cyan);width:100%;padding:.5rem;outline:none}
.manual-time-input:focus{border-bottom-color:var(--cyan)}
.penalty-row{display:flex;gap:.75rem;justify-content:center;margin-top:.75rem}
.check-btn{display:flex;align-items:center;gap:.4rem;padding:.4rem .9rem;border-radius:6px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text2);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.9rem;transition:all .2s}
.check-btn.on{border-color:var(--orange);color:var(--orange);background:rgba(255,140,0,.1)}
.check-btn.dnf-on{border-color:var(--red);color:var(--red);background:rgba(255,64,96,.1)}
.conn-dot{width:8px;height:8px;border-radius:50%;margin-right:.4rem;display:inline-block}
.conn-dot.connected{background:var(--green)}.conn-dot.disconnected{background:var(--red)}
.h2h-banner{background:linear-gradient(135deg,rgba(0,255,148,.08),rgba(0,212,255,.08));border:1px solid rgba(0,255,148,.2);border-radius:12px;padding:1rem 1.5rem;margin-bottom:1rem;text-align:center}
.h2h-banner .h2h-title{font-family:'Orbitron',sans-serif;font-size:.85rem;color:var(--green);letter-spacing:2px}
.h2h-banner .h2h-status{font-size:1.1rem;font-weight:700;color:var(--text);margin-top:.3rem}
.error-msg{background:rgba(255,64,96,.1);border:1px solid rgba(255,64,96,.3);color:var(--red);padding:.75rem 1rem;border-radius:8px;font-size:.9rem;margin-bottom:1rem}
.success-msg{background:rgba(0,255,148,.1);border:1px solid rgba(0,255,148,.3);color:var(--green);padding:.75rem 1rem;border-radius:8px;font-size:.9rem;margin-bottom:1rem}
.room-code{font-family:'JetBrains Mono',monospace;font-size:1.5rem;letter-spacing:4px;color:var(--cyan);background:var(--bg2);border:1px solid var(--border);padding:.5rem 1.5rem;border-radius:8px;display:inline-block;cursor:pointer}
.room-code:hover{border-color:var(--cyan)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .3s ease-out}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
@media(max-width:640px){.race-layout{grid-template-columns:1fr}.stats-row{gap:1.5rem}nav{padding:0 1rem}.page{padding:1rem}.nav-links{display:none}.mode-selector{grid-template-columns:1fr}}
`;

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,       setPage]       = useState('home');
  const [user,       setUser]       = useState(null);
  const [rooms,      setRooms]      = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [connected,  setConnected]  = useState(false);
  const socketRef = useRef(null);

  // Connect socket once user logs in
  useEffect(() => {
    if (!user) return;
    const s = connectSocket();
    socketRef.current = s;
    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('rooms_updated', setRooms);
    // Fetch initial rooms
    apiGet('/api/rooms').then(setRooms).catch(() => {});
    return () => { s.off('connect'); s.off('disconnect'); s.off('rooms_updated'); };
  }, [user]);

  const handleSignOut = () => {
    disconnectSocket();
    setUser(null); setActiveRoom(null); setPage('home');
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="bg-grid"/><div className="bg-glow"/>
      <div className="app">
        <NavBar page={page} setPage={setPage} user={user} connected={connected} onSignOut={handleSignOut}/>
        {page==='home'     && <HeroPage setPage={setPage} user={user}/>}
        {page==='signup'   && <AuthPage mode='signup'  onAuth={setUser} setPage={setPage}/>}
        {page==='signin'   && <AuthPage mode='signin'  onAuth={setUser} setPage={setPage}/>}
        {page==='lobby'    && user && <LobbyPage rooms={rooms} user={user} socket={socketRef.current} onJoinRoom={r=>{setActiveRoom(r);setPage('race')}} setPage={setPage}/>}
        {page==='rankings' && <RankingsPage/>}
        {page==='profile'  && user && <ProfilePage user={user}/>}
        {page==='race'     && user && activeRoom && (
          <RaceRoom room={activeRoom} user={user} socket={socketRef.current}
            onLeave={() => { setActiveRoom(null); setPage('lobby'); }}/>
        )}
      </div>
    </>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function NavBar({ page, setPage, user, connected, onSignOut }) {
  return (
    <nav>
      <div className="nav-logo" onClick={() => setPage('home')}>
        <span className="c">CUBE</span><span className="r">RACE</span>
      </div>
      {user && (
        <div className="nav-links">
          <button className={`nav-link${page==='lobby'?' active':''}`}    onClick={() => setPage('lobby')}>🎮 Lobby</button>
          <button className={`nav-link${page==='rankings'?' active':''}`} onClick={() => setPage('rankings')}>🏆 Rankings</button>
          <button className={`nav-link${page==='profile'?' active':''}`}  onClick={() => setPage('profile')}>👤 Profile</button>
        </div>
      )}
      <div className="nav-actions">
        {user ? (
          <>
            <span style={{fontSize:'.8rem',color:'var(--text2)'}}>
              <span className={`conn-dot ${connected?'connected':'disconnected'}`}/>
              <span style={{color:'var(--cyan)',fontWeight:700}}>{user.username}</span>
            </span>
            <button className="btn btn-ghost" onClick={onSignOut}>Sign Out</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost"   onClick={() => setPage('signin')}>Sign In</button>
            <button className="btn btn-primary" onClick={() => setPage('signup')}>Sign Up</button>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function HeroPage({ setPage, user }) {
  return (
    <div className="hero fade-in">
      <div className="hero-title"><span className="cube">CUBE</span><span className="race">RACE</span></div>
      <p className="hero-sub">Race against real speedcubers worldwide in real-time with official WCA scrambles. Climb the ranks. Break records. Dominate.</p>
      <div className="hero-actions">
        <button className="btn btn-primary btn-lg" onClick={() => setPage(user?'lobby':'signup')}>Get Started Free</button>
        <button className="btn btn-ghost btn-lg"   onClick={() => setPage('signin')}>Sign In</button>
        <button className="btn btn-ghost btn-lg"   onClick={() => setPage('rankings')}>🏆 Leaderboard</button>
      </div>
      <div className="stats-row">
        {[['12,847','Registered Cubers'],['284','Races Today'],['7.34s','Top 3x3 PB'],['2,104','Highest ELO']].map(([n,l]) => (
          <div key={l}><div className="stat-num">{n}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthPage({ mode, onAuth, setPage }) {
  const [form, setForm] = useState({ username:'', email:'', password:'' });
  const [err,  setErr]  = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setErr(''); setLoading(true);
    try {
      const path = mode==='signup' ? '/api/register' : '/api/login';
      const data = await apiPost(path, form);
      if (data.error) { setErr(data.error); }
      else { onAuth(data); setPage('lobby'); }
    } catch { setErr('Could not connect to server. Make sure backend is running.'); }
    setLoading(false);
  };

  return (
    <div className="auth-container fade-in">
      <div className="auth-card">
        <h2 className="auth-title">{mode==='signup'?'JOIN CUBERACE':'SIGN IN'}</h2>
        <p className="auth-sub">{mode==='signup'?'Create your account and start racing.':'Welcome back, cuber.'}</p>
        {err && <div className="error-msg">⚠️ {err}</div>}
        {mode==='signup' && (
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Username</label>
          <input className="form-input" placeholder="CoolCuber42" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} onKeyDown={e=>e.key==='Enter'&&handle()}/>
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&handle()}/>
        </div>
        <button className="btn btn-primary" style={{width:'100%',padding:'.75rem'}} onClick={handle} disabled={loading}>
          {loading?'Loading...':(mode==='signup'?'Create Account →':'Sign In →')}
        </button>
        <p className="form-switch">
          {mode==='signup'?<>Already have an account? <a onClick={()=>setPage('signin')}>Sign In</a></>:<>New here? <a onClick={()=>setPage('signup')}>Create account</a></>}
        </p>
      </div>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function LobbyPage({ rooms, user, socket, onJoinRoom, setPage }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name:'', event:'3x3', mode:'CASUAL', raceType:'SIMULTANEOUS' });
  const [joinCode, setJoinCode] = useState('');
  const [err, setErr] = useState('');

  const createRoom = () => {
    if (!newRoom.name.trim()) return setErr('Please enter a room name');
    setErr('');
    socket.emit('create_room', { ...newRoom, user });
    socket.once('room_created', ({ roomId, room }) => {
      setShowCreate(false);
      onJoinRoom({ ...room, roomId });
    });
  };

  const joinByCode = () => {
    if (!joinCode.trim()) return;
    socket.emit('join_room', { roomId: joinCode.toUpperCase(), user });
    socket.once('room_joined', ({ room }) => onJoinRoom(room));
    socket.once('error', ({ msg }) => setErr(msg));
  };

  const joinRoom = (room) => {
    if (room.playerCount >= room.capacity || room.live) return;
    socket.emit('join_room', { roomId: room.id, user });
    socket.once('room_joined', ({ room: r }) => onJoinRoom(r));
    socket.once('error', ({ msg }) => setErr(msg));
  };

  return (
    <div className="page fade-in">
      <div className="section-header">
        <h1 className="page-title">🎮 Race Lobby</h1>
        <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
          <input className="form-input" style={{width:'140px',padding:'.4rem .8rem'}} placeholder="Room Code" value={joinCode} onChange={e=>setJoinCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&joinByCode()}/>
          <button className="btn btn-ghost" onClick={joinByCode}>Join</button>
          <button className="btn btn-primary" onClick={()=>setShowCreate(true)}>+ Create Room</button>
        </div>
      </div>
      {err && <div className="error-msg">⚠️ {err}</div>}

      <div className="rooms-grid">
        {rooms.length === 0 && (
          <div style={{color:'var(--text3)',padding:'2rem',gridColumn:'1/-1',textAlign:'center'}}>
            No open rooms yet. Create one and invite a friend!
          </div>
        )}
        {rooms.map(room => (
          <div key={room.id} className={`room-card${room.playerCount>=room.capacity||room.live?' full':''}`}
            onClick={() => joinRoom(room)}>
            <div className="room-header">
              <div className="room-name">{room.name}</div>
              <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                {room.raceType==='H2H'&&<span className="badge badge-h2h">H2H</span>}
                <span className={`badge badge-${room.live?'live':room.mode==='RANKED'?'ranked':'casual'}`}>
                  {room.live&&<span className="live-dot"/>}
                  {room.live?'LIVE':room.mode}
                </span>
              </div>
            </div>
            <div className="room-meta">
              <span><span className="event-dot" style={{background:EVENT_COLORS[room.event]||'var(--cyan)'}}/>{room.event}</span>
              <span>👤 {room.host}</span>
              <span>🎮 {room.playerCount}/{room.capacity}</span>
            </div>
            {room.playerCount>=room.capacity && <div style={{marginTop:'.5rem',fontSize:'.8rem',color:'var(--red)'}}>Room Full</div>}
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="modal fade-in">
            <h2 className="modal-title">Create Race Room</h2>
            {err && <div className="error-msg">⚠️ {err}</div>}
            <div className="form-group">
              <label className="form-label">Room Name</label>
              <input className="form-input" placeholder="My Speed Battle" value={newRoom.name} onChange={e=>setNewRoom({...newRoom,name:e.target.value})}/>
            </div>
            <div className="form-group">
              <label className="form-label">Event</label>
              <select className="select-input" value={newRoom.event} onChange={e=>setNewRoom({...newRoom,event:e.target.value})}>
                {['3x3','2x2','4x4','5x5','OH'].map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Race Type</label>
              <div className="mode-selector" style={{gridTemplateColumns:'1fr 1fr 1fr',marginTop:'.5rem'}}>
                {[
                  ['SIMULTANEOUS','⚡','Simultaneous','Both solve at the same time'],
                  ['H2H','🔄','H2H Sequential','Take turns solving same scramble'],
                ].map(([val,icon,name,desc])=>(
                  <div key={val} className={`mode-btn${newRoom.raceType===val?' selected':''}`} onClick={()=>setNewRoom({...newRoom,raceType:val})} style={{gridColumn:val==='H2H'?'span 1':'span 1'}}>
                    <div className="mode-icon">{icon}</div>
                    <div className="mode-name">{name}</div>
                    <div className="mode-desc">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mode</label>
              <select className="select-input" value={newRoom.mode} onChange={e=>setNewRoom({...newRoom,mode:e.target.value})}>
                <option value="CASUAL">Casual</option>
                <option value="RANKED">Ranked (ELO)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRoom}>Create Room</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RACE ROOM ────────────────────────────────────────────────────────────────
function RaceRoom({ room: initialRoom, user, socket, onLeave }) {
  const [room,       setRoom]       = useState(initialRoom);
  const [phase,      setPhase]      = useState('waiting');
  const [countdown,  setCountdown]  = useState(null);
  const [timerMode,  setTimerMode]  = useState('builtin');
  const [timerMs,    setTimerMs]    = useState(0);
  const [timerState, setTimerState] = useState('idle');
  const [inspTime,   setInspTime]   = useState(15);
  const [manualInput,setManualInput]= useState('');
  const [manualErr,  setManualErr]  = useState('');
  const [plusTwo,    setPlusTwo]    = useState(false);
  const [dnf,        setDnf]        = useState(false);
  const [result,     setResult]     = useState(null);
  const [h2hStatus,  setH2hStatus]  = useState('');
  const [chatMsgs,   setChatMsgs]   = useState(room.chat || []);
  const [chatInput,  setChatInput]  = useState('');
  const [rematchVotes,setRematchVotes]=useState(0);
  const [err,        setErr]        = useState('');
  const [copied,     setCopied]     = useState(false);

  const timerRef   = useRef(null);
  const startRef   = useRef(null);
  const inspRef    = useRef(null);
  const inspStart  = useRef(null);
  const chatBottom = useRef(null);

  const myPlayer  = room.players?.find(p => p.username === user.username);
  const oppPlayer = room.players?.find(p => p.username !== user.username);
  const isMyTurn  = room.raceType === 'H2H'
    ? (room.h2hTurn === 1 && room.players?.[0]?.username === user.username) ||
      (room.h2hTurn === 2 && room.players?.[1]?.username === user.username)
    : true;

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('room_updated',        setRoom);
    socket.on('opponent_disconnected', ({room:r}) => { setRoom(r); setErr('⚠️ Opponent disconnected. Waiting for them to rejoin...'); setPhase('waiting'); });
    socket.on('chat_message',        msg => setChatMsgs(prev=>[...prev,msg]));
    socket.on('rematch_vote',        ({count}) => setRematchVotes(count));
    socket.on('rematch_start',       ({room:r}) => { setRoom(r); setPhase('waiting'); setTimerMs(0); setTimerState('idle'); setResult(null); setInspTime(15); setPlusTwo(false); setDnf(false); setManualInput(''); setRematchVotes(0); setErr(''); });
    socket.on('error',               ({msg}) => setErr(msg));

    socket.on('race_countdown', ({scramble}) => {
      setRoom(prev => ({...prev, scramble}));
      setPhase('countdown'); setCountdown(3);
    });
    socket.on('countdown_tick', ({count}) => setCountdown(count));

    socket.on('race_start', () => {
      setPhase('inspecting');
      inspStart.current = Date.now();
      setInspTime(15);
    });

    // H2H events
    socket.on('h2h_turn_start', ({turn, phase: p, room:r}) => {
      setRoom(r);
      const myIdx = r.players.findIndex(pl => pl.username === user.username);
      if (turn === myIdx+1) {
        if (p === 'inspect') {
          setPhase('inspecting'); setInspTime(15); inspStart.current = Date.now();
          setH2hStatus('Your turn! Inspect your cube.');
        }
      } else {
        setPhase('h2h_waiting');
        setH2hStatus(turn===1 ? 'Waiting for opponent to solve first...' : 'Opponent is now solving...');
      }
    });
    socket.on('h2h_phase_update', ({phase:p, room:r}) => setRoom(r));
    socket.on('h2h_player_finished', ({turn, username, time, dnf:d, plusTwo:pt}) => {
      if (username !== user.username) setH2hStatus(`${username} finished in ${fmtTime(time)}! Now it's your turn!`);
    });

    socket.on('match_result', (res) => { setResult(res); setPhase('result'); });

    return () => {
      ['room_updated','opponent_disconnected','chat_message','rematch_vote','rematch_start',
       'error','race_countdown','countdown_tick','race_start','h2h_turn_start',
       'h2h_phase_update','h2h_player_finished','match_result'].forEach(e => socket.off(e));
    };
  }, [socket, user.username]);

  // Auto-scroll chat
  useEffect(() => { chatBottom.current?.scrollIntoView({behavior:'smooth'}); }, [chatMsgs]);

  // Countdown tick
  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return;
    if (countdown < 0) return;
  }, [phase, countdown]);

  // Inspection timer
  useEffect(() => {
    if (phase !== 'inspecting') return;
    inspRef.current = setInterval(() => {
      setInspTime(t => {
        if (t <= 1) { clearInterval(inspRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(inspRef.current);
  }, [phase]);

  // Keyboard spacebar
  useEffect(() => {
    if (phase !== 'solving') return;
    const onKey = e => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (e.type==='keydown' && timerState==='running') stopTimer();
      if (e.type==='keydown' && timerState==='idle')    setTimerState('holding');
      if (e.type==='keyup'   && timerState==='holding') { setTimerState('running'); startTimer(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKey);
    return () => { window.removeEventListener('keydown',onKey); window.removeEventListener('keyup',onKey); };
  }, [phase, timerState]);

  const startTimer = () => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => setTimerMs(Date.now()-startRef.current), 16);
  };
  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    const elapsed = Date.now() - startRef.current;
    setTimerMs(elapsed);
    setTimerState('stopped');
    submitTime(elapsed, false, false);
  }, []);

  const doneInspecting = () => {
    clearInterval(inspRef.current);
    const inspDuration = Date.now() - (inspStart.current || Date.now());
    let autoPlusTwo = false, autoDnf = false;
    if (inspDuration > 17000) autoDnf = true;
    else if (inspDuration > 15000) autoPlusTwo = true;
    if (autoPlusTwo) setPlusTwo(true);
    if (autoDnf)     setDnf(true);
    socket.emit('inspection_done', { roomId: room.id });
    if (timerMode === 'builtin') { setPhase('solving'); }
    else { setPhase('manual_entry'); }
  };

  const submitTime = (time, d, pt) => {
    socket.emit('submit_time', {
      roomId: room.id, time, dnf: d||dnf, plusTwo: pt||plusTwo, timerMode
    });
  };

  const submitManual = () => {
    setManualErr('');
    const ms = parseManualTime(manualInput);
    if (!ms) return setManualErr('Invalid format. Use: 9.450 or 1:02.340');
    submitTime(ms, dnf, plusTwo);
    setPhase('submitted');
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { roomId: room.id, username: user.username, text: chatInput });
    setChatInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Effective display time
  const myTime = myPlayer?.time;
  const myEffective = myPlayer?.dnf ? null : (myPlayer?.plusTwo ? (myTime||0)+2000 : myTime);
  const myDisplay = myPlayer?.dnf ? 'DNF' : fmtTime(myEffective);
  const oppTime = oppPlayer?.time;
  const oppEffective = oppPlayer?.dnf ? null : (oppPlayer?.plusTwo ? (oppTime||0)+2000 : oppTime);
  const oppDisplay = oppPlayer?.dnf ? 'DNF' : fmtTime(oppEffective);

  const inspPct = Math.max(0, (inspTime/15)*100);
  const inspColor = inspTime > 8 ? 'var(--green)' : inspTime > 5 ? 'var(--orange)' : 'var(--red)';

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="section-header" style={{marginBottom:'1rem'}}>
        <div>
          <span style={{color:'var(--text2)',fontSize:'.9rem'}}>
            {room.event} · {room.name} ·&nbsp;
            <span style={{color:room.mode==='RANKED'?'var(--orange)':'#a78bfa'}}>{room.mode}</span>
            {room.raceType==='H2H' && <span style={{color:'var(--green)',marginLeft:'.5rem'}}>· H2H</span>}
          </span>
          <div style={{marginTop:'.4rem',display:'flex',alignItems:'center',gap:'.75rem'}}>
            <span style={{fontSize:'.8rem',color:'var(--text3)'}}>Room Code:</span>
            <span className="room-code" onClick={copyRoomCode} title="Click to copy">
              {room.id}
            </span>
            {copied && <span style={{color:'var(--green)',fontSize:'.8rem'}}>✓ Copied!</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:'.5rem'}}>
          {phase==='waiting' && room.players?.length>=2 && (
            <button className="btn btn-green" onClick={() => socket.emit('player_ready', {roomId:room.id})}>
              ▶ Ready!
            </button>
          )}
          {phase==='waiting' && room.players?.length<2 && (
            <div style={{color:'var(--text3)',fontSize:'.85rem',padding:'.4rem .8rem'}}>⌛ Waiting for opponent...</div>
          )}
          <button className="btn btn-ghost" onClick={onLeave}>← Leave</button>
        </div>
      </div>

      {err && <div className="error-msg">{err} <button className="btn btn-ghost" style={{padding:'.2rem .6rem',fontSize:'.8rem',marginLeft:'auto'}} onClick={()=>setErr('')}>✕</button></div>}

      {/* H2H Banner */}
      {room.raceType==='H2H' && h2hStatus && (
        <div className="h2h-banner">
          <div className="h2h-title">H2H MODE — SEQUENTIAL</div>
          <div className="h2h-status">{h2hStatus}</div>
        </div>
      )}

      {/* Mode selector (only before race) */}
      {phase==='waiting' && (
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="form-label" style={{marginBottom:'.75rem'}}>Select Your Timer Mode</div>
          <div className="mode-selector">
            <div className={`mode-btn${timerMode==='builtin'?' selected':''}`} onClick={()=>{setTimerMode('builtin');socket.emit('set_timer_mode',{roomId:room.id,mode:'builtin'})}}>
              <div className="mode-icon">⏱️</div>
              <div className="mode-name">Built-in Timer</div>
              <div className="mode-desc">Spacebar start/stop</div>
            </div>
            <div className={`mode-btn${timerMode==='manual'?' selected':''}`} onClick={()=>{setTimerMode('manual');socket.emit('set_timer_mode',{roomId:room.id,mode:'manual'})}}>
              <div className="mode-icon">✍️</div>
              <div className="mode-name">Manual Entry</div>
              <div className="mode-desc">Solve physically, type your time</div>
            </div>
          </div>
        </div>
      )}

      {/* Race layout */}
      <div className="race-layout">
        {/* YOU */}
        <div className={`player-card you${phase==='h2h_waiting'||(!isMyTurn&&phase!=='waiting')?' waiting-turn':''}`}>
          <div className="player-label">YOU</div>
          <div className="player-name">
            👤 {user.username}
            <span className="elo-badge">ELO {user.elo}</span>
          </div>

          {room.scramble && (
            <div className="scramble-box">
              <div className="scramble-label">Scramble</div>
              <div className="scramble-text">{room.scramble}</div>
            </div>
          )}

          {phase==='waiting' && (
            <>
              <div className="ready-text">READY?</div>
              <div className="hint-text">
                {room.players?.length<2 ? 'Share the room code above to invite someone!' : 'Press Ready when both players are here'}
              </div>
            </>
          )}

          {phase==='h2h_waiting' && (
            <div className="status-pill status-waiting" style={{margin:'1.5rem auto',display:'flex',width:'fit-content'}}>
              ⌛ Waiting for opponent to finish...
            </div>
          )}

          {phase==='inspecting' && (
            <>
              <div className="inspect-bar"><div className="inspect-fill" style={{width:`${inspPct}%`,background:inspColor}}/></div>
              <div style={{textAlign:'center',fontFamily:"'Orbitron',sans-serif",fontSize:'1.5rem',fontWeight:700,color:inspColor}}>
                {inspTime}s
              </div>
              {inspTime <= 8 && <div style={{textAlign:'center',color:'var(--orange)',fontWeight:700,marginTop:'.25rem'}}>⚠️ 8 seconds!</div>}
              <div className="hint-text" style={{marginTop:'.5rem'}}>Inspect your cube</div>
              <div style={{textAlign:'center',marginTop:'1rem'}}>
                <button className="btn btn-green btn-lg" onClick={doneInspecting}>
                  {timerMode==='manual' ? 'Start Solve →' : 'Start Timer →'}
                </button>
              </div>
            </>
          )}

          {phase==='solving' && timerMode==='builtin' && (
            <>
              <div className={`timer-display ${timerState}`}>{fmtTime(timerMs)}</div>
              {timerState==='idle'    && <div className="hint-text">Hold SPACE or tap button to arm timer</div>}
              {timerState==='holding' && <div className="hint-text" style={{color:'var(--orange)'}}>Release to start!</div>}
              {timerState==='running' && <div className="hint-text">Press SPACE or tap button to stop</div>}
              <div style={{textAlign:'center',marginTop:'1rem'}}>
                <button className="btn btn-primary btn-lg"
                  onPointerDown={() => timerState==='idle' && setTimerState('holding')}
                  onPointerUp={() => timerState==='holding' ? (setTimerState('running'),startTimer()) : stopTimer()}>
                  {timerState==='running' ? '■ STOP' : '▶ START'}
                </button>
              </div>
            </>
          )}

          {phase==='manual_entry' && (
            <div className="manual-entry">
              <div className="form-label" style={{textAlign:'center',marginBottom:'.75rem'}}>Enter Your Solve Time</div>
              <div style={{color:'var(--text3)',fontSize:'.8rem',textAlign:'center',marginBottom:'.75rem'}}>Format: 9.450 or 1:02.340 (min:sec.ms)</div>
              <input
                className="manual-time-input"
                placeholder="9.450"
                value={manualInput}
                onChange={e=>setManualInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&submitManual()}
                autoFocus
              />
              {manualErr && <div style={{color:'var(--red)',fontSize:'.8rem',textAlign:'center',marginTop:'.5rem'}}>{manualErr}</div>}
              <div className="penalty-row">
                <button className={`check-btn${plusTwo?' on':''}`} onClick={()=>setPlusTwo(p=>!p)}>
                  {plusTwo?'✓':''} +2
                </button>
                <button className={`check-btn${dnf?' dnf-on':''}`} onClick={()=>setDnf(d=>!d)}>
                  {dnf?'✓':''} DNF
                </button>
              </div>
              <div style={{textAlign:'center',marginTop:'1rem'}}>
                <button className="btn btn-primary btn-lg" onClick={submitManual}>Submit Time →</button>
              </div>
            </div>
          )}

          {phase==='submitted' && (
            <div style={{textAlign:'center',padding:'2rem 0'}}>
              <div className="status-pill status-finished" style={{margin:'0 auto',width:'fit-content'}}>✓ Time Submitted</div>
              <div style={{color:'var(--text3)',marginTop:'.75rem',fontSize:'.85rem'}}>Waiting for opponent...</div>
            </div>
          )}

          {phase==='result' && result && (
            <div className="timer-display stopped">{myDisplay}</div>
          )}
        </div>

        {/* OPPONENT */}
        <div className="player-card">
          <div className="player-label">Opponent</div>
          <div className="player-name">
            🧊 {oppPlayer?.username || 'Waiting...'}
            {oppPlayer && <span className="elo-badge" style={{borderColor:'rgba(124,58,237,.5)',color:'#a78bfa'}}>ELO {oppPlayer.elo}</span>}
          </div>

          {room.scramble && (
            <div className="scramble-box">
              <div className="scramble-label">Same Scramble</div>
              <div className="scramble-text scramble-blur">{room.scramble}</div>
            </div>
          )}

          {!oppPlayer && <div className="status-pill status-waiting" style={{margin:'1rem auto',display:'flex',width:'fit-content'}}>⌛ Waiting for player...</div>}

          {oppPlayer && (
            <div style={{display:'flex',justifyContent:'center',margin:'1.5rem 0'}}>
              {oppPlayer.status==='waiting'    && <span className="status-pill status-waiting">⌛ Waiting</span>}
              {oppPlayer.status==='ready'      && <span className="status-pill status-ready">✓ Ready</span>}
              {oppPlayer.status==='countdown'  && <span className="status-pill status-ready">🚦 Countdown</span>}
              {oppPlayer.status==='inspecting' && <span className="status-pill status-inspecting">🔍 Inspecting</span>}
              {oppPlayer.status==='solving'    && <span className="status-pill status-solving">⚡ Solving...</span>}
              {oppPlayer.status==='finished'   && <span className="status-pill status-finished">✓ Finished</span>}
            </div>
          )}

          {phase==='result' && result && oppPlayer && (
            <div className="timer-display" style={{color:'var(--purple)'}}>{oppDisplay}</div>
          )}

          {room.raceType==='H2H' && room.h2hTurn===2 && room.players?.[0]?.time !== null && (
            <div style={{textAlign:'center',marginTop:'1rem'}}>
              <div className="form-label">Player 1's Time</div>
              <div className="timer-display stopped" style={{fontSize:'2.5rem'}}>
                {fmtTime(room.players[0]?.time)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="chat-panel">
        <div className="chat-header">💬 Room Chat · {room.id}</div>
        <div className="chat-messages">
          {chatMsgs.map((m,i)=>(
            <div key={i} className="chat-msg">
              <span className="chat-user">{m.username}:</span>{m.text}
            </div>
          ))}
          <div ref={chatBottom}/>
        </div>
        <div className="chat-input-row">
          <input className="chat-input" placeholder="Say something..." value={chatInput}
            onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/>
          <button className="chat-send" onClick={sendChat}>Send</button>
        </div>
      </div>

      {/* Countdown overlay */}
      {phase==='countdown' && countdown !== null && (
        <div className="overlay">
          <div className="countdown-label">GET READY TO SOLVE</div>
          <div className="countdown-num" key={countdown}>{countdown > 0 ? countdown : 'GO!'}</div>
          <div className="countdown-sub">{room.event} · {room.mode}</div>
        </div>
      )}

      {/* Result overlay */}
      {phase==='result' && result && (
        <div className="overlay">
          <div className="result-card fade-in">
            <div className="result-title" style={{color: result.winner===user.username?'var(--green)':'var(--red)'}}>
              {result.winner===user.username ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
            </div>
            <div style={{color:'var(--text2)',marginBottom:'1rem'}}>
              <span style={{color:'var(--cyan)',fontWeight:700}}>{result.winner}</span> wins the race!
            </div>
            <div className="result-times">
              {result.players?.map(p=>(
                <div key={p.username} className="result-time-item">
                  <div className="result-time-num" style={{color:p.username===result.winner?'var(--green)':'var(--text)'}}>
                    {p.dnf?'DNF':fmtTime(p.plusTwo?(p.time+2000):p.time)}
                  </div>
                  <div className="result-time-label">{p.username}</div>
                </div>
              ))}
            </div>
            {room.mode==='RANKED' && (
              <div style={{color:'var(--text2)',fontSize:'.85rem',marginBottom:'.5rem'}}>
                ELO: <span style={{color:result.winner===user.username?'var(--green)':'var(--red)'}}>
                  {result.winner===user.username?'+':'-'}{result.eloChange}
                </span>
              </div>
            )}
            {rematchVotes > 0 && rematchVotes < 2 && (
              <div style={{color:'var(--text3)',fontSize:'.85rem',margin:'.5rem 0'}}>
                ⌛ {rematchVotes}/2 players want a rematch
              </div>
            )}
            <div className="result-actions">
              <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
              <button className="btn btn-primary" onClick={() => socket.emit('vote_rematch',{roomId:room.id})}>🔄 Rematch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RANKINGS ─────────────────────────────────────────────────────────────────
function RankingsPage() {
  const [lb, setLb] = useState(STATIC_LB);
  useEffect(() => { apiGet('/api/leaderboard').then(d=>d.length&&setLb(d)).catch(()=>{}); }, []);
  return (
    <div className="page fade-in">
      <h1 className="page-title">🏆 Global Leaderboard</h1>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table className="lb-table">
          <thead><tr><th>Rank</th><th>Player</th><th>ELO</th><th>Top PB</th><th>Wins</th></tr></thead>
          <tbody>
            {lb.map((p,i)=>(
              <tr key={p.username||i}>
                <td><span className={`lb-rank${i===0?' top1':i===1?' top2':i===2?' top3':''}`}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span></td>
                <td style={{fontWeight:700}}>{p.username}</td>
                <td><span className="lb-elo">{p.elo}</span></td>
                <td><span className="lb-pb">{p.pb||'—'}</span></td>
                <td style={{color:'var(--text2)'}}>{p.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfilePage({ user }) {
  const pbs = Object.entries(user.pbs||{}).filter(([,v])=>v).map(([e,t])=>({event:e,time:fmtTime(t)}));
  if (!pbs.length) pbs.push({event:'3x3',time:'—'},{event:'2x2',time:'—'});
  return (
    <div className="page fade-in">
      <h1 className="page-title">👤 Profile</h1>
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="profile-header">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <h2 style={{fontFamily:"'Orbitron',sans-serif",fontSize:'1.4rem',fontWeight:700}}>{user.username}</h2>
            <p style={{color:'var(--text2)',marginTop:'.3rem'}}>
              ELO: <span style={{color:'var(--cyan)',fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{user.elo}</span>
            </p>
            <p style={{color:'var(--text2)',marginTop:'.3rem'}}>
              Wins: <span style={{color:'var(--green)'}}>{user.wins}</span> · Losses: <span style={{color:'var(--red)'}}>{user.losses}</span>
            </p>
          </div>
        </div>
        <div className="divider"/>
        <div className="form-label" style={{marginBottom:'.75rem'}}>Personal Bests</div>
        <div className="pb-grid">
          {pbs.map(p=>(
            <div key={p.event} className="pb-card">
              <div className="pb-event">{p.event}</div>
              <div className="pb-time">{p.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
