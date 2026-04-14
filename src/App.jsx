import { createClient } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback, useRef } from 'react'

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'anantara-admin' } }
)

// ─── CSS lives in index.css ───────────────────────────────────────────────────
const _CSS_REMOVED = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  :root {
    --green-dark:#1d5c2e; --green:#2d7a3f; --green-light:#3a9150;
    --green-subtle:#e8f4eb; --gold:#C8A535; --gold-light:#f5e8a3;
    --purple:#7a52b0; --purple-light:#ede8f7;
    --bg:#f0f5f0; --white:#ffffff; --text:#1a2e1d; --text2:#3d5c42;
    --text-muted:#7a9c80; --border:#d4e6d8; --radius:10px; --radius-lg:14px;
    --shadow:0 2px 12px rgba(29,92,46,.10); --shadow-lg:0 6px 24px rgba(29,92,46,.15);
    --sidebar-w:220px;
  }
  body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); font-size:14px; line-height:1.5 }
  button,input,select,textarea { font-family:inherit }
  .app-shell { display:flex; min-height:100vh }
  .main-wrap { margin-left:var(--sidebar-w); flex:1; display:flex; flex-direction:column; min-height:100vh }
  @media(max-width:768px){ .main-wrap{ margin-left:0 } }
  .sidebar { width:var(--sidebar-w); background:var(--green-dark); color:#fff; display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:100; transition:transform .25s }
  @media(max-width:768px){ .sidebar{ transform:translateX(-100%) } .sidebar.open{ transform:translateX(0) } }
  .sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99 }
  @media(max-width:768px){ .sidebar-overlay.open{ display:block } }
  .sidebar-logo { padding:20px 18px 14px; font-size:17px; font-weight:800; letter-spacing:-.3px; border-bottom:1px solid rgba(255,255,255,.1) }
  .sidebar-logo span { color:var(--gold) }
  .sidebar-nav { flex:1; padding:8px 10px; overflow-y:auto }
  .sidebar-group { margin-bottom:16px }
  .sidebar-group-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,.4); padding:0 8px 5px }
  .nav-btn { display:flex; align-items:center; gap:9px; padding:9px 10px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:500; color:rgba(255,255,255,.75); transition:all .15s; margin-bottom:2px; border:none; background:none; width:100%; text-align:left }
  .nav-btn:hover { background:rgba(255,255,255,.1); color:#fff }
  .nav-btn.active { background:var(--green-light); color:#fff; font-weight:700 }
  .nav-btn .ico { font-size:15px; flex-shrink:0; width:20px; text-align:center }
  .sidebar-footer { padding:14px 10px; border-top:1px solid rgba(255,255,255,.1) }
  .topbar { height:56px; background:var(--white); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 24px; position:sticky; top:0; z-index:50 }
  .topbar-left { display:flex; align-items:center; gap:12px }
  .topbar-title { font-size:18px; font-weight:800; color:var(--text) }
  .hamburger { display:none; background:none; border:none; font-size:20px; cursor:pointer; color:var(--text); padding:4px }
  @media(max-width:768px){ .hamburger{ display:flex } }
  .notif-btn { position:relative; background:none; border:none; font-size:20px; cursor:pointer; padding:4px }
  .notif-badge { position:absolute; top:-2px; right:-2px; background:#dc2626; color:#fff; font-size:9px; font-weight:800; border-radius:99px; min-width:16px; height:16px; display:flex; align-items:center; justify-content:center; padding:0 3px }
  .page-content { padding:24px; flex:1 }
  @media(max-width:600px){ .page-content{ padding:16px } }
  .card { background:var(--white); border-radius:var(--radius-lg); border:1px solid var(--border); box-shadow:var(--shadow) }
  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px }
  .section-title { font-size:15px; font-weight:800; color:var(--text) }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all .15s }
  .btn:disabled { opacity:.5; cursor:default }
  .btn-primary { background:var(--green); color:#fff }
  .btn-primary:hover:not(:disabled) { background:var(--green-dark) }
  .btn-secondary { background:var(--green-subtle); color:var(--green); border:1.5px solid var(--border) }
  .btn-secondary:hover { background:var(--border) }
  .btn-ghost { background:transparent; color:var(--text); border:1.5px solid var(--border) }
  .btn-ghost:hover { background:var(--bg) }
  .btn-danger { background:#fee2e2; color:#dc2626; border:1.5px solid #fecaca }
  .btn-danger:hover { background:#fecaca }
  .btn-gold { background:var(--gold-light); color:#7a5c10; border:1.5px solid #e5d070 }
  .btn-gold:hover { background:#edd850 }
  .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700 }
  .badge-green { background:var(--green-subtle); color:var(--green-dark) }
  .badge-gold { background:var(--gold-light); color:#7a5c10 }
  .badge-red { background:#fee2e2; color:#dc2626 }
  .badge-gray { background:#f1f5f9; color:#64748b }
  .badge-purple { background:var(--purple-light); color:var(--purple) }
  .badge-blue { background:#e8f4f8; color:#1a547a }
  .field { margin-bottom:14px }
  .field-label { font-size:12px; font-weight:700; color:var(--text2); margin-bottom:5px; display:block }
  .field-input { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; color:var(--text); background:var(--white); outline:none; transition:border-color .15s }
  .field-input:focus { border-color:var(--green) }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:200; padding:20px }
  .modal { background:var(--white); border-radius:var(--radius-lg); padding:24px; width:100%; max-width:460px; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg) }
  .modal-title { font-size:17px; font-weight:800; margin-bottom:18px; color:var(--text) }
  .toast { position:fixed; bottom:24px; right:24px; background:var(--green-dark); color:#fff; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:600; z-index:300; box-shadow:var(--shadow-lg); animation:slideUp .25s ease; max-width:320px }
  .toast.error { background:#dc2626 }
  @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
  .skel { background:linear-gradient(90deg,#e8f0ea 25%,#f0f5f0 50%,#e8f0ea 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:8px }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .empty-state { text-align:center; padding:40px 20px; color:var(--text-muted) }
  .empty-state-icon { font-size:36px; margin-bottom:10px }
  .empty-state-title { font-size:15px; font-weight:700; color:var(--text2); margin-bottom:4px }
  .empty-state-sub { font-size:13px }
  .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px; align-items:stretch }
  @media(max-width:700px){ .stats-grid{ grid-template-columns:1fr 1fr } }
  .stat-card { padding:20px; display:flex; flex-direction:column; min-height:100px }
  .stat-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); margin-bottom:8px }
  .stat-value { font-size:32px; font-weight:900; color:var(--green-dark); margin-bottom:4px; line-height:1 }
  .stat-sub { font-size:12px; color:var(--text-muted); margin-top:auto }
  .alert-banner { display:flex; align-items:center; gap:10px; background:var(--gold-light); border:1.5px solid var(--gold); border-radius:var(--radius-lg); padding:12px 16px; margin-bottom:20px; cursor:pointer }
  .alert-banner-text { font-size:13px; font-weight:700; color:#7a5c10; flex:1 }
  .dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px }
  @media(max-width:800px){ .dash-grid{ grid-template-columns:1fr } }
  .dash-row { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--border) }
  .dash-row:last-child { border-bottom:none }
  .agenda-scroll { overflow-x:auto }
  .agenda-grid { display:grid; border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; background:var(--white); min-width:600px }
  .ag-header { background:var(--green-subtle); font-size:12px; font-weight:700; text-align:center; padding:10px 4px; border-right:1px solid var(--border); border-bottom:2px solid var(--border); color:var(--text2) }
  .ag-header.today { background:var(--green); color:#fff }
  .ag-header.time-col { background:var(--bg) }
  .ag-time { font-size:10px; color:var(--text-muted); text-align:right; padding:0 6px; border-right:1px solid var(--border); display:flex; align-items:flex-start; padding-top:2px; height:60px }
  .ag-col { position:relative; border-right:1px solid var(--border); height:60px }
  .ag-col:last-child { border-right:none }
  .appt-block { position:absolute; left:2px; right:2px; border-radius:6px; padding:3px 5px; overflow:hidden; cursor:pointer; font-size:10px; font-weight:700; z-index:3 }
  .appt-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; padding-top:14px; border-top:1px solid var(--border) }
  .hours-row { display:grid; grid-template-columns:110px 44px 1fr; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--border) }
  .hours-row:last-child { border-bottom:none }
  .hours-times { display:flex; gap:6px; align-items:center; font-size:12px; color:var(--text-muted) }
  .dur-select { padding:6px 10px; border:1.5px solid var(--border); border-radius:8px; font-size:12px; font-weight:700; color:var(--text); background:var(--white); outline:none; cursor:pointer }
  .mini-cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px }
  .mini-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px }
  .cal-day-label { font-size:10px; font-weight:700; text-align:center; color:var(--text-muted); padding:4px 0 }
  .cal-day { aspect-ratio:1; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; border:1.5px solid transparent }
  .cal-day:hover { background:var(--green-subtle) }
  .cal-day.blocked { background:var(--green); color:#fff; border-color:var(--green) }
  .cal-day.is-today { border-color:var(--green) }
  .cal-day.other-month { opacity:.3; cursor:default }
  .pac-layout { display:grid; grid-template-columns:340px 1fr; gap:20px; align-items:start }
  @media(max-width:900px){ .pac-layout{ grid-template-columns:1fr } }
  .pac-search-bar { display:flex; align-items:center; gap:10px; background:var(--white); border:1.5px solid var(--border); border-radius:var(--radius-lg); padding:10px 14px; margin-bottom:8px; transition:border-color .15s }
  .pac-search-bar:focus-within { border-color:var(--green) }
  .pac-search-input { flex:1; border:none; outline:none; font-size:14px; color:var(--text); background:transparent }
  .pac-row { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; border-bottom:1px solid var(--border); transition:background .1s }
  .pac-row:last-child { border-bottom:none }
  .pac-row:hover { background:var(--green-subtle) }
  .pac-row.active { background:var(--green-subtle); border-right:3px solid var(--green) }
  .pac-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,var(--green-dark),var(--green-light)); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0 }
  .slot-card { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border) }
  .slot-card:last-child { border-bottom:none }
  .slot-info { flex:1; min-width:0 }
  .slot-title { font-size:13px; font-weight:700; color:var(--text) }
  .slot-meta { font-size:11px; color:var(--text-muted); margin-top:2px }
  .slot-bar { height:4px; background:var(--border); border-radius:2px; overflow:hidden; margin-top:6px }
  .slot-bar-fill { height:100%; background:var(--green); border-radius:2px; transition:width .3s }
  .wait-card { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border) }
  .wait-card:last-child { border-bottom:none }
  .toggle { width:38px; height:22px; border-radius:11px; border:none; cursor:pointer; position:relative; flex-shrink:0; transition:background .2s }
  .toggle-knob { position:absolute; top:3px; left:3px; width:16px; height:16px; background:#fff; border-radius:50%; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.2) }
  .toggle.on { background:var(--green) }
  .toggle.off { background:#cbd5e1 }
  .toggle.on .toggle-knob { transform:translateX(16px) }
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,var(--green-dark),var(--green)); padding:20px }
  .login-card { background:var(--white); border-radius:20px; padding:36px 32px; width:100%; max-width:380px; box-shadow:var(--shadow-lg) }
  .login-logo { text-align:center; margin-bottom:24px }
  .login-logo h1 { font-size:22px; font-weight:900; color:var(--green-dark) }
  .login-logo span { color:var(--gold) }
  .login-err { background:#fee2e2; border:1px solid #fecaca; color:#dc2626; font-size:12px; padding:10px 14px; border-radius:8px; margin-bottom:14px }
  .tab-pills { display:flex; background:var(--bg); border-radius:10px; padding:3px; border:1.5px solid var(--border); margin-bottom:16px }
  .tab-pill { padding:7px 16px; font-size:12px; font-weight:700; border:none; border-radius:7px; cursor:pointer; transition:all .15s; background:transparent; color:var(--text-muted) }
  .tab-pill.active { background:var(--green); color:#fff }
  .svc-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border) }
  .svc-row:last-child { border-bottom:none }
  .svc-cat { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; white-space:nowrap }
  .svc-cat-osteopatia { background:var(--green-subtle); color:var(--green-dark) }
  .svc-cat-yoga { background:#e8f4f8; color:#1a547a }
  .svc-cat-belleza { background:var(--purple-light); color:var(--purple) }
  .svc-cat-otro { background:#f1f5f9; color:#64748b }
  .assign-slots { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:10px 0 }
  .assign-slot { padding:8px 4px; border:1.5px solid var(--border); border-radius:8px; font-size:12px; font-weight:700; background:var(--white); color:var(--text); cursor:pointer; transition:all .15s; text-align:center }
  .assign-slot:hover { border-color:var(--green); color:var(--green) }
  .assign-slot.selected { background:var(--green); color:#fff; border-color:var(--green) }
  .notes-area { width:100%; padding:9px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; color:var(--text); background:var(--white); outline:none; resize:vertical; min-height:80px; transition:border-color .15s }
  .notes-area:focus { border-color:var(--green) }
`

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function pad(n) { return String(n).padStart(2,'0') }
function toK(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fD(iso)  { if(!iso)return'—'; const d=new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
function fDT(iso) { if(!iso)return'—'; const d=new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}` }
function fTime(iso){ if(!iso)return'—'; const d=new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function getWeekDays(ref) {
  const d=new Date(ref), day=d.getDay()
  const mon=new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1))
  return Array.from({length:7},(_,i)=>{ const x=new Date(mon); x.setDate(mon.getDate()+i); return x })
}
function gMD(year,month) {
  const first=new Date(year,month,1), last=new Date(year,month+1,0)
  const offset=(first.getDay()+6)%7, days=[]
  for(let i=0;i<offset;i++) days.push({date:new Date(year,month,1-(offset-i)),other:true})
  for(let d=1;d<=last.getDate();d++) days.push({date:new Date(year,month,d),other:false})
  const rem=7-(days.length%7); if(rem<7) for(let i=1;i<=rem;i++) days.push({date:new Date(year,month+1,i),other:true})
  return days
}

const STATUS_TXT = {confirmed:'Confirmada',pending:'Pendiente',cancelled:'Cancelada',completed:'Completada'}
const STATUS_CLS = {confirmed:'badge-green',pending:'badge-gold',cancelled:'badge-red',completed:'badge-gray'}

// ─── Atoms ───────────────────────────────────────────────────────────────────
function Btn({variant='primary',children,style,...p}){return<button className={`btn btn-${variant}`}style={style}{...p}>{children}</button>}
function Inp({label,style,...p}){return<div className="field"style={style}>{label&&<label className="field-label">{label}</label>}<input className="field-input"{...p}/></div>}
function Sel({label,options,style,...p}){return<div className="field"style={style}>{label&&<label className="field-label">{label}</label>}<select className="field-input"{...p}>{options.map(([v,l])=><option key={v}value={v}>{l}</option>)}</select></div>}
function Modal({title,onClose,children}){
  useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose])
  return<div className="modal-overlay"onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal">{title&&<div className="modal-title">{title}</div>}{children}</div></div>
}
function Sp(){return<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40}}><div style={{width:32,height:32,border:'3px solid var(--border)',borderTopColor:'var(--green)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
function Em({icon='📋',title,sub}){return<div className="empty-state"><div className="empty-state-icon">{icon}</div>{title&&<div className="empty-state-title">{title}</div>}{sub&&<div className="empty-state-sub">{sub}</div>}</div>}
function Bg({variant='gray',children}){return<span className={`badge badge-${variant}`}>{children}</span>}
function Toggle({on,onChange}){return<button className={`toggle ${on?'on':'off'}`}onClick={()=>onChange(!on)}><span className="toggle-knob"/></button>}
function Toast({msg,type='ok',onDone}){useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[onDone]);return<div className={`toast${type==='error'?' error':''}`}>{msg}</div>}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage({onLogin}){
  const[email,setEmail]=useState(''),[pass,setPass]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const submit=async e=>{
    e.preventDefault();setBusy(true);setErr('')
    const{data,error}=await sb.auth.signInWithPassword({email,password:pass})
    if(error){setErr(error.message);setBusy(false);return}
    if(data.user?.user_metadata?.role!=='admin'){await sb.auth.signOut();setErr('Sin acceso al panel.');setBusy(false);return}
    onLogin(data.user)
  }
  return<div className="login-wrap"><div className="login-card"><div className="login-logo"><h1>Centro <span>Anantara</span></h1></div><p style={{fontSize:13,color:'var(--text-muted)',textAlign:'center',marginBottom:24}}>Panel de administración</p>{err&&<div className="login-err">{err}</div>}<form onSubmit={submit}><Inp label="Email"type="email"value={email}onChange={e=>setEmail(e.target.value)}required placeholder="admin@anantara.com"/><Inp label="Contraseña"type="password"value={pass}onChange={e=>setPass(e.target.value)}required placeholder="••••••••"/><Btn style={{width:'100%',padding:11,marginTop:4}}disabled={busy}>{busy?'Accediendo…':'Entrar al panel'}</Btn></form></div></div>
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {label:'Principal',items:[{id:'dashboard',icon:'📊',label:'Dashboard'}]},
  {label:'Osteopatía',items:[
    {id:'agenda',icon:'📅',label:'Agenda'},
    {id:'horarios',icon:'🕐',label:'Horarios'},
    {id:'bloqueados',icon:'🚫',label:'Días bloqueados'},
    {id:'espera',icon:'⏳',label:'Lista de espera'},
  ]},
  {label:'Clases',items:[
    {id:'yoga',icon:'🧘',label:'Yoga'},
    {id:'belleza',icon:'✨',label:'Belleza'},
  ]},
  {label:'Centro',items:[
    {id:'pacientes',icon:'👥',label:'Pacientes'},
    {id:'profesionales',icon:'👩‍⚕️',label:'Profesionales'},
    {id:'servicios',icon:'🛠',label:'Servicios'},
  ]},
]
function Sidebar({page,onNav,open,onClose,onLogout}){
  return<>
    <div className={`sidebar-overlay ${open?'open':''}`}onClick={onClose}/>
    <nav className={`sidebar ${open?'open':''}`}>
      <div className="sidebar-logo">Centro <span>Anantara</span></div>
      <div className="sidebar-nav">
        {NAV_GROUPS.map(g=><div key={g.label}className="sidebar-group">
          <div className="sidebar-group-label">{g.label}</div>
          {g.items.map(it=><button key={it.id}className={`nav-btn ${page===it.id?'active':''}`}onClick={()=>{onNav(it.id);onClose()}}>
            <span className="ico">{it.icon}</span>{it.label}
          </button>)}
        </div>)}
      </div>
      <div className="sidebar-footer"><button className="nav-btn"onClick={onLogout}><span className="ico">🚪</span>Cerrar sesión</button></div>
    </nav>
  </>
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function Layout({title,children,sidebarOpen,onToggleSidebar,notifCount,page,onNav,onLogout}){
  return<div className="app-shell">
    <Sidebar page={page}onNav={onNav}open={sidebarOpen}onClose={()=>onToggleSidebar(false)}onLogout={onLogout}/>
    <div className="main-wrap">
      <header className="topbar">
        <div className="topbar-left">
          <button className="hamburger"onClick={()=>onToggleSidebar(true)}>☰</button>
          <span className="topbar-title">{title}</span>
        </div>
        <button className="notif-btn">🔔{notifCount>0&&<span className="notif-badge">{notifCount}</span>}</button>
      </header>
      <main className="page-content">{children}</main>
    </div>
  </div>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({onNav}){
  const[stats,setStats]=useState({today:0,week:0,patients:0})
  const[waitCount,setWaitCount]=useState(0)
  const[todayA,setTodayA]=useState([])
  const[slots,setSlots]=useState([])
  const[loading,setLoading]=useState(true)
  const[toast,setToast]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const today=toK(new Date()), weekEnd=toK(new Date(Date.now()+6*86400000))
    const[apToday,apWeek,pats,upSlots,waitList]=await Promise.all([
      sb.from('appointments').select('id,start_time,status,patients(full_name),services(name),professionals(full_name)',{count:'exact'})
        .gte('start_time',today+'T00:00:00').lte('start_time',today+'T23:59:59').neq('status','cancelled').order('start_time').limit(10),
      sb.from('appointments').select('id',{count:'exact'})
        .gte('start_time',today+'T00:00:00').lte('start_time',weekEnd+'T23:59:59').neq('status','cancelled'),
      sb.from('patients').select('id',{count:'exact'}),
      sb.from('availability_slots').select('id,start_time,capacity,services(name),bookings(id)')
        .gte('start_time',today+'T00:00:00').order('start_time').limit(6),
      sb.from('waiting_list').select('id',{count:'exact'}),
    ])
    setStats({today:apToday.count||0,week:apWeek.count||0,patients:pats.count||0})
    setWaitCount(waitList.count||0)
    setTodayA(apToday.data||[])
    setSlots((upSlots.data||[]).map(s=>({...s,booked:s.bookings?.length||0})))
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    const ch=sb.channel('admin-notifs')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'appointments'},()=>{setToast({msg:'Nueva cita registrada',type:'ok'});load()})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'bookings'},()=>{setToast({msg:'Nueva reserva de clase',type:'ok'});load()})
      .subscribe()
    return()=>sb.removeChannel(ch)
  },[load])

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}

    {waitCount>0&&<div className="alert-banner"onClick={()=>onNav('espera')}>
      <span style={{fontSize:20}}>⏳</span>
      <span className="alert-banner-text">Hay {waitCount} paciente{waitCount!==1?'s':''} en lista de espera. Pulsa para gestionar.</span>
      <span style={{fontSize:12,fontWeight:700,color:'#7a5c10'}}>Ver →</span>
    </div>}

    <div className="stats-grid">
      {[['Citas hoy',stats.today,'osteopatía'],['Esta semana',stats.week,'próximos 7 días'],['Pacientes',stats.patients,'registrados']].map(([l,v,s])=>
        <div key={l}className="card stat-card"><div className="stat-label">{l}</div><div className="stat-value">{v}</div><div className="stat-sub">{s}</div></div>
      )}
    </div>

    <div className="dash-grid">
      <div>
        <div className="section-header"><span className="section-title">Citas de hoy</span></div>
        <div className="card"style={{overflow:'hidden'}}>
          {todayA.length===0?<Em icon="📅"title="Sin citas hoy"sub="No hay citas programadas"/>
          :todayA.map(a=><div key={a.id}className="dash-row">
            <span style={{fontSize:12,fontWeight:700,color:'var(--green)',minWidth:44}}>{fTime(a.start_time)}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.patients?.full_name||'—'}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.services?.name} {a.professionals?.full_name?`· ${a.professionals.full_name}`:''}</div>
            </div>
            <Bg variant={STATUS_CLS[a.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[a.status]||a.status}</Bg>
          </div>)}
        </div>
      </div>
      <div>
        <div className="section-header"><span className="section-title">Próximas clases</span></div>
        <div className="card"style={{overflow:'hidden'}}>
          {slots.length===0?<Em icon="🧘"title="Sin clases próximas"/>
          :slots.map(s=>{const pct=s.capacity>0?Math.round(s.booked/s.capacity*100):0;return(
            <div key={s.id}className="slot-card">
              <div className="slot-info">
                <div className="slot-title">{s.services?.name||'Clase'}</div>
                <div className="slot-meta">{fDT(s.start_time)} · {s.booked}/{s.capacity} plazas</div>
                <div className="slot-bar"><div className="slot-bar-fill"style={{width:`${pct}%`}}/></div>
              </div>
              <Bg variant={pct>=100?'red':pct>=80?'gold':'green'}>{pct}%</Bg>
            </div>
          )})}
        </div>
      </div>
    </div>
  </>
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
const HOUR_START=8, HOUR_END=20, SLOT_H=60
function timeToY(t){if(!t)return 0;const[h,m]=t.split(':').map(Number);return(h-HOUR_START+m/60)*SLOT_H}
function durToH(m){return(m/60)*SLOT_H}

function Agenda(){
  const[weekRef,setWeekRef]=useState(new Date())
  const[appointments,setAppts]=useState([])
  const[profs,setProfs]=useState([])
  const[services,setServices]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[patSearch,setPatSearch]=useState('')
  const[patResults,setPatResults]=useState([])
  const[selPat,setSelPat]=useState(null)
  const[form,setForm]=useState({prof_id:'',svc_id:'',date:'',time:'',notes:''})
  const[editNotes,setEditNotes]=useState('')
  const[editProfId,setEditProfId]=useState('')
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  // Filters
  const[filterProf,setFilterProf]=useState('all')  // 'all' | professional_id
  const[hourFrom,setHourFrom]=useState(8)
  const[hourTo,setHourTo]=useState(20)

  const days=getWeekDays(weekRef)

  const load=useCallback(async()=>{
    setLoading(true)
    const from=toK(days[0])+'T00:00:00', to=toK(days[6])+'T23:59:59'
    const[appts,profsR]=await Promise.all([
      sb.from('appointments').select('id,start_time,end_time,status,professional_id,notes,patients(id,full_name),services(name,duration),professionals(full_name)')
        .gte('start_time',from).lte('start_time',to).neq('status','cancelled'),
      sb.from('professionals').select('id,full_name').eq('active',true).order('full_name'),
    ])
    setAppts(appts.data||[])
    setProfs(profsR.data||[])
    setLoading(false)
  },[weekRef]) // eslint-disable-line

  useEffect(()=>{load()},[load])
  useEffect(()=>{sb.from('services').select('id,name,duration').eq('active',true).order('name').then(({data})=>setServices(data||[]))},[])

  useEffect(()=>{
    if(!patSearch.trim()){setPatResults([]);return}
    const t=setTimeout(async()=>{
      const{data}=await sb.from('patients').select('id,full_name,phone').or(`full_name.ilike.%${patSearch}%,phone.ilike.%${patSearch}%`).limit(6)
      setPatResults(data||[])
    },250)
    return()=>clearTimeout(t)
  },[patSearch])

  // When detail modal opens, populate edit fields
  useEffect(()=>{
    if(modal&&modal!=='create'){
      setEditNotes(modal.notes||'')
      setEditProfId(modal.professional_id||'')
    }
  },[modal])

  const updateStatus=async(status)=>{
    await sb.from('appointments').update({status}).eq('id',modal.id)
    setToast({msg:STATUS_TXT[status]+' correctamente',type:'ok'})
    setModal(null); load()
  }

  const saveApptChanges=async()=>{
    setSaving(true)
    await sb.from('appointments').update({notes:editNotes||null,professional_id:editProfId||modal.professional_id}).eq('id',modal.id)
    setSaving(false); setToast({msg:'Cita actualizada',type:'ok'}); setModal(null); load()
  }

  const cancelAppt=async(id)=>{
    await sb.from('appointments').update({status:'cancelled',cancelled_by:'admin'}).eq('id',id)
    setModal(null); setToast({msg:'Cita cancelada',type:'ok'}); load()
  }

  const createAppt=async()=>{
    if(!selPat||!form.prof_id||!form.svc_id||!form.date||!form.time)return
    const svc=services.find(s=>s.id===form.svc_id)
    const dur=svc?.duration||60
    const startDT=`${form.date}T${form.time}:00`
    const endDate=new Date(startDT); endDate.setMinutes(endDate.getMinutes()+dur)
    const{error}=await sb.from('appointments').insert({
      patient_id:selPat.id,professional_id:form.prof_id,service_id:form.svc_id,
      start_time:startDT,end_time:endDate.toISOString(),notes:form.notes||null,status:'confirmed',
    })
    if(error){setToast({msg:error.message,type:'error'});return}
    setModal(null);setSelPat(null);setPatSearch('');setForm({prof_id:'',svc_id:'',date:'',time:'',notes:''})
    setToast({msg:'Cita creada',type:'ok'});load()
  }

  const hours=Array.from({length:hourTo-hourFrom},(_,i)=>hourFrom+i)
  const today=toK(new Date())
  const weekStr=`${fD(days[0])} – ${fD(days[6])}`

  const apptColor=s=>{
    if(s==='confirmed')return{bg:'#d1fae5',border:'#10b981',text:'#065f46'}
    if(s==='completed')return{bg:'#e0e7ff',border:'#6366f1',text:'#3730a3'}
    if(s==='pending')return{bg:  '#fef9c3',border:'#ca8a04',text:'#713f12'}
    return{bg:'#f1f5f9',border:'#94a3b8',text:'#64748b'}
  }

  const dayAppts=date=>{
    const dk=toK(date)
    return appointments.filter(a=>{
      if(!a.start_time?.startsWith(dk)) return false
      if(filterProf!=='all' && a.professional_id!==filterProf) return false
      return true
    })
  }

  const timeToYLocal=t=>{if(!t)return 0;const[h,m]=t.split(':').map(Number);return(h-hourFrom+m/60)*SLOT_H}

  const HOUR_OPTIONS=Array.from({length:24},(_,i)=>i)

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">{weekStr}</span>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Btn variant="ghost"style={{padding:'6px 12px'}}onClick={()=>setWeekRef(new Date(weekRef.getTime()-7*86400000))}>← Anterior</Btn>
        <Btn variant="ghost"style={{padding:'6px 10px'}}onClick={()=>setWeekRef(new Date())}>Hoy</Btn>
        <Btn variant="ghost"style={{padding:'6px 12px'}}onClick={()=>setWeekRef(new Date(weekRef.getTime()+7*86400000))}>Siguiente →</Btn>
        <Btn style={{padding:'6px 14px'}}onClick={()=>setModal('create')}>+ Cita</Btn>
      </div>
    </div>

    {/* Filters bar */}
    <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)'}}>Profesional</span>
        <select className="field-input"style={{width:'auto',padding:'6px 10px',fontSize:13}}
          value={filterProf} onChange={e=>setFilterProf(e.target.value)}>
          <option value="all">Todos</option>
          {profs.map(p=><option key={p.id}value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)'}}>Desde</span>
        <select className="field-input"style={{width:'auto',padding:'6px 10px',fontSize:13}}
          value={hourFrom} onChange={e=>setHourFrom(Number(e.target.value))}>
          {HOUR_OPTIONS.filter(h=>h<hourTo).map(h=><option key={h}value={h}>{pad(h)}:00</option>)}
        </select>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)'}}>Hasta</span>
        <select className="field-input"style={{width:'auto',padding:'6px 10px',fontSize:13}}
          value={hourTo} onChange={e=>setHourTo(Number(e.target.value))}>
          {HOUR_OPTIONS.filter(h=>h>hourFrom).map(h=><option key={h}value={h}>{pad(h)}:00</option>)}
        </select>
      </div>
    </div>

    {loading?<Sp/>:<div className="agenda-scroll">
      <div className="agenda-grid"style={{gridTemplateColumns:`54px repeat(${days.length},1fr)`}}>
        <div className="ag-header time-col"style={{gridColumn:1,gridRow:1}}/>
        {days.map((d,i)=><div key={i}className={`ag-header ${toK(d)===today?'today':''}`}style={{gridColumn:i+2,gridRow:1}}>
          <div>{DAYS_ES[d.getDay()]}</div><div style={{fontSize:16,fontWeight:900}}>{d.getDate()}</div>
        </div>)}
        {hours.map((h,hi)=><React.Fragment key={`row-${h}`}>
          <div className="ag-time"style={{gridColumn:1,gridRow:hi+2}}>{pad(h)}:00</div>
          {days.map((d,di)=>{
            const da=hi===0?dayAppts(d):[]
            return<div key={`c-${h}-${di}`}className="ag-col"style={{gridColumn:di+2,gridRow:hi+2}}>
              {da.map(a=>{
                const t=a.start_time?.slice(11,16)||'08:00'
                const et=a.end_time?.slice(11,16)
                const dur=et?(new Date('2000-01-01T'+et)-new Date('2000-01-01T'+t))/60000:60
                const c=apptColor(a.status)
                return<div key={a.id}className="appt-block"onClick={()=>setModal(a)}
                  style={{top:timeToYLocal(t),height:Math.max(durToH(dur)-2,18),background:c.bg,borderLeft:`3px solid ${c.border}`,color:c.text}}>
                  <div style={{fontWeight:700,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{t} {a.patients?.full_name||''}</div>
                  <div style={{fontSize:9,opacity:.8,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{a.services?.name}{filterProf==='all'&&a.professionals?.full_name?` · ${a.professionals.full_name}`:''}</div>
                </div>
              })}
            </div>
          })}
        </React.Fragment>)}
      </div>
    </div>}

    {/* Create modal */}
    {modal==='create'&&<Modal title="Nueva cita"onClose={()=>setModal(null)}>
      <div style={{position:'relative',marginBottom:14}}>
        <label className="field-label">Paciente</label>
        <input className="field-input"placeholder="Buscar…"value={selPat?selPat.full_name:patSearch}
          onChange={e=>{setPatSearch(e.target.value);setSelPat(null)}}/>
        {patResults.length>0&&!selPat&&<div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--white)',border:'1px solid var(--border)',borderRadius:8,zIndex:10,boxShadow:'var(--shadow)'}}>
          {patResults.map(p=><div key={p.id}style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)',fontSize:13}}
            onClick={()=>{setSelPat(p);setPatSearch('');setPatResults([])}}><strong>{p.full_name}</strong> <span style={{color:'var(--text-muted)'}}>{p.phone}</span></div>)}
        </div>}
      </div>
      <Sel label="Profesional"value={form.prof_id}onChange={e=>setForm(f=>({...f,prof_id:e.target.value}))}options={[['','Seleccionar…'],...profs.map(p=>[p.id,p.full_name])]}/>
      <Sel label="Servicio"value={form.svc_id}onChange={e=>setForm(f=>({...f,svc_id:e.target.value}))}options={[['','Seleccionar…'],...services.map(s=>[s.id,`${s.name} (${s.duration}min)`])]}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Inp label="Fecha"type="date"value={form.date}onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
        <Inp label="Hora"type="time"value={form.time}onChange={e=>setForm(f=>({...f,time:e.target.value}))}/>
      </div>
      <div className="field"><label className="field-label">Notas (opcional)</label><textarea className="notes-area"value={form.notes}onChange={e=>setForm(f=>({...f,notes:e.target.value}))}placeholder="Observaciones…"/></div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={createAppt}disabled={!selPat||!form.prof_id||!form.svc_id||!form.date||!form.time}style={{flex:1}}>Guardar</Btn>
      </div>
    </Modal>}

    {/* Detail modal */}
    {modal&&modal!=='create'&&<Modal title="Detalle de cita"onClose={()=>setModal(null)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>PACIENTE</div><div style={{fontSize:14,fontWeight:700}}>{modal.patients?.full_name||'—'}</div></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>ESTADO</div><Bg variant={STATUS_CLS[modal.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[modal.status]||modal.status}</Bg></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>SERVICIO</div><div style={{fontSize:13}}>{modal.services?.name||'—'}</div></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>FECHA Y HORA</div><div style={{fontSize:13}}>{fDT(modal.start_time)}</div></div>
      </div>

      {/* Reasignar profesional */}
      <div className="field">
        <label className="field-label">Profesional</label>
        <select className="field-input"value={editProfId}onChange={e=>setEditProfId(e.target.value)}>
          {profs.map(p=><option key={p.id}value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      {/* Notas editables */}
      <div className="field">
        <label className="field-label">Notas internas</label>
        <textarea className="notes-area"value={editNotes}onChange={e=>setEditNotes(e.target.value)}placeholder="Observaciones del profesional…"/>
      </div>

      {/* Acciones de estado */}
      <div className="appt-actions">
        {modal.status==='pending'&&<Btn variant="secondary"onClick={()=>updateStatus('confirmed')}style={{flex:1}}>✓ Confirmar</Btn>}
        {(modal.status==='confirmed'||modal.status==='pending')&&<Btn variant="gold"onClick={()=>updateStatus('completed')}style={{flex:1}}>✓ Completada</Btn>}
        {modal.status!=='cancelled'&&<Btn variant="danger"onClick={()=>cancelAppt(modal.id)}style={{flex:1}}>Cancelar</Btn>}
      </div>

      <div style={{display:'flex',gap:10,marginTop:10}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cerrar</Btn>
        <Btn onClick={saveApptChanges}disabled={saving}style={{flex:1}}>{saving?'Guardando…':'Guardar cambios'}</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Horarios ─────────────────────────────────────────────────────────────────
function Horarios(){
  const[profs,setProfs]=useState([])
  const[selProf,setSelProf]=useState(null)
  const[rows,setRows]=useState([])
  const[slotDur,setSlotDur]=useState(60)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  const WORK_DAYS=[1,2,3,4,5,6]
  const DAY_NAMES=['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

  useEffect(()=>{
    sb.from('professionals').select('id,full_name,slot_duration').eq('active',true).order('full_name')
      .then(({data})=>{setProfs(data||[]);if(data?.length)setSelProf(data[0])})
  },[])

  useEffect(()=>{
    if(!selProf)return
    setSlotDur(selProf.slot_duration||60)
    sb.from('working_hours').select('*').eq('professional_id',selProf.id)
      .then(({data})=>{
        setRows(WORK_DAYS.map(d=>{
          const ex=data?.find(r=>r.day_of_week===d)
          return ex?{day_of_week:d,active:ex.active,start_time:ex.start_time?.slice(0,5)||'09:00',end_time:ex.end_time?.slice(0,5)||'18:00'}
                   :{day_of_week:d,active:true,start_time:'09:00',end_time:'18:00'}
        }))
      })
  },[selProf])

  const save=async()=>{
    setSaving(true)
    for(const row of rows){
      await sb.from('working_hours').upsert({professional_id:selProf.id,day_of_week:row.day_of_week,active:row.active,start_time:row.start_time,end_time:row.end_time},{onConflict:'professional_id,day_of_week'})
    }
    // Save slot duration to professionals table
    try{await sb.from('professionals').update({slot_duration:slotDur}).eq('id',selProf.id)}catch{}
    setSaving(false); setToast({msg:'Horarios guardados',type:'ok'})
  }

  const upd=(idx,key,val)=>setRows(rs=>rs.map((r,i)=>i===idx?{...r,[key]:val}:r))

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Horarios de trabajo</span>
      <Btn onClick={save}disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</Btn>
    </div>

    {profs.length>1&&<div className="tab-pills">{profs.map(p=><button key={p.id}className={`tab-pill ${selProf?.id===p.id?'active':''}`}onClick={()=>setSelProf(p)}>{p.full_name}</button>)}</div>}

    {/* Slot duration */}
    <div className="card"style={{padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700}}>Duración de cada cita</div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Tiempo reservado por cita de osteopatía</div>
      </div>
      <select className="dur-select"value={slotDur}onChange={e=>setSlotDur(Number(e.target.value))}>
        {[30,45,60,90].map(d=><option key={d}value={d}>{d} minutos</option>)}
      </select>
    </div>

    <div className="card"style={{padding:'4px 20px 16px',overflow:'hidden'}}>
      <div style={{display:'grid',gridTemplateColumns:'120px 44px 1fr',gap:10,padding:'10px 0',borderBottom:'1.5px solid var(--border)',fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase'}}>
        <span>Día</span><span>Activo</span><span>Horario</span>
      </div>
      {rows.map((row,i)=><div key={row.day_of_week}className="hours-row">
        <span style={{fontSize:13,fontWeight:700,color:row.active?'var(--text)':'var(--text-muted)'}}>{DAY_NAMES[row.day_of_week]}</span>
        <Toggle on={row.active}onChange={v=>upd(i,'active',v)}/>
        {row.active?<div className="hours-times">
          <input type="time"className="field-input"style={{width:100,padding:'6px 8px'}}value={row.start_time}onChange={e=>upd(i,'start_time',e.target.value)}/>
          <span>–</span>
          <input type="time"className="field-input"style={{width:100,padding:'6px 8px'}}value={row.end_time}onChange={e=>upd(i,'end_time',e.target.value)}/>
        </div>:<span style={{fontSize:12,color:'var(--text-muted)'}}>Día libre</span>}
      </div>)}
    </div>
  </>
}

// ─── Bloqueados ───────────────────────────────────────────────────────────────
function Bloqueados(){
  const[calYear,setCalYear]=useState(new Date().getFullYear())
  const[calMonth,setCalMonth]=useState(new Date().getMonth())
  const[blocked,setBlocked]=useState([])
  const[profs,setProfs]=useState([])
  const[selProf,setSelProf]=useState(null)
  const[blockAll,setBlockAll]=useState(false)
  const[toast,setToast]=useState(null)
  const todayK=toK(new Date())

  useEffect(()=>{sb.from('professionals').select('id,full_name').eq('active',true).order('full_name')
    .then(({data})=>{setProfs(data||[]);if(data?.length)setSelProf(data[0])})},[])

  useEffect(()=>{
    if(!selProf)return
    const from=`${calYear}-${pad(calMonth+1)}-01`, to=`${calYear}-${pad(calMonth+1)}-31`
    sb.from('blocked_days').select('blocked_date').eq('professional_id',selProf.id).gte('blocked_date',from).lte('blocked_date',to)
      .then(({data})=>setBlocked((data||[]).map(r=>r.blocked_date)))
  },[selProf,calYear,calMonth])

  const toggle=async dateK=>{
    if(!selProf)return
    const targetProfs=blockAll?profs:[selProf]
    if(blocked.includes(dateK)){
      for(const p of targetProfs) await sb.from('blocked_days').delete().eq('professional_id',p.id).eq('blocked_date',dateK)
      setBlocked(b=>b.filter(d=>d!==dateK)); setToast({msg:'Día desbloqueado',type:'ok'})
    }else{
      for(const p of targetProfs){
        const{error}=await sb.from('blocked_days').insert({professional_id:p.id,blocked_date:dateK})
        if(error&&error.code!=='23505')console.error(error) // ignore duplicate key
      }
      setBlocked(b=>[...b,dateK]); setToast({msg:blockAll?`Día bloqueado para todos (${targetProfs.length})`:'Día bloqueado',type:'ok'})
    }
  }

  const days=gMD(calYear,calMonth)
  const monthName=new Date(calYear,calMonth,1).toLocaleString('es-ES',{month:'long',year:'numeric'})

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header"><span className="section-title">Días bloqueados</span></div>

    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16,flexWrap:'wrap'}}>
      {profs.length>1&&<div className="tab-pills"style={{margin:0}}>{profs.map(p=><button key={p.id}className={`tab-pill ${selProf?.id===p.id?'active':''}`}onClick={()=>setSelProf(p)}>{p.full_name}</button>)}</div>}
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
        <Toggle on={blockAll}onChange={setBlockAll}/>
        Aplicar a todos los profesionales
      </label>
    </div>

    <div className="card"style={{padding:20,maxWidth:440}}>
      <div className="mini-cal-nav">
        <Btn variant="ghost"style={{padding:'4px 10px'}}onClick={()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1)}}>←</Btn>
        <span style={{fontWeight:800,fontSize:15,textTransform:'capitalize'}}>{monthName}</span>
        <Btn variant="ghost"style={{padding:'4px 10px'}}onClick={()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1)}}>→</Btn>
      </div>
      <div className="mini-cal-grid">
        {['L','M','X','J','V','S','D'].map(d=><div key={d}className="cal-day-label">{d}</div>)}
        {days.map(({date,other},i)=>{
          const dk=toK(date)
          return<div key={i}className={`cal-day ${other?'other-month':''} ${blocked.includes(dk)?'blocked':''} ${dk===todayK?'is-today':''}`}
            style={{opacity:dk<todayK&&!other?.5:1,cursor:dk<todayK||other?'default':'pointer'}}
            onClick={()=>!other&&dk>=todayK&&toggle(dk)}>{date.getDate()}</div>
        })}
      </div>
      <p style={{fontSize:11,color:'var(--text-muted)',marginTop:12,textAlign:'center'}}>Pulsa un día para bloquearlo o desbloquearlo</p>
      {blocked.length>0&&<div style={{marginTop:16}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>{blocked.length} día{blocked.length!==1?'s':''} bloqueado{blocked.length!==1?'s':''}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{blocked.sort().map(d=><Bg key={d}variant="red">{fD(d)}</Bg>)}</div>
      </div>}
    </div>
  </>
}

// ─── Espera ───────────────────────────────────────────────────────────────────
function Espera(){
  const[list,setList]=useState([])
  const[loading,setLoading]=useState(true)
  const[assignItem,setAssignItem]=useState(null)
  const[assignDate,setAssignDate]=useState('')
  const[availSlots,setAvailSlots]=useState([])
  const[slotsLoad,setSlotsLoad]=useState(false)
  const[selSlot,setSelSlot]=useState(null)
  const[confirming,setConfirming]=useState(false)
  const[toast,setToast]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const{data}=await sb.from('waiting_list')
      .select('id,patient_id,professional_id,service_id,created_at,notes,patients(full_name,phone),services(name),professionals(full_name)')
      .order('created_at')
    setList(data||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  useEffect(()=>{
    if(!assignDate||!assignItem)return
    setSlotsLoad(true);setAvailSlots([]);setSelSlot(null)
    const profId=assignItem.professional_id
    if(!profId){setSlotsLoad(false);return}
    sb.rpc('get_available_slots',{p_professional_id:profId,p_date:assignDate})
      .then(({data,error})=>{
        if(!error&&data?.length){
          setAvailSlots(data.map(s=>typeof s==='string'?{time:s}:{time:s.time||s.start_time?.slice(11,16)}))
        }else{
          // Fallback
          sb.from('appointments').select('start_time').eq('professional_id',profId)
            .gte('start_time',assignDate+'T00:00:00').lte('start_time',assignDate+'T23:59:59')
            .neq('status','cancelled').then(({data:ex})=>{
              const taken=new Set((ex||[]).map(a=>a.start_time.slice(11,16)))
              setAvailSlots([9,10,11,12,13,16,17,18].filter(h=>!taken.has(`${pad(h)}:00`)).map(h=>({time:`${pad(h)}:00`})))
            })
        }
        setSlotsLoad(false)
      })
  },[assignDate,assignItem])

  const confirmAssign=async()=>{
    if(!assignItem||!assignDate||!selSlot)return
    setConfirming(true)
    const startDT=new Date(`${assignDate}T${selSlot.time}:00`)
    const{error}=await sb.from('appointments').insert({
      patient_id:assignItem.patient_id,professional_id:assignItem.professional_id,
      service_id:assignItem.service_id,start_time:startDT.toISOString(),status:'confirmed',
    })
    if(error){setToast({msg:error.message,type:'error'});setConfirming(false);return}
    await sb.from('waiting_list').delete().eq('id',assignItem.id)
    setAssignItem(null);setAssignDate('');setAvailSlots([]);setSelSlot(null)
    setToast({msg:'Cita asignada y eliminado de la lista',type:'ok'});setConfirming(false);load()
  }

  const remove=async id=>{await sb.from('waiting_list').delete().eq('id',id);setToast({msg:'Eliminado de la lista',type:'ok'});load()}

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header"><span className="section-title">Lista de espera</span><Bg variant="gold">{list.length} en espera</Bg></div>
    <div className="card"style={{overflow:'hidden'}}>
      {list.length===0?<Em icon="✅"title="Lista vacía"sub="No hay pacientes en lista de espera"/>
      :list.map(item=><div key={item.id}className="wait-card">
        <div className="pac-avatar">{item.patients?.full_name?.slice(0,2).toUpperCase()||'?'}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700}}>{item.patients?.full_name||'—'}</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{item.patients?.phone||'Sin tel.'}{item.services?.name?` · ${item.services.name}`:''}{item.professionals?.full_name?` · ${item.professionals.full_name}`:''}</div>
          {item.notes&&<div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{item.notes}</div>}
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>{fD(item.created_at)}</div>
          <div style={{display:'flex',gap:6}}>
            <Btn variant="secondary"style={{padding:'4px 10px',fontSize:11}}onClick={()=>{setAssignItem(item);setAssignDate('');setAvailSlots([]);setSelSlot(null)}}>Asignar hueco</Btn>
            <Btn variant="danger"style={{padding:'4px 10px',fontSize:11}}onClick={()=>remove(item.id)}>Eliminar</Btn>
          </div>
        </div>
      </div>)}
    </div>

    {assignItem&&<Modal title={`Asignar hueco — ${assignItem.patients?.full_name}`}onClose={()=>setAssignItem(null)}>
      <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>
        {assignItem.services?.name}{assignItem.professionals?.full_name?` · ${assignItem.professionals.full_name}`:''}
      </div>
      <Inp label="Fecha"type="date"value={assignDate}min={toK(new Date())}onChange={e=>setAssignDate(e.target.value)}/>
      {slotsLoad&&<div style={{textAlign:'center',padding:16,color:'var(--text-muted)',fontSize:13}}>Cargando huecos…</div>}
      {!slotsLoad&&assignDate&&availSlots.length===0&&<div style={{textAlign:'center',padding:16,color:'var(--text-muted)',fontSize:13}}>Sin huecos disponibles este día</div>}
      {!slotsLoad&&availSlots.length>0&&<>
        <label className="field-label">Hora disponible</label>
        <div className="assign-slots">
          {availSlots.map(s=><button key={s.time}className={`assign-slot ${selSlot?.time===s.time?'selected':''}`}onClick={()=>setSelSlot(s)}>{s.time}</button>)}
        </div>
      </>}
      <div style={{display:'flex',gap:10,marginTop:14}}>
        <Btn variant="ghost"onClick={()=>setAssignItem(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={confirmAssign}disabled={!selSlot||confirming}style={{flex:1}}>{confirming?'Asignando…':'Confirmar cita'}</Btn>
      </div>
    </Modal>}
  </>
}

// ─── SlotsManager ─────────────────────────────────────────────────────────────
function SlotsManager({section}){
  const isYoga=section==='yoga', title=isYoga?'Yoga':'Belleza'
  const[slots,setSlots]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[bookings,setBookings]=useState([])
  const[showBook,setShowBook]=useState(null)
  const[cancelModal,setCancelModal]=useState(null)
  const[form,setForm]=useState({start:'',end:'',capacity:8,service_id:''})
  const[services,setServices]=useState([])
  const[toast,setToast]=useState(null)
  const[tab,setTab]=useState('upcoming')

  const load=useCallback(async()=>{
    setLoading(true)
    const{data:svcs}=await sb.from('services').select('id,name').ilike('name',isYoga?'%yoga%':'%belleza%').eq('active',true)
    setServices(svcs||[])
    const svcIds=(svcs||[]).map(s=>s.id)
    if(svcIds.length===0){setSlots([]);setLoading(false);return}
    const now=new Date().toISOString()
    let q=sb.from('availability_slots')
      .select('id,start_time,end_time,capacity,published,services(id,name),bookings(id,status,patients(full_name,phone))')
      .in('service_id',svcIds).order('start_time',{ascending:tab==='upcoming'})
    if(tab==='upcoming') q=q.gte('start_time',now); else q=q.lt('start_time',now)
    const{data}=await q.limit(30)
    setSlots((data||[]).map(s=>({...s,booked:(s.bookings||[]).filter(b=>b.status!=='cancelled').length})))
    setLoading(false)
  },[section,tab])

  useEffect(()=>{load()},[load])

  const saveSlot=async()=>{
    if(!form.start||!form.capacity||!form.service_id)return
    const payload={service_id:form.service_id,start_time:form.start,end_time:form.end||null,capacity:Number(form.capacity),published:false}
    if(modal?.id) await sb.from('availability_slots').update(payload).eq('id',modal.id)
    else await sb.from('availability_slots').insert(payload)
    setModal(null);setForm({start:'',end:'',capacity:8,service_id:''})
    setToast({msg:modal?.id?'Clase actualizada':'Clase creada',type:'ok'});load()
  }

  const deleteSlot=async id=>{await sb.from('availability_slots').delete().eq('id',id);setToast({msg:'Clase eliminada',type:'ok'});load()}

  const cancelClass=async slot=>{
    // Mark cancelled (unpublish + note). In a real app you'd notify bookings.
    await sb.from('availability_slots').update({published:false}).eq('id',slot.id)
    // Cancel all active bookings for this slot
    await sb.from('bookings').update({status:'cancelled',cancelled_by:'admin'}).eq('slot_id',slot.id).neq('status','cancelled')
    setCancelModal(null); setToast({msg:`Clase cancelada. ${slot.booked} reserva${slot.booked!==1?'s':''} cancelada${slot.booked!==1?'s':''}`,type:'ok'}); load()
  }

  const togglePublish=async slot=>{
    await sb.from('availability_slots').update({published:!slot.published}).eq('id',slot.id)
    setToast({msg:slot.published?'Clase ocultada':'Clase publicada',type:'ok'}); load()
  }
  const openEdit=slot=>{setForm({start:slot.start_time?.slice(0,16)||'',end:slot.end_time?.slice(0,16)||'',capacity:slot.capacity,service_id:slot.services?.id||''});setModal(slot)}
  const openBookings=slot=>{setShowBook(slot);setBookings(slot.bookings||[])}

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Clases de {title}</span>
      <div style={{display:'flex',gap:8}}>
        <div className="tab-pills"style={{margin:0}}>{[['upcoming','Próximas'],['past','Pasadas']].map(([id,l])=><button key={id}className={`tab-pill ${tab===id?'active':''}`}onClick={()=>setTab(id)}>{l}</button>)}</div>
        <Btn onClick={()=>{setModal('new');setForm({start:'',end:'',capacity:8,service_id:''})}}>+ Nueva</Btn>
      </div>
    </div>
    <div className="card"style={{overflow:'hidden'}}>
      {slots.length===0?<Em icon={isYoga?'🧘':'✨'}title="Sin clases"sub={`No hay clases ${tab==='upcoming'?'próximas':'pasadas'}`}/>
      :slots.map(slot=>{const pct=slot.capacity>0?Math.round(slot.booked/slot.capacity*100):0;return(
        <div key={slot.id}className="slot-card">
          <div className="slot-info">
            <div className="slot-title">{slot.services?.name||title}</div>
            <div className="slot-meta">{fDT(slot.start_time)} · {slot.booked}/{slot.capacity} reservas</div>
            <div className="slot-bar"><div className="slot-bar-fill"style={{width:`${pct}%`}}/></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
            <Bg variant={slot.published?'green':'gray'}>{slot.published?'Publicada':'Borrador'}</Bg>
            <div style={{display:'flex',gap:4,marginTop:4}}>
              <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>openBookings(slot)}>👥 {slot.booked}</Btn>
              <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>openEdit(slot)}>✏️</Btn>
              <Btn variant={slot.published?'secondary':'primary'}style={{padding:'4px 8px',fontSize:11}}onClick={()=>togglePublish(slot)}>{slot.published?'Ocultar':'Publicar'}</Btn>
              {slot.booked>0&&<Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>setCancelModal(slot)}>Cancelar clase</Btn>}
              <Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>deleteSlot(slot.id)}>🗑</Btn>
            </div>
          </div>
        </div>
      )})}
    </div>

    {modal&&<Modal title={modal?.id?'Editar clase':'Nueva clase'}onClose={()=>setModal(null)}>
      <Sel label="Servicio"value={form.service_id}onChange={e=>setForm(f=>({...f,service_id:e.target.value}))}options={[['','Seleccionar…'],...services.map(s=>[s.id,s.name])]}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Inp label="Inicio"type="datetime-local"value={form.start}onChange={e=>setForm(f=>({...f,start:e.target.value}))}/>
        <Inp label="Fin (opcional)"type="datetime-local"value={form.end}onChange={e=>setForm(f=>({...f,end:e.target.value}))}/>
      </div>
      <Inp label="Plazas máximas"type="number"min={1}value={form.capacity}onChange={e=>setForm(f=>({...f,capacity:e.target.value}))}/>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={saveSlot}disabled={!form.start||!form.service_id}style={{flex:1}}>Guardar</Btn>
      </div>
    </Modal>}

    {showBook&&<Modal title={`Reservas — ${showBook.services?.name}`}onClose={()=>setShowBook(null)}>
      <div style={{marginBottom:14,fontSize:13,color:'var(--text-muted)'}}>{fDT(showBook.start_time)} · {showBook.booked}/{showBook.capacity} plazas</div>
      {bookings.filter(b=>b.status!=='cancelled').length===0?<Em icon="👥"title="Sin reservas"/>
      :bookings.filter(b=>b.status!=='cancelled').map(b=><div key={b.id}style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
        <div className="pac-avatar">{b.patients?.full_name?.slice(0,2).toUpperCase()||'?'}</div>
        <div><div style={{fontSize:13,fontWeight:700}}>{b.patients?.full_name||'—'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{b.patients?.phone||'Sin teléfono'}</div></div>
      </div>)}
      <Btn variant="ghost"onClick={()=>setShowBook(null)}style={{width:'100%',marginTop:16}}>Cerrar</Btn>
    </Modal>}

    {cancelModal&&<Modal title="¿Cancelar esta clase?"onClose={()=>setCancelModal(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
        Se cancelará la clase <strong>{cancelModal.services?.name}</strong> del <strong>{fDT(cancelModal.start_time)}</strong>.<br/>
        Las <strong>{cancelModal.booked} reserva{cancelModal.booked!==1?'s':''}</strong> activas también se cancelarán. Esta acción no se puede deshacer.
      </p>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setCancelModal(null)}style={{flex:1}}>Volver</Btn>
        <Btn variant="danger"onClick={()=>cancelClass(cancelModal)}style={{flex:1}}>Cancelar clase</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Pacientes ────────────────────────────────────────────────────────────────
function Pacientes(){
  const[patients,setPatients]=useState([])
  const[loading,setLoading]=useState(true)
  const[query,setQuery]=useState('')
  const[selected,setSelected]=useState(null)
  const[history,setHistory]=useState([])
  const[histLoad,setHistLoad]=useState(false)
  const[page,setPage]=useState(0)
  const[total,setTotal]=useState(0)
  const PAGE_SIZE=20

  useEffect(()=>{const t=setTimeout(()=>fetchPats(query,0),300);return()=>clearTimeout(t)},[query])

  const fetchPats=async(q,p)=>{
    setLoading(true)
    let req=sb.from('patients').select('id,full_name,phone,created_at',{count:'exact'}).order('full_name').range(p*PAGE_SIZE,(p+1)*PAGE_SIZE-1)
    if(q.trim()) req=req.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    const{data,count}=await req
    setPatients(data||[]);setTotal(count||0);setPage(p);setLoading(false)
  }

  const fetchHistory=async patId=>{
    setHistLoad(true)
    const[appts,bookings]=await Promise.all([
      sb.from('appointments').select('id,start_time,status,professionals(full_name),services(name)').eq('patient_id',patId).order('start_time',{ascending:false}).limit(20),
      sb.from('bookings').select('id,status,created_at,availability_slots(start_time,services(name))').eq('patient_id',patId).order('created_at',{ascending:false}).limit(10),
    ])
    const a=(appts.data||[]).map(x=>({id:x.id,type:'osteo',typeLabel:'Osteopatía',name:x.services?.name||'Osteopatía',pro:x.professionals?.full_name,date:x.start_time,status:x.status}))
    const b=(bookings.data||[]).map(x=>{const name=x.availability_slots?.services?.name||'Clase';return{id:x.id,type:name.toLowerCase().includes('yoga')?'yoga':'belleza',typeLabel:name.toLowerCase().includes('yoga')?'Yoga':'Belleza',name,date:x.availability_slots?.start_time||x.created_at,status:x.status}})
    setHistory([...a,...b].sort((x,y)=>new Date(y.date)-new Date(x.date)));setHistLoad(false)
  }

  const selectPat=p=>{setSelected(p);fetchHistory(p.id)}
  const totalPages=Math.ceil(total/PAGE_SIZE)

  return<div className="pac-layout">
    <div>
      <div className="pac-search-bar">
        <span style={{fontSize:16}}>🔍</span>
        <input className="pac-search-input"placeholder="Buscar por nombre o teléfono…"value={query}onChange={e=>setQuery(e.target.value)}autoFocus/>
        {query&&<button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:14}}onClick={()=>setQuery('')}>✕</button>}
      </div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8,paddingLeft:4}}>{total} paciente{total!==1?'s':''}</div>
      <div className="card"style={{overflow:'hidden'}}>
        {loading?[1,2,3,4,5].map(i=><div key={i}className="skel"style={{height:56,margin:'6px 12px',borderRadius:10}}/>)
        :patients.length===0?<Em icon="👥"title="Sin resultados"sub="Prueba con otro nombre o teléfono"/>
        :patients.map(p=><div key={p.id}className={`pac-row ${selected?.id===p.id?'active':''}`}onClick={()=>selectPat(p)}>
          <div className="pac-avatar">{p.full_name?.slice(0,2).toUpperCase()||'?'}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{p.full_name}</div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>{p.phone||'Sin teléfono'}</div>
          </div>
          <span style={{fontSize:10,color:'#ccc'}}>›</span>
        </div>)}
      </div>
      {totalPages>1&&<div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
        <Btn variant="ghost"style={{padding:'6px 12px'}}disabled={page===0}onClick={()=>fetchPats(query,page-1)}>← Anterior</Btn>
        <span style={{alignSelf:'center',fontSize:12,color:'var(--text-muted)'}}>{page+1} / {totalPages}</span>
        <Btn variant="ghost"style={{padding:'6px 12px'}}disabled={page>=totalPages-1}onClick={()=>fetchPats(query,page+1)}>Siguiente →</Btn>
      </div>}
    </div>
    <div>
      {!selected?<Em icon="👆"title="Selecciona un paciente"sub="Haz click en un paciente para ver su historial"/>:<>
        <div className="card"style={{padding:20,marginBottom:20,display:'flex',alignItems:'center',gap:16}}>
          <div className="pac-avatar"style={{width:52,height:52,fontSize:18,fontWeight:900}}>{selected.full_name?.slice(0,2).toUpperCase()}</div>
          <div>
            <div style={{fontSize:18,fontWeight:800}}>{selected.full_name}</div>
            <div style={{fontSize:14,color:'var(--text-muted)',marginTop:4}}>{selected.phone||'Sin teléfono'}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Paciente desde {fD(selected.created_at)}</div>
          </div>
        </div>
        <div className="section-header"style={{marginBottom:12}}>
          <span className="section-title">Historial</span>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>{history.length} registros</span>
        </div>
        {histLoad?[1,2,3].map(i=><div key={i}className="skel"style={{height:64,marginBottom:8,borderRadius:12}}/>)
        :history.length===0?<Em icon="📋"title="Sin historial"sub="Este paciente no tiene citas registradas"/>
        :history.map(item=><div key={`${item.type}-${item.id}`}style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'var(--white)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)',marginBottom:8}}>
          <Bg variant={item.type==='osteo'?'green':item.type==='yoga'?'gold':'purple'}>{item.typeLabel}</Bg>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700}}>{item.name}{item.pro?` · ${item.pro}`:''}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{fDT(item.date)}</div>
          </div>
          <Bg variant={STATUS_CLS[item.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[item.status]||item.status}</Bg>
        </div>)}
      </>}
    </div>
  </div>
}

// ─── Servicios ────────────────────────────────────────────────────────────────
function Servicios(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[form,setForm]=useState({name:'',duration:60,price:'',category:'osteopatia',active:true,description:''})
  const[delConfirm,setDelConfirm]=useState(null)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  const CATS=[['osteopatia','Osteopatía'],['yoga','Yoga'],['belleza','Belleza'],['otro','Otro']]

  const load=useCallback(async()=>{
    setLoading(true)
    const{data}=await sb.from('services').select('*').order('display_order,name')
    setItems(data||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm({name:'',duration:60,price:'',category:'osteopatia',active:true,description:''});setModal('new')}
  const openEdit=svc=>{setForm({name:svc.name,duration:svc.duration||60,price:svc.price??'',category:svc.category||'osteopatia',active:svc.active,description:svc.description||''});setModal(svc)}

  const save=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    const payload={name:form.name.trim(),duration:Number(form.duration),price:form.price!==''?Number(form.price):null,category:form.category,active:form.active,description:form.description||null}
    if(modal?.id){
      await sb.from('services').update(payload).eq('id',modal.id)
    }else{
      const mx=items.reduce((m,s)=>Math.max(m,s.display_order||0),0)
      await sb.from('services').insert({...payload,display_order:mx+1})
    }
    setSaving(false);setModal(null);setToast({msg:modal?.id?'Servicio actualizado':'Servicio creado',type:'ok'});load()
  }

  const del=async id=>{
    await sb.from('services').delete().eq('id',id)
    setDelConfirm(null);setToast({msg:'Servicio eliminado',type:'ok'});load()
  }

  const toggleActive=async svc=>{
    await sb.from('services').update({active:!svc.active}).eq('id',svc.id);load()
  }

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Catálogo de servicios</span>
      <Btn onClick={openNew}>+ Nuevo servicio</Btn>
    </div>

    <div className="card"style={{overflow:'hidden'}}>
      {items.length===0?<Em icon="🛠"title="Sin servicios"sub="Crea el primer servicio del catálogo"/>
      :items.map(svc=><div key={svc.id}className="svc-row">
        <span className={`svc-cat svc-cat-${svc.category||'otro'}`}>{CATS.find(([k])=>k===svc.category)?.[1]||svc.category}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:svc.active?'var(--text)':'var(--text-muted)',display:'flex',alignItems:'center',gap:8}}>
            {svc.name}
            {!svc.active&&<Bg variant="gray">Inactivo</Bg>}
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
            {svc.duration} min{svc.price!=null?` · ${svc.price}€`:''}
            {svc.description?` · ${svc.description}`:''}
          </div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <Toggle on={svc.active}onChange={()=>toggleActive(svc)}/>
          <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11}}onClick={()=>openEdit(svc)}>✏️ Editar</Btn>
          <Btn variant="danger"style={{padding:'4px 10px',fontSize:11}}onClick={()=>setDelConfirm(svc.id)}>🗑</Btn>
        </div>
      </div>)}
    </div>

    {modal&&<Modal title={modal?.id?'Editar servicio':'Nuevo servicio'}onClose={()=>setModal(null)}>
      <Inp label="Nombre del servicio *"value={form.name}onChange={e=>setForm(f=>({...f,name:e.target.value}))}required placeholder="Ej: Consulta osteopatía"/>
      <Sel label="Categoría"value={form.category}onChange={e=>setForm(f=>({...f,category:e.target.value}))}options={CATS}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div className="field">
          <label className="field-label">Duración (minutos)</label>
          <select className="field-input"value={form.duration}onChange={e=>setForm(f=>({...f,duration:e.target.value}))}>
            {[15,20,30,45,60,75,90,120].map(d=><option key={d}value={d}>{d} min</option>)}
          </select>
        </div>
        <Inp label="Precio (€, opcional)"type="number"min={0}step="0.01"value={form.price}onChange={e=>setForm(f=>({...f,price:e.target.value}))}placeholder="0.00"/>
      </div>
      <Inp label="Descripción (opcional)"value={form.description}onChange={e=>setForm(f=>({...f,description:e.target.value}))}placeholder="Breve descripción del servicio"/>
      <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13,marginBottom:16,cursor:'pointer'}}>
        <Toggle on={form.active}onChange={v=>setForm(f=>({...f,active:v}))}/>
        Servicio activo (visible para reservas)
      </label>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={save}disabled={!form.name.trim()||saving}style={{flex:1}}>{saving?'Guardando…':'Guardar'}</Btn>
      </div>
    </Modal>}

    {delConfirm&&<Modal title="¿Eliminar servicio?"onClose={()=>setDelConfirm(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Esta acción no se puede deshacer. Las citas existentes no se eliminarán.</p>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setDelConfirm(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn variant="danger"onClick={()=>del(delConfirm)}style={{flex:1}}>Eliminar</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Profesionales ────────────────────────────────────────────────────────────
function Profesionales(){
  const[items,   setItems]   =useState([])
  const[loading, setLoading] =useState(true)
  const[modal,   setModal]   =useState(null)   // null | 'new' | {id,...}
  const[form,    setForm]    =useState({full_name:'',specialty:'',bio:'',active:true})
  const[delConfirm,setDelConfirm]=useState(null)
  const[saving,  setSaving]  =useState(false)
  const[toast,   setToast]   =useState(null)

  const[loadErr,setLoadErr]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setLoadErr('')
    const{data,error}=await sb.from('professionals').select('*').order('full_name')
    if(error){setLoadErr(error.message);setItems([]);setLoading(false);return}
    setItems(data||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm({full_name:'',specialty:'',bio:'',active:true});setModal('new')}
  const openEdit=p=>{setForm({full_name:p.full_name,specialty:p.specialty||'',bio:p.bio||'',active:p.active});setModal(p)}

  const save=async()=>{
    if(!form.full_name.trim())return
    setSaving(true)
    const payload={full_name:form.full_name.trim(),specialty:form.specialty.trim()||null,bio:form.bio.trim()||null,active:form.active}
    let error
    if(modal?.id){
      ({error}=await sb.from('professionals').update(payload).eq('id',modal.id))
    }else{
      ({error}=await sb.from('professionals').insert(payload))
    }
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setModal(null);setToast({msg:modal?.id?'Profesional actualizado':'Profesional creado',type:'ok'});load()
  }

  const del=async id=>{
    const{error}=await sb.from('professionals').update({active:false}).eq('id',id)
    setDelConfirm(null)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Profesional desactivado',type:'ok'});load()
  }

  const toggleActive=async(id,val)=>{
    const{error}=await sb.from('professionals').update({active:val}).eq('id',id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setItems(prev=>prev.map(p=>p.id===id?{...p,active:val}:p))
  }

  const upd=e=>setForm(f=>({...f,[e.target.name]:e.target.value}))
  const SPECIALTIES=['Osteópata','Fisioterapeuta','Terapeuta','Instructora de Yoga','Esteticista','Masajista','Nutricionista','Otro']

  return<>
    <div className="section-header">
      <span className="section-title">Profesionales ({items.length})</span>
      <Btn onClick={openNew}>+ Nuevo profesional</Btn>
    </div>

    {loading&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Cargando…</div>}

    {loadErr&&<div style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#dc2626',padding:'12px 16px',borderRadius:10,marginBottom:16,fontSize:13}}>
      <strong>Error al cargar:</strong> {loadErr}<br/>
      <span style={{fontSize:12}}>Verifica las políticas RLS en Supabase o ejecuta el SQL de configuración.</span>
    </div>}

    {!loading&&!loadErr&&items.length===0&&<div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>
      <div style={{fontSize:36,marginBottom:8}}>👩‍⚕️</div>
      <div style={{fontWeight:700,marginBottom:4}}>Sin profesionales</div>
      <div style={{fontSize:13}}>Añade el primer profesional para empezar a gestionar citas.</div>
    </div>}

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
      {items.map(p=>(
        <div key={p.id} className="card" style={{padding:18,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:48,height:48,borderRadius:'50%',background:'linear-gradient(135deg,var(--green-dark),var(--green-light))',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,flexShrink:0}}>
              {p.full_name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:15,color:'var(--text)'}}>{p.full_name}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{p.specialty||'Sin especialidad'}</div>
            </div>
            <span className={`badge ${p.active?'badge-green':'badge-gray'}`}>{p.active?'Activo':'Inactivo'}</span>
          </div>
          {p.bio&&<p style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,margin:0}}>{p.bio}</p>}
          <div style={{display:'flex',gap:8,borderTop:'1px solid var(--border)',paddingTop:12}}>
            <Btn variant="ghost" onClick={()=>openEdit(p)} style={{flex:1,fontSize:12}}>Editar</Btn>
            <Btn variant={p.active?'secondary':'primary'} onClick={()=>toggleActive(p.id,!p.active)} style={{flex:1,fontSize:12}}>
              {p.active?'Desactivar':'Activar'}
            </Btn>
            <Btn variant="danger" onClick={()=>setDelConfirm(p.id)} style={{fontSize:12}}>🗑</Btn>
          </div>
        </div>
      ))}
    </div>

    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

    {modal&&<Modal title={modal?.id?'Editar profesional':'Nuevo profesional'} onClose={()=>setModal(null)}>
      <div className="field">
        <label className="field-label">Nombre completo *</label>
        <input className="field-input" name="full_name" value={form.full_name} onChange={upd} placeholder="Ana García López" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Especialidad</label>
        <select className="field-input" name="specialty" value={form.specialty} onChange={upd}>
          <option value="">Sin especificar</option>
          {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="field-label">Bio / descripción</label>
        <textarea className="field-input" name="bio" value={form.bio} onChange={upd} rows={3} placeholder="Breve descripción del profesional…" style={{resize:'vertical'}}/>
      </div>
      <div className="field" style={{display:'flex',alignItems:'center',gap:10}}>
        <input type="checkbox" id="pro-active" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{width:16,height:16,accentColor:'var(--green)'}}/>
        <label htmlFor="pro-active" style={{fontSize:13,fontWeight:600,cursor:'pointer'}}>Activo (visible para reservas)</label>
      </div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost" onClick={()=>setModal(null)} style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={save} disabled={!form.full_name.trim()||saving} style={{flex:1}}>{saving?'Guardando…':'Guardar'}</Btn>
      </div>
    </Modal>}

    {delConfirm&&<Modal title="¿Desactivar profesional?" onClose={()=>setDelConfirm(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>El profesional dejará de aparecer en el sistema de reservas. Sus citas existentes no se eliminarán.</p>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost" onClick={()=>setDelConfirm(null)} style={{flex:1}}>Cancelar</Btn>
        <Btn variant="danger" onClick={()=>del(delConfirm)} style={{flex:1}}>Desactivar</Btn>
      </div>
    </Modal>}
  </>
}

// ─── App ──────────────────────────────────────────────────────────────────────
const PAGE_TITLES={dashboard:'Dashboard',agenda:'Agenda',horarios:'Horarios',bloqueados:'Días bloqueados',espera:'Lista de espera',yoga:'Yoga',belleza:'Belleza',pacientes:'Pacientes',servicios:'Servicios',profesionales:'Profesionales'}

export default function App(){
  const[user,setUser]=useState(null)
  const[authLoading,setAuthLoading]=useState(true)
  const[page,setPage]=useState('dashboard')
  const[sidebarOpen,setSidebarOpen]=useState(false)
  const[notifCount,setNotifCount]=useState(0)

  useEffect(()=>{
    sb.auth.getSession().then(({data})=>{
      const u=data.session?.user
      if(u?.user_metadata?.role==='admin') setUser(u)
      setAuthLoading(false)
    })
    const{data:sub}=sb.auth.onAuthStateChange((_,session)=>{
      const u=session?.user
      if(u?.user_metadata?.role==='admin') setUser(u); else setUser(null)
    })
    return()=>sub.subscription.unsubscribe()
  },[])

  const logout=async()=>{await sb.auth.signOut();setUser(null)}

  if(authLoading)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',fontFamily:'sans-serif'}}><div style={{color:'var(--green)'}}>Cargando…</div></div>
  if(!user)return<LoginPage onLogin={setUser}/>

  const renderPage=()=>{
    switch(page){
      case 'dashboard':  return<Dashboard onNav={setPage}/>
      case 'agenda':     return<Agenda/>
      case 'horarios':   return<Horarios/>
      case 'bloqueados': return<Bloqueados/>
      case 'espera':     return<Espera/>
      case 'yoga':       return<SlotsManager section="yoga"/>
      case 'belleza':    return<SlotsManager section="belleza"/>
      case 'pacientes':     return<Pacientes/>
      case 'profesionales': return<Profesionales/>
      case 'servicios':     return<Servicios/>
      default:              return<Dashboard onNav={setPage}/>
    }
  }

  return<Layout title={PAGE_TITLES[page]||'Panel'}page={page}onNav={setPage}sidebarOpen={sidebarOpen}onToggleSidebar={setSidebarOpen}notifCount={notifCount}onLogout={logout}>
    {renderPage()}
  </Layout>
}
