import { createClient } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback, useRef } from 'react'

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'anantara-admin' } }
)


// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function pad(n) { return String(n).padStart(2,'0') }
function toK(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function localDT(d) { return `${toK(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function toIsoStr(iso){ if(!iso)return null; if(typeof iso==='string')return iso; return new Date(iso).toISOString() }
function fD(iso)  { const s=toIsoStr(iso); if(!s)return'—'; const d=new Date(s.slice(0,19)); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
function fDT(iso) { const s=toIsoStr(iso); if(!s)return'—'; const d=new Date(s.slice(0,19)); return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}` }
function fTime(iso){ const s=toIsoStr(iso); if(!s)return'—'; const d=new Date(s.slice(0,19)); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function getWeekDays(ref) {
  const d=new Date(ref), day=d.getDay()
  const mon=new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1))
  return Array.from({length:5},(_,i)=>{ const x=new Date(mon); x.setDate(mon.getDate()+i); return x })
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
    {id:'espera',icon:'⏳',label:'Listas'},
  ]},
  {label:'Clases',items:[
    {id:'yoga',icon:'🧘',label:'Yoga'},
    {id:'escalada',icon:'🧗',label:'Escalada'},
  ]},
  {label:'Centro',items:[
    {id:'belleza',icon:'✨',label:'Belleza'},
    {id:'pacientes',icon:'👥',label:'Pacientes'},
    {id:'profesionales',icon:'👩‍⚕️',label:'Profesionales'},
    {id:'servicios',icon:'🛠',label:'Servicios'},
  ]},
  {label:'Administración',items:[
    {id:'facturacion',icon:'🧾',label:'Facturación'},
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
  const[loading,setLoading]=useState(true)
  const[toast,setToast]=useState(null)
  const[kpi,setKpi]=useState({tomorrow:{total:0,confirmed:0,pending:0},weekFreeSlots:0,nextWeekFreeSlots:0})
  const[pending,setPending]=useState({proposals:[],unrespondedReminders:[],unassignedHoles:[]})
  const[lists,setLists]=useState({waiting:0,expedite:0,overdue:0})
  const[tomorrowByProf,setTomorrowByProf]=useState([])
  const[monthly,setMonthly]=useState({completed:0,cancelled:0,revenue:0})

  // Calcula huecos libres de un rango sumando minutos:
  //   working_hours - recurring_breaks - blocked_slots - blocked_days - citas activas
  // Devuelve count aproximado (minutos / slot_duration del prof, default 60).
  async function countFreeSlots(profs, fromDate, toDate) {
    const days = []
    for (let d = new Date(fromDate + 'T00:00:00'); d <= new Date(toDate + 'T23:59:59'); d.setDate(d.getDate() + 1)) {
      days.push({ ds: toK(d), dow: d.getDay() })
    }
    const profIds = profs.map(p => p.id)
    if (!profIds.length) return 0

    const [whResp, brResp, bsResp, bdResp, apResp] = await Promise.all([
      sb.from('working_hours').select('professional_id,day_of_week,start_time,end_time').in('professional_id', profIds),
      sb.from('recurring_breaks').select('professional_id,day_of_week,start_time,end_time').in('professional_id', profIds),
      sb.from('blocked_slots').select('professional_id,starts_at,ends_at').in('professional_id', profIds).gte('starts_at', fromDate+'T00:00:00').lte('starts_at', toDate+'T23:59:59'),
      sb.from('blocked_days').select('professional_id,date').in('professional_id', profIds).gte('date', fromDate).lte('date', toDate),
      sb.from('appointments').select('professional_id,starts_at,ends_at').in('professional_id', profIds).gte('starts_at', fromDate+'T00:00:00').lte('starts_at', toDate+'T23:59:59').in('status', ['pending','confirmed']),
    ])

    const minOf = (hhmm) => parseInt(hhmm.slice(0,2)) * 60 + parseInt(hhmm.slice(3,5))

    let totalFreeMin = 0
    for (const p of profs) {
      const slotDur = p.slot_duration || 60
      for (const day of days) {
        const wh = (whResp.data || []).find(r => r.professional_id === p.id && r.day_of_week === day.dow)
        if (!wh) continue
        if ((bdResp.data || []).find(r => r.professional_id === p.id && r.date === day.ds)) continue

        let mins = minOf(wh.end_time) - minOf(wh.start_time)
        for (const br of (brResp.data || []).filter(r => r.professional_id === p.id && r.day_of_week === day.dow)) {
          mins -= (minOf(br.end_time) - minOf(br.start_time))
        }
        for (const bs of (bsResp.data || []).filter(r => r.professional_id === p.id && r.starts_at.slice(0,10) === day.ds)) {
          mins -= ((minOf(bs.ends_at.slice(11,16)) - minOf(bs.starts_at.slice(11,16))))
        }
        for (const a of (apResp.data || []).filter(r => r.professional_id === p.id && r.starts_at.slice(0,10) === day.ds)) {
          mins -= ((minOf(a.ends_at.slice(11,16)) - minOf(a.starts_at.slice(11,16))))
        }
        if (mins > 0) totalFreeMin += Math.floor(mins / slotDur) * slotDur
      }
    }
    // Devolvemos n° de huecos asumiendo slot estándar 60 (lo más común).
    // Ajustamos por professional ya: cada prof hizo su Math.floor(mins/slotDur)*slotDur,
    // sumamos los minutos múltiplos y dividimos por 60 para una unidad común.
    return Math.floor(totalFreeMin / 60)
  }

  const load=useCallback(async()=>{
    setLoading(true)
    const today = toK(new Date())
    const tomorrow = toK(new Date(Date.now() + 86400000))
    const weekStart = today
    const weekEnd = toK(new Date(Date.now() + 6 * 86400000))
    const nextWeekStart = toK(new Date(Date.now() + 7 * 86400000))
    const nextWeekEnd = toK(new Date(Date.now() + 13 * 86400000))
    const monthStart = toK(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const monthEnd = toK(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))

    const [profsResp, tomorrowAppts, waitingResp, expediteResp, holdsResp, monthAppts] = await Promise.all([
      sb.from('professionals').select('id,name,slot_duration').eq('is_active', true).eq('section', 'osteopathy').order('name',{ascending:false}),
      sb.from('appointments').select('id,starts_at,status,reminder_sent_at,patients(full_name),services(name),professionals(id,name)')
        .gte('starts_at', tomorrow + 'T00:00:00').lte('starts_at', tomorrow + 'T23:59:59').neq('status', 'cancelled').order('starts_at'),
      sb.from('wait_queue').select('id,weeks_pautadas,created_at').eq('queue_type', 'waiting'),
      sb.from('wait_queue').select('id,weeks_pautadas,created_at').eq('queue_type', 'expedite'),
      sb.from('cancellation_holds').select('id,appointment_id,current_offer_id,appointments(starts_at,patients(full_name),professionals(name))').is('current_offer_id', null),
      sb.from('appointments').select('id,status,services(price)')
        .gte('starts_at', monthStart + 'T00:00:00').lte('starts_at', monthEnd + 'T23:59:59'),
    ])

    const profs = profsResp.data || []
    const tomorrowList = tomorrowAppts.data || []

    // KPI 1: citas mañana
    const tomorrowConfirmed = tomorrowList.filter(a => a.status === 'confirmed').length
    const tomorrowPending = tomorrowList.filter(a => a.status === 'pending').length

    // KPI 2/3: huecos libres
    const [weekFree, nextWeekFree] = await Promise.all([
      countFreeSlots(profs, weekStart, weekEnd),
      countFreeSlots(profs, nextWeekStart, nextWeekEnd),
    ])

    setKpi({
      tomorrow: { total: tomorrowList.length, confirmed: tomorrowConfirmed, pending: tomorrowPending },
      weekFreeSlots: weekFree,
      nextWeekFreeSlots: nextWeekFree,
    })

    // Pendientes de hoy: propuestas activas + recordatorios sin respuesta + huecos cancelled sin asignar
    const proposals = tomorrowList.filter(a => a.status === 'pending')
    const unrespondedReminders = tomorrowList.filter(a => a.status === 'confirmed' && a.reminder_sent_at)
    const unassignedHoles = (holdsResp.data || []).filter(h => h.appointments)

    setPending({ proposals, unrespondedReminders, unassignedHoles })

    // Listas y avisos
    const overdue = (waitingResp.data || []).filter(r => {
      if (r.weeks_pautadas == null) return false
      const elapsed = (Date.now() - new Date(r.created_at).getTime()) / (7 * 24 * 36e5)
      return elapsed > r.weeks_pautadas  // untilDue < 0
    }).length
    setLists({
      waiting: (waitingResp.data || []).length,
      expedite: (expediteResp.data || []).length,
      overdue,
    })

    // Citas mañana por profesional
    const byProf = profs.map(p => ({
      prof: p,
      appts: tomorrowList.filter(a => a.professionals?.id === p.id),
    }))
    setTomorrowByProf(byProf)

    // Resumen del mes
    const monthList = monthAppts.data || []
    const completed = monthList.filter(a => a.status === 'completed').length
    const cancelled = monthList.filter(a => a.status === 'cancelled').length
    const revenue = monthList.filter(a => a.status === 'completed').reduce((s, a) => s + (a.services?.price || 0), 0)
    setMonthly({ completed, cancelled, revenue })

    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    const ch=sb.channel('admin-notifs')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'appointments'},()=>{setToast({msg:'Nueva cita registrada',type:'ok'});load()})
      .subscribe()
    return()=>sb.removeChannel(ch)
  },[load])

  if(loading)return<Sp/>

  const totalListItems = lists.waiting + lists.expedite
  const hasAlerts = lists.overdue > 0 || pending.unassignedHoles.length > 0

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}

    {hasAlerts && <div className="alert-banner" onClick={()=>onNav('espera')}>
      <span style={{fontSize:20}}>⚠️</span>
      <span className="alert-banner-text">
        {lists.overdue > 0 && `${lists.overdue} paciente${lists.overdue!==1?'s':''} en lista vencido${lists.overdue!==1?'s':''}. `}
        {pending.unassignedHoles.length > 0 && `${pending.unassignedHoles.length} hueco${pending.unassignedHoles.length!==1?'s':''} cancelado${pending.unassignedHoles.length!==1?'s':''} sin asignar.`}
      </span>
      <span style={{fontSize:12,fontWeight:700,color:'#7a5c10'}}>Gestionar →</span>
    </div>}

    {/* Fila 1: KPIs */}
    <div className="stats-grid">
      <div className="card stat-card" style={{cursor:'pointer'}} onClick={()=>onNav('agenda')}>
        <div className="stat-label">Citas mañana</div>
        <div className="stat-value">{kpi.tomorrow.total}</div>
        <div className="stat-sub">
          {kpi.tomorrow.confirmed} confirmada{kpi.tomorrow.confirmed!==1?'s':''}
          {kpi.tomorrow.pending > 0 && ` · ${kpi.tomorrow.pending} pendiente${kpi.tomorrow.pending!==1?'s':''}`}
        </div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Huecos esta semana</div>
        <div className="stat-value">{kpi.weekFreeSlots}</div>
        <div className="stat-sub">disponibles para reservar</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Huecos próxima semana</div>
        <div className="stat-value">{kpi.nextWeekFreeSlots}</div>
        <div className="stat-sub">disponibles para reservar</div>
      </div>
    </div>

    {/* Fila 2: Pendientes y listas/avisos */}
    <div className="dash-grid">
      <div>
        <div className="section-header"><span className="section-title">Pendientes</span></div>
        <div className="card" style={{overflow:'hidden'}}>
          {pending.proposals.length === 0 && pending.unrespondedReminders.length === 0 && pending.unassignedHoles.length === 0
            ? <Em icon="✅" title="Todo al día" sub="Sin pendientes"/>
            : <>
              {pending.unassignedHoles.length > 0 && <div style={{padding:'10px 14px',background:'#fee2e2',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#991b1b',textTransform:'uppercase',marginBottom:4}}>Huecos cancelados sin asignar</div>
                {pending.unassignedHoles.slice(0,3).map(h => <div key={h.id} className="dash-row" onClick={()=>onNav('agenda')} style={{cursor:'pointer',padding:'4px 0'}}>
                  <span style={{fontSize:12,color:'var(--text-muted)',minWidth:90}}>{fDT(h.appointments?.starts_at)}</span>
                  <div style={{flex:1,fontSize:13}}>{h.appointments?.patients?.full_name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{h.appointments?.professionals?.name||''}</div>
                </div>)}
              </div>}
              {pending.proposals.length > 0 && <div style={{padding:'10px 14px',background:'#fef3c7',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#92400e',textTransform:'uppercase',marginBottom:4}}>Propuestas pendientes (mañana)</div>
                {pending.proposals.slice(0,3).map(a => <div key={a.id} className="dash-row" style={{padding:'4px 0'}}>
                  <span style={{fontSize:12,color:'var(--text-muted)',minWidth:44}}>{fTime(a.starts_at)}</span>
                  <div style={{flex:1,fontSize:13}}>{a.patients?.full_name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.professionals?.name}</div>
                </div>)}
              </div>}
              {pending.unrespondedReminders.length > 0 && <div style={{padding:'10px 14px'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Recordatorios enviados (sin respuesta)</div>
                {pending.unrespondedReminders.slice(0,3).map(a => <div key={a.id} className="dash-row" style={{padding:'4px 0'}}>
                  <span style={{fontSize:12,color:'var(--text-muted)',minWidth:44}}>{fTime(a.starts_at)}</span>
                  <div style={{flex:1,fontSize:13}}>{a.patients?.full_name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.professionals?.name}</div>
                </div>)}
              </div>}
            </>
          }
        </div>
      </div>

      <div>
        <div className="section-header"><span className="section-title">Listas y avisos</span></div>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div className="dash-row" style={{cursor:'pointer',padding:'14px'}} onClick={()=>onNav('espera')}>
            <span style={{fontSize:20}}>⏳</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>Lista de espera</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>esperan hueco más cercano</div>
            </div>
            <div style={{fontSize:20,fontWeight:900,color:'var(--green)'}}>{lists.waiting}</div>
          </div>
          <div className="dash-row" style={{cursor:'pointer',padding:'14px',borderTop:'1px solid var(--border)'}} onClick={()=>onNav('espera')}>
            <span style={{fontSize:20}}>⏫</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>Lista de adelantar</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>quieren venir antes</div>
            </div>
            <div style={{fontSize:20,fontWeight:900,color:'var(--green)'}}>{lists.expedite}</div>
          </div>
          {lists.overdue > 0 && <div className="dash-row" style={{cursor:'pointer',padding:'14px',borderTop:'1px solid var(--border)',background:'#fef3c7'}} onClick={()=>onNav('espera')}>
            <span style={{fontSize:20}}>🔴</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400e'}}>Pacientes con plazo vencido</div>
              <div style={{fontSize:11,color:'#92400e'}}>llevan más semanas de las pautadas</div>
            </div>
            <div style={{fontSize:20,fontWeight:900,color:'#dc2626'}}>{lists.overdue}</div>
          </div>}
          {totalListItems === 0 && <div style={{padding:24,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Listas vacías</div>}
        </div>
      </div>
    </div>

    {/* Fila 3: Citas mañana por profesional */}
    <div className="section-header" style={{marginTop:24}}>
      <span className="section-title">Agenda de mañana</span>
    </div>
    <div className="dash-grid" style={{gridTemplateColumns:`repeat(${Math.max(tomorrowByProf.length,1)},1fr)`}}>
      {tomorrowByProf.length === 0
        ? <div className="card"><Em icon="📅" title="Sin profesionales activos"/></div>
        : tomorrowByProf.map(({prof, appts}) => (
          <div key={prof.id}>
            <div className="card" style={{overflow:'hidden'}}>
              <div style={{padding:'10px 14px',borderBottom:'1.5px solid var(--border)',background:'var(--cream)',fontWeight:700,fontSize:13}}>
                {prof.name} <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:11}}>· {appts.length} cita{appts.length!==1?'s':''}</span>
              </div>
              {appts.length === 0
                ? <div style={{padding:24,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Sin citas mañana</div>
                : appts.map(a => <div key={a.id} className="dash-row" style={{padding:'10px 14px'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--green)',minWidth:44}}>{fTime(a.starts_at)}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.patients?.full_name||'—'}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.services?.name||''}</div>
                  </div>
                  <Bg variant={STATUS_CLS[a.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[a.status]||a.status}</Bg>
                </div>)
              }
            </div>
          </div>
        ))
      }
    </div>

    {/* Fila 4: Resumen del mes */}
    <div className="section-header" style={{marginTop:24}}>
      <span className="section-title">Este mes</span>
    </div>
    <div className="stats-grid">
      <div className="card stat-card">
        <div className="stat-label">Completadas</div>
        <div className="stat-value">{monthly.completed}</div>
        <div className="stat-sub">citas atendidas</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Cancelaciones</div>
        <div className="stat-value">{monthly.cancelled}</div>
        <div className="stat-sub">{monthly.completed+monthly.cancelled>0?`${Math.round(monthly.cancelled/(monthly.completed+monthly.cancelled)*100)}% del total`:'—'}</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Ingresos estimados</div>
        <div className="stat-value">{monthly.revenue.toLocaleString('es-ES')} €</div>
        <div className="stat-sub">basado en precio del servicio</div>
      </div>
    </div>
  </>
}

// ─── Agenda ───────────────────────────────────────────────────────────────────
const SLOT_H=60
function durToH(m){return(m/60)*SLOT_H}

function Agenda(){
  const[weekRef,setWeekRef]=useState(new Date())
  const[appointments,setAppts]=useState([])
  const[blocks,setBlocks]=useState([])
  const[breaks,setBreaks]=useState([])
  const[blockedDays,setBlockedDays]=useState([]) // [{professional_id, date}]
  const[patQ,setPatQ]=useState('')
  const[patMatches,setPatMatches]=useState([]) // [{full_name, appts:[{id,starts_at}]}]
  const[patOpen,setPatOpen]=useState(false)
  const[profs,setProfs]=useState([])
  const[services,setServices]=useState([])
  const[heldApptIds,setHeldApptIds]=useState(new Set())
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[blockModal,setBlockModal]=useState(null) // {mode:'create'|'view', professional_id, date, start, end, reason, id?}
  const[cancelConfirm,setCancelConfirm]=useState(false)
  const[assignModal,setAssignModal]=useState(null) // {appointment, candidates: []}
  const[assignTab,setAssignTab]=useState('waiting') // 'waiting' | 'expedite'
  const[patSearch,setPatSearch]=useState('')
  const[patResults,setPatResults]=useState([])
  const[selPat,setSelPat]=useState(null)
  const[form,setForm]=useState({prof_id:'',svc_id:'',date:'',time:'',notes:'',payment_method:'',leave_pending:true})
  const[editNotes,setEditNotes]=useState('')
  const[editProfId,setEditProfId]=useState('')
  const[editPayment,setEditPayment]=useState('')
  const[followupWeeks,setFollowupWeeks]=useState('')
  const[followupHour,setFollowupHour]=useState('any')
  const[followupBusy,setFollowupBusy]=useState(false)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  const[drag,setDrag]=useState(null) // {di, startMin, endMin, startY, moved}
  const gridRef=useRef(null)
  // Filters
  const[filterProf,setFilterProf]=useState('all')  // 'all' | professional_id
  const[hourFrom,setHourFrom]=useState(()=>Number(localStorage.getItem('ag_from')??8))
  const[hourTo,setHourTo]=useState(()=>Number(localStorage.getItem('ag_to')??20))

  const days=getWeekDays(weekRef)

  const load=useCallback(async()=>{
    setLoading(true)
    const from=toK(days[0])+'T00:00:00', to=toK(days[days.length-1])+'T23:59:59'
    const[appts,profsR,blks,holdsR]=await Promise.all([
      sb.from('appointments').select('id,starts_at,ends_at,status,professional_id,notes,payment_method,reminder_sent_at,proposed_until,patients(id,full_name),services(name,duration_minutes),professionals(name)')
        .gte('starts_at',from).lte('starts_at',to),
      sb.from('professionals').select('id,name').eq('is_active',true).eq('section','osteopathy').order('name',{ascending:false}),
      sb.from('blocked_slots').select('id,professional_id,starts_at,ends_at,reason')
        .gte('starts_at',from).lte('starts_at',to),
      sb.from('cancellation_holds').select('appointment_id').is('current_offer_id',null),
    ])
    setAppts(appts.data||[])
    setBlocks(blks.data||[])
    setHeldApptIds(new Set((holdsR.data||[]).map(h=>h.appointment_id)))
    // Breaks y blocked_days en queries separadas para no bloquear el load si fallan
    sb.from('recurring_breaks').select('professional_id,day_of_week,start_time,end_time')
      .then(({data})=>setBreaks(data||[])).catch(()=>{})
    sb.from('blocked_days').select('professional_id,date')
      .gte('date', toK(days[0])).lte('date', toK(days[days.length-1]))
      .then(({data})=>setBlockedDays(data||[])).catch(()=>{})
    const ps=profsR.data||[]
    setProfs(ps)
    setFilterProf(prev=>prev==='all'&&ps.length>0?ps[0].id:prev)
    setLoading(false)
  },[weekRef]) // eslint-disable-line

  useEffect(()=>{load()},[load])
  useEffect(()=>{sb.from('services').select('id,name,duration_minutes,professional_id').eq('is_active',true).eq('section','osteopathy').order('duration_minutes',{ascending:false}).then(({data})=>setServices(data||[]))},[])

  // Auto-seleccionar primera fecha libre al cambiar profesional
  useEffect(()=>{
    if(!form.prof_id)return
    const find=async()=>{
      const today=new Date()
      const fromD=toK(today), toD=toK(new Date(today.getTime()+60*86400000))
      const[{data:wh},{data:bd}]=await Promise.all([
        sb.from('working_hours').select('day_of_week').eq('professional_id',form.prof_id),
        sb.from('blocked_days').select('date').eq('professional_id',form.prof_id).gte('date',fromD).lte('date',toD),
      ])
      const workDOW=new Set((wh||[]).map(r=>r.day_of_week))
      const blocked=new Set((bd||[]).map(r=>r.date))
      for(let i=1;i<=60;i++){
        const d=new Date(today); d.setDate(today.getDate()+i)
        const ds=toK(d)
        if(workDOW.has(d.getDay())&&!blocked.has(ds)){setForm(f=>({...f,date:ds}));return}
      }
    }
    find()
  },[form.prof_id]) // eslint-disable-line

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
      const isPast = modal.starts_at && new Date(modal.starts_at.slice(0,19)) < new Date()
      setEditPayment(modal.payment_method || (isPast ? 'efectivo' : ''))
      setFollowupWeeks(''); setFollowupHour('any')
    }
  },[modal])

  // Cualquier cambio de estado guarda también método de pago, notas y profesional asignado.
  // Antes solo se actualizaba `status`, lo que perdía el método de pago si el usuario lo
  // seleccionaba y pulsaba "Completada" sin pasar por "Guardar cambios".
  const updateStatus=async(status)=>{
    const updates = {
      status,
      payment_method:editPayment||null,
      notes:editNotes||null,
      professional_id:editProfId||modal.professional_id,
    }
    if (status === 'confirmed') updates.proposed_until = null
    const{error}=await sb.from('appointments').update(updates).eq('id',modal.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:STATUS_TXT[status]+' correctamente',type:'ok'})
    setModal(null); load()
  }

  const markReminderSent=async()=>{
    // Pone reminder_sent_at = now - 3h para que pase a verde oscuro inmediatamente
    const ts = new Date(Date.now() - 3*60*60*1000).toISOString().slice(0,19)
    const{error}=await sb.from('appointments').update({reminder_sent_at:ts}).eq('id',modal.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Recordatorio marcado',type:'ok'})
    setModal(null); load()
  }

  const assignFollowup = async () => {
    const weeks = parseInt(followupWeeks)
    if (!weeks) { setToast({msg:'Indica las semanas',type:'error'}); return }
    const hour = followupHour === 'any' ? null : parseInt(followupHour)
    setFollowupBusy(true)
    const targetDate = new Date(Date.now() + weeks*7*24*36e5).toISOString().slice(0,10)
    const{data:search,error}=await sb.from('pending_searches').insert({
      patient_id: modal.patients.id,
      professional_id: modal.professional_id,
      service_id: modal.service_id || (await sb.from('appointments').select('service_id').eq('id',modal.id).maybeSingle()).data?.service_id,
      source_appointment_id: modal.id,
      target_date: targetDate,
      preferred_hour: hour,
      weeks_pautadas: weeks,
    }).select('id').single()
    if(error){setFollowupBusy(false);setToast({msg:'Error: '+error.message,type:'error'});return}
    // Disparar al bot inmediatamente; el cron seguirá como respaldo si el bot está caído.
    try {
      await fetch('http://localhost:3002/trigger-followup-search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ search_id: search.id })
      })
    } catch(e) { console.warn('trigger-followup-search fail:', e.message) }
    setFollowupBusy(false)
    setToast({msg:'Listo. El paciente recibirá el WhatsApp en unos segundos.',type:'ok'})
    setModal(null)
  }

  const openAssignModal = async (appt) => {
    // Cargar primeras 10 filas de wait_queue de ese profesional, ordenadas por queue_type (waiting primero) + priority
    const { data: rows } = await sb.from('wait_queue')
      .select('id,queue_type,priority_order,target_date,preferred_hour,fallback_appointment_id,patient_id,patients(id,full_name,phone),services(name,duration_minutes)')
      .eq('professional_id', appt.professional_id)
      .order('queue_type', { ascending: false })  // 'waiting' < 'expedite' alphabetically — invertir
      .order('priority_order', { ascending: true })
      .limit(20)

    // Cargar fallbacks para ver fecha actual del paciente
    const fbIds = (rows||[]).filter(r=>r.fallback_appointment_id).map(r=>r.fallback_appointment_id)
    let fbMap = {}
    if (fbIds.length) {
      const { data: fb } = await sb.from('appointments').select('id,starts_at').in('id', fbIds)
      fbMap = Object.fromEntries((fb||[]).map(f=>[f.id, f.starts_at]))
    }

    // Cargar el suggested del cancellation_holds
    const { data: hold } = await sb.from('cancellation_holds')
      .select('suggested_wait_queue_id')
      .eq('appointment_id', appt.id)
      .maybeSingle()

    const huecoStart = appt.starts_at
    const huecoHour = parseInt(huecoStart.slice(11,13))
    const huecoDate = huecoStart.slice(0,10)

    const candidates = (rows || []).map(r => {
      const fbDate = fbMap[r.fallback_appointment_id] || null
      const beforeFallback = !fbDate || huecoStart < fbDate.slice(0, 19)
      const afterTarget = !r.target_date || huecoDate >= r.target_date
      const hourMatches = r.preferred_hour == null || r.preferred_hour === huecoHour
      // Nada es bloqueante: la secretaria decide. Solo se muestran avisos.
      return {
        ...r,
        beforeFallback,
        afterTarget,
        hourMatches,
        fallback_starts_at: fbDate,
        isSuggestion: hold?.suggested_wait_queue_id === r.id,
      }
    })

    // Ordenar: sugerencia primero, luego los que cumplen todo, después los que cumplen menos.
    const score = c => (c.isSuggestion?1000:0) + (c.beforeFallback?100:0) + (c.afterTarget?10:0) + (c.hourMatches?1:0)
    candidates.sort((a,b) => score(b) - score(a))

    setAssignTab('waiting')
    setAssignModal({ appointment: appt, candidates })
  }

  const freeHole = async () => {
    const appt = assignModal.appointment
    const{error}=await sb.from('cancellation_holds').delete().eq('appointment_id', appt.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setAssignModal(null); setToast({msg:'Hueco liberado — disponible para cualquier cita',type:'ok'}); load()
  }

  const confirmAssignToWL = async (candidate) => {
    const appt = assignModal.appointment
    // 1. Crear nueva fila pending para el paciente WL
    const proposedUntil = localDT(new Date(Date.now() + 36*60*60*1000))
    const pid = candidate.patient_id || candidate.patients?.id
    if (!pid) { setToast({msg:'Error: paciente sin id',type:'error'}); return }
    const { data: newAppt, error: insertErr } = await sb.from('appointments').insert({
      patient_id: pid,
      professional_id: appt.professional_id,
      service_id: appt.service_id || candidate.service_id,
      starts_at: appt.starts_at,
      ends_at: appt.ends_at,
      status: 'pending',
      proposed_until: proposedUntil,
      notes: 'Asignación desde lista (cancelación)',
    }).select('id').single()
    if (insertErr) { setToast({msg:'Error: '+insertErr.message,type:'error'}); return }

    // 2. Marcar hold con current_offer_id
    await sb.from('cancellation_holds')
      .update({ current_offer_id: newAppt.id })
      .eq('appointment_id', appt.id)

    // 3. Notificar al paciente por WhatsApp
    let waSent = false
    try {
      const r = await fetch('http://localhost:3002/notify-wl-assignment', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ appointment_id: newAppt.id })
      })
      waSent = r.ok
      if (!r.ok) console.warn('notify-wl-assignment HTTP', r.status, await r.text())
    } catch(e) { console.warn('notify-wl-assignment fail:', e.message) }

    setAssignModal(null)
    setToast({msg: waSent ? 'Asignación creada. WhatsApp enviado al paciente.' : 'Asignación creada. ⚠️ WhatsApp no enviado (bot apagado?)', type: waSent ? 'ok' : 'error'})
    load()
  }

  const saveApptChanges=async()=>{
    setSaving(true)
    const{error}=await sb.from('appointments').update({notes:editNotes||null,professional_id:editProfId||modal.professional_id,payment_method:editPayment||null}).eq('id',modal.id)
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Cita actualizada',type:'ok'}); setModal(null); load()
  }

  const moveToList = async (queueType) => {
    // Cargar service_id si modal no lo tiene directamente
    let serviceId = modal.service_id
    if (!serviceId) {
      const { data } = await sb.from('appointments').select('service_id').eq('id', modal.id).maybeSingle()
      serviceId = data?.service_id
    }
    if (!serviceId) { setToast({msg:'No pude leer el servicio',type:'error'}); return }
    // Calcular priority_order = max + 1 en esa cola
    const { data: max } = await sb.from('wait_queue').select('priority_order').eq('queue_type', queueType).order('priority_order',{ascending:false}).limit(1).maybeSingle()
    const newPrio = (max?.priority_order || 0) + 1
    // Hora preferida: NULL (= cualquiera) por defecto. Si el paciente quiere
    // un horario concreto se edita luego; no asumimos que la hora de su cita
    // actual sea su preferencia.
    const{error}=await sb.from('wait_queue').insert({
      queue_type: queueType,
      patient_id: modal.patients.id,
      professional_id: modal.professional_id,
      service_id: serviceId,
      priority_order: newPrio,
      target_date: null,
      preferred_hour: null,
      fallback_appointment_id: modal.id,
    })
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:`Añadido a ${queueType==='waiting'?'lista de espera':'lista de adelantar'}`,type:'ok'})
    setModal(null)
  }

  const cancelAppt=async(id)=>{
    // Pending: DELETE. Confirmed: UPDATE + insertar hold (manual mode notifica desde el bot al recibir webhook;
    // aquí solo escribimos el hold y ya, la secretaria misma recibirá el WhatsApp del bot vía un trigger en el handler de eventos
    // pero como no hay WhatsApp del lado del admin React, la notificación vendrá por la vía del bot al detectar el cambio en BD.
    // Para evitar duplicados, NO notificamos desde aquí. El bot scheduler/listener detectará).
    const cur = modal
    if (cur.status === 'pending') {
      const{error}=await sb.from('appointments').delete().eq('id',id)
      if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
      setModal(null); setToast({msg:'Propuesta eliminada',type:'ok'}); load()
      return
    }
    if (cur.status === 'confirmed') {
      const{error}=await sb.from('appointments').update({status:'cancelled',cancelled_by:'secretary',cancelled_at:localDT(new Date())}).eq('id',id)
      if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
      // Insertar el hold desde aquí: la secretaria es la que cancela, así que necesitamos crear el hold manualmente.
      // hold_until según urgencia
      const startsAt = new Date(cur.starts_at.slice(0, 19))
      const hoursAhead = (startsAt - new Date()) / 36e5
      let holdType, holdUntil
      if (hoursAhead > 72)      { holdType = 'normal';     holdUntil = null }
      else if (hoursAhead > 24) { holdType = 'urgent_72h'; holdUntil = new Date(Date.now() + 4*60*60*1000).toISOString() }
      else                       { holdType = 'urgent_24h'; holdUntil = new Date(Date.now() + 1*60*60*1000).toISOString() }
      await sb.from('cancellation_holds').insert({
        appointment_id: id,
        hold_until: holdUntil,
        hold_type: holdType,
        notified_secretary: true,  // ya está aquí mirándolo
      })
      setModal(null); setToast({msg:'Cita cancelada — retenida para lista de espera',type:'ok'}); load()
      return
    }
    setToast({msg:'Esa cita no se puede cancelar',type:'error'})
  }

  const createAppt=async()=>{
    if(!selPat||!form.prof_id||!form.svc_id||!form.date||!form.time)return
    const svc=services.find(s=>s.id===form.svc_id)
    const dur=svc?.duration_minutes||60
    const startDT=new Date(`${form.date}T${form.time}:00`)
    const endDT=new Date(startDT.getTime()+dur*60000)
    // Blocked day check
    const{data:blk}=await sb.from('blocked_days').select('id').eq('professional_id',form.prof_id).eq('date',form.date).maybeSingle()
    if(blk){setToast({msg:'Ese día está bloqueado para este profesional.',type:'error'});return}
    // Overlap check
    const{data:overlap}=await sb.from('appointments').select('id')
      .eq('professional_id',form.prof_id).neq('status','cancelled')
      .gte('starts_at',localDT(startDT)).lt('starts_at',localDT(endDT))
    if(overlap?.length){setToast({msg:'El profesional ya tiene una cita en ese horario.',type:'error'});return}
    const status = form.leave_pending ? 'pending' : 'confirmed'
    const proposedUntil = form.leave_pending
      ? localDT(new Date(Date.now() + 36 * 60 * 60 * 1000))
      : null
    const{data:newAppt,error}=await sb.from('appointments').insert({
      patient_id:selPat.id,professional_id:form.prof_id,service_id:form.svc_id,
      starts_at:localDT(startDT),ends_at:localDT(endDT),notes:form.notes||null,
      payment_method:form.payment_method||null,
      status,
      proposed_until: proposedUntil,
    }).select('id').single()
    if(error){setToast({msg:error.message,type:'error'});return}
    setModal(null);setSelPat(null);setPatSearch('');setForm({prof_id:'',svc_id:'',date:'',time:'',notes:'',payment_method:'',leave_pending:true})
    // Si se dejó en pending, notificar al paciente por WhatsApp
    if(status==='pending' && newAppt?.id){
      try{
        const r=await fetch('http://localhost:3002/notify-pending-proposal',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({appointment_id:newAppt.id})
        })
        setToast({msg: r.ok ? 'Cita creada. WhatsApp enviado al paciente.' : 'Cita creada. ⚠️ WhatsApp no enviado (bot apagado?)',type:r.ok?'ok':'error'})
      }catch(e){
        setToast({msg:'Cita creada. ⚠️ Bot no disponible.',type:'error'})
      }
    } else {
      setToast({msg:'Cita creada',type:'ok'})
    }
    load()
  }

  // ── Drag-to-block / click-to-create ─────────────────────────────────────────
  // Convierte un clientY (px en pantalla) → minutos absolutos del día,
  // usando el primer .ag-time como ancla del minuto (hourFrom*60).
  const yToMinute=clientY=>{
    const grid=gridRef.current
    if(!grid)return null
    const anchor=grid.querySelector('.ag-time')
    if(!anchor)return null
    const top=anchor.getBoundingClientRect().top
    const totalMin=hourFrom*60+(clientY-top)
    const clamped=Math.max(hourFrom*60,Math.min(hourTo*60,totalMin))
    return Math.round(clamped/30)*30
  }

  const startDrag=(e,hi,di)=>{
    if(filterProf==='all'){setToast({msg:'Selecciona un profesional para crear o bloquear',type:'error'});return}
    if(e.button!==undefined&&e.button!==0)return
    if(e.target.closest('.appt-block')||e.target.closest('.block-card'))return
    e.preventDefault()
    const rect=e.currentTarget.getBoundingClientRect()
    const offsetY=Math.max(0,Math.min(rect.height,e.clientY-rect.top))
    const startMin=Math.round(((hourFrom+hi)*60+offsetY)/30)*30
    setDrag({di,startMin,endMin:startMin,startY:e.clientY,moved:false})
  }

  // Listeners globales mientras hay drag activo
  useEffect(()=>{
    if(!drag)return
    const onMove=ev=>{
      const min=yToMinute(ev.clientY)
      if(min==null)return
      setDrag(d=>{
        if(!d)return null
        const moved=d.moved||Math.abs(ev.clientY-d.startY)>5
        return{...d,endMin:min,moved}
      })
    }
    const onUp=()=>{
      setDrag(d=>{
        if(!d)return null
        const start=Math.min(d.startMin,d.endMin)
        const end=Math.max(d.startMin,d.endMin)
        const date=toK(days[d.di])
        const profId=filterProf!=='all'?filterProf:profs[0]?.id
        const profName=profs.find(p=>p.id===profId)?.name||''
        const fmt=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`
        if(!d.moved||end-start<15){
          // Click → crear cita pre-rellenada
          const defSvc=services.find(s=>s.duration_minutes===60)||services[0]
          setForm({prof_id:profId||'',svc_id:defSvc?.id||'',date,time:fmt(d.startMin),notes:'',payment_method:'',leave_pending:true})
          setSelPat(null);setPatSearch('')
          setModal('create')
        }else{
          // Drag → modal de bloqueo
          setBlockModal({mode:'create',professional_id:profId,professional_name:profName,date,start:fmt(start),end:fmt(end),reason:''})
        }
        return null
      })
    }
    document.addEventListener('pointermove',onMove)
    document.addEventListener('pointerup',onUp)
    return()=>{
      document.removeEventListener('pointermove',onMove)
      document.removeEventListener('pointerup',onUp)
    }
  },[drag,days,filterProf,profs,services,hourFrom,hourTo]) // eslint-disable-line

  const saveBlock=async()=>{
    if(!blockModal||blockModal.mode!=='create')return
    const startStr=`${blockModal.date}T${blockModal.start}:00`
    const endStr=`${blockModal.date}T${blockModal.end}:00`
    if(endStr<=startStr){setToast({msg:'La hora final debe ser posterior',type:'error'});return}
    const{error}=await sb.from('blocked_slots').insert({
      professional_id:blockModal.professional_id,
      starts_at:startStr,ends_at:endStr,
      reason:blockModal.reason||null,
    })
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setBlockModal(null);setToast({msg:'Horario bloqueado',type:'ok'});load()
  }

  const deleteBlock=async()=>{
    if(!blockModal||!blockModal.id)return
    const{error}=await sb.from('blocked_slots').delete().eq('id',blockModal.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setBlockModal(null);setToast({msg:'Bloqueo eliminado',type:'ok'});load()
  }

  const dayBlocks=date=>{
    const dk=toK(date)
    return blocks.filter(b=>{
      if(!b.starts_at?.startsWith(dk))return false
      if(filterProf!=='all'&&b.professional_id!==filterProf)return false
      return true
    })
  }

  const hours=Array.from({length:hourTo-hourFrom},(_,i)=>hourFrom+i)
  const today=toK(new Date())
  const weekStr=`${fD(days[0])} – ${fD(days[days.length-1])}`

  const apptColor=(a)=>{
    // a puede ser un objeto cita o solo un status
    const status = typeof a === 'string' ? a : a.status
    const reminderSentAt = typeof a === 'object' ? a.reminder_sent_at : null
    if(status==='pending')   return{bg:'#fed7aa',border:'#ea580c',text:'#7c2d12'}  // naranja
    if(status==='completed') return{bg:'#e0e7ff',border:'#6366f1',text:'#3730a3'}  // índigo
    if(status==='cancelled') return{bg:'#fee2e2',border:'#dc2626',text:'#7f1d1d'}  // rojo claro
    if(status==='confirmed') {
      if (reminderSentAt) {
        const sent = new Date(reminderSentAt.slice(0,19))
        const hours = (Date.now() - sent.getTime()) / 36e5
        if (hours >= 3) return {bg:'#a7f3d0',border:'#059669',text:'#064e3b'}  // verde oscuro
      }
      return{bg:'#d1fae5',border:'#10b981',text:'#065f46'}  // verde claro
    }
    return{bg:'#f1f5f9',border:'#94a3b8',text:'#64748b'}
  }

  const dayAppts=date=>{
    const dk=toK(date)
    return appointments.filter(a=>{
      if(!a.starts_at?.startsWith(dk)) return false
      if(filterProf!=='all' && a.professional_id!==filterProf) return false
      return true
    })
  }

  const timeToYLocal=t=>{if(!t)return 0;const[h,m]=t.split(':').map(Number);return(h-hourFrom+m/60)*SLOT_H}

  const HOUR_OPTIONS=Array.from({length:24},(_,i)=>i)

  const searchPatient = async (q) => {
    setPatQ(q)
    if (q.trim().length < 2) { setPatMatches([]); setPatOpen(false); return }
    const { data } = await sb.from('appointments')
      .select('starts_at, patients(id, full_name)')
      .ilike('patients.full_name', `%${q}%`)
      .neq('status', 'cancelled')
      .order('starts_at')
      .limit(50)
    if (!data?.length) { setPatMatches([]); setPatOpen(false); return }
    const map = {}
    for (const a of data) {
      const name = a.patients?.full_name
      if (!name) continue
      if (!map[name]) map[name] = []
      map[name].push(a.starts_at)
    }
    setPatMatches(Object.entries(map).map(([name, dates]) => ({ name, dates })))
    setPatOpen(true)
  }

  const goToAppt = (dateStr) => {
    const d = new Date(dateStr.slice(0,10)+'T12:00:00')
    setWeekRef(d)
    setPatQ(''); setPatMatches([]); setPatOpen(false)
  }

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div style={{position:'relative',marginBottom:12}}>
      <input className="field-input" placeholder="Buscar paciente…" value={patQ}
        onChange={e=>searchPatient(e.target.value)}
        onBlur={()=>setTimeout(()=>setPatOpen(false),200)}
        style={{width:'100%',paddingLeft:32}}/>
      <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}>🔍</span>
      {patOpen && patMatches.length>0 && <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,.1)',zIndex:100,maxHeight:320,overflowY:'auto'}}>
        {patMatches.map(({name, dates})=><div key={name} style={{borderBottom:'1px solid var(--border)'}}>
          <div style={{padding:'8px 12px',fontWeight:700,fontSize:13,color:'var(--text)',background:'var(--cream)',cursor:'pointer'}}
            onClick={()=>goToAppt(dates[0])}>
            {name} <span style={{fontSize:11,color:'var(--text-muted)',fontWeight:400}}>({dates.length} cita{dates.length!==1?'s':''})</span>
          </div>
          {dates.length>1 && dates.map((dt,i)=><div key={i} style={{padding:'5px 12px 5px 24px',fontSize:12,color:'var(--text-muted)',cursor:'pointer'}}
            onClick={()=>goToAppt(dt)}
            onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
            onMouseLeave={e=>e.currentTarget.style.background=''}>
            {new Date(dt.slice(0,10)+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short',year:'numeric'})} · {dt.slice(11,16)}
          </div>)}
        </div>)}
      </div>}
    </div>

    <div className="agenda-toolbar">
      <div className="agenda-toolbar-left">
        <span className="section-title">{weekStr}</span>
        <div className="tab-pills" style={{margin:0}}>
          {profs.map(p => (
            <button key={p.id} onClick={()=>setFilterProf(p.id)}
              className={`tab-pill${filterProf===p.id?' active':''}`}>{p.name}</button>
          ))}
        </div>
      </div>
      <div className="agenda-toolbar-right">
        <Btn variant="ghost" onClick={()=>setWeekRef(new Date(weekRef.getTime()-7*86400000))}>← Anterior</Btn>
        <Btn variant="ghost" onClick={()=>setWeekRef(new Date())}>Hoy</Btn>
        <Btn variant="ghost" onClick={()=>setWeekRef(new Date(weekRef.getTime()+7*86400000))}>Siguiente →</Btn>
        <Btn onClick={()=>{const defSvc=services.find(s=>s.duration_minutes===60)||services[0];const defProf=filterProf!=='all'?filterProf:(profs[0]?.id||'');setForm({prof_id:defProf,svc_id:defSvc?.id||'',date:'',time:'',notes:'',payment_method:'',leave_pending:true});setModal('create')}}>+ Cita</Btn>
      </div>
    </div>

    {/* Hour range filter */}
    <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Desde</span>
        <select className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:13,minHeight:36}}
          value={hourFrom} onChange={e=>{const v=Number(e.target.value);setHourFrom(v);localStorage.setItem('ag_from',v)}}>
          {HOUR_OPTIONS.filter(h=>h<hourTo).map(h=><option key={h}value={h}>{pad(h)}:00</option>)}
        </select>
        <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>Hasta</span>
        <select className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:13,minHeight:36}}
          value={hourTo} onChange={e=>{const v=Number(e.target.value);setHourTo(v);localStorage.setItem('ag_to',v)}}>
          {HOUR_OPTIONS.filter(h=>h>hourFrom).map(h=><option key={h}value={h}>{pad(h)}:00</option>)}
        </select>
      </div>
    </div>

    {loading?<Sp/>:<div className="agenda-scroll">
      <div ref={gridRef} className="agenda-grid"style={{gridTemplateColumns:`54px repeat(${days.length},1fr)`,userSelect:drag?'none':'auto'}}>
        <div className="ag-header time-col"style={{gridColumn:1,gridRow:1}}/>
        {days.map((d,i)=><div key={i}className={`ag-header ${toK(d)===today?'today':''}`}style={{gridColumn:i+2,gridRow:1}}>
          <div>{DAYS_ES[d.getDay()]}</div><div style={{fontSize:16,fontWeight:900}}>{d.getDate()}</div>
        </div>)}
        {hours.map((h,hi)=><React.Fragment key={`row-${h}`}>
          <div className="ag-time"style={{gridColumn:1,gridRow:hi+2}}>{pad(h)}:00</div>
          {days.map((d,di)=>{
            const da=hi===0?dayAppts(d):[]
            const bl=hi===0?dayBlocks(d):[]
            const showDrag=hi===0&&drag&&drag.di===di
            const dateKey=toK(d)
            const profId=filterProf!=='all'?filterProf:null
            const isFullDayBlocked = blockedDays.some(bd => bd.date===dateKey && (!profId || bd.professional_id===profId))
            return<div key={`c-${h}-${di}`}className="ag-col"style={{gridColumn:di+2,gridRow:hi+2,cursor:filterProf!=='all'&&!isFullDayBlocked?'crosshair':'default',touchAction:'none'}}
              onPointerDown={e=>!isFullDayBlocked&&startDrag(e,hi,di)}>
              {hi===0&&isFullDayBlocked&&<div style={{position:'absolute',top:0,height:(hourTo-hourFrom)*SLOT_H,left:0,right:0,background:'repeating-linear-gradient(45deg,#fee2e2,#fee2e2 8px,#fecaca 8px,#fecaca 16px)',border:'1px solid #dc2626',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#7f1d1d',zIndex:3,pointerEvents:'none'}}>🚫 Día bloqueado</div>}
              {bl.map(b=>{
                const[sh,sm]=b.starts_at.slice(11,16).split(':').map(Number)
                const[eh,em]=b.ends_at.slice(11,16).split(':').map(Number)
                const startMin=sh*60+sm,endMin=eh*60+em
                return<div key={b.id}className="block-card"
                  onClick={ev=>{ev.stopPropagation();setBlockModal({mode:'view',id:b.id,professional_id:b.professional_id,date:b.starts_at.slice(0,10),start:b.starts_at.slice(11,16),end:b.ends_at.slice(11,16),reason:b.reason||''})}}
                  style={{position:'absolute',top:Math.max(0,startMin-hourFrom*60),height:Math.max(18,endMin-startMin-2),left:2,right:2,background:'repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 6px,#d1d5db 6px,#d1d5db 12px)',border:'1px solid #9ca3af',borderRadius:4,cursor:'pointer',zIndex:2,padding:'2px 6px',fontSize:10,color:'#4b5563',fontWeight:700,overflow:'hidden'}}>
                  🚫 Bloqueado{b.reason?` · ${b.reason}`:''}
                </div>
              })}
              {hi===0&&(()=>{
                const dow=d.getDay()
                const profId=filterProf!=='all'?filterProf:null
                return breaks.filter(br=>br.start_time&&br.end_time&&br.day_of_week===dow&&(!profId||br.professional_id===profId)).map((br,i)=>{
                  const[sh,sm]=br.start_time.slice(0,5).split(':').map(Number)
                  const[eh,em]=br.end_time.slice(0,5).split(':').map(Number)
                  const startMin=sh*60+sm,endMin=eh*60+em
                  return<div key={`br-${br.professional_id}-${i}`}style={{position:'absolute',top:Math.max(0,startMin-hourFrom*60),height:Math.max(18,endMin-startMin-2),left:2,right:2,background:'#f3f4f6',border:'1px solid #d1d5db',borderRadius:4,zIndex:1,padding:'2px 6px',fontSize:10,color:'#9ca3af',fontWeight:600,overflow:'hidden',pointerEvents:'none'}}>
                    Descanso
                  </div>
                })
              })()}
              {da.map(a=>{
                const isCancelled = a.status === 'cancelled'
                if (isCancelled && !heldApptIds.has(a.id)) return null
                const t=a.starts_at?.slice(11,16)||'08:00'
                const et=a.ends_at?.slice(11,16)
                const dur=et?(new Date('2000-01-01T'+et)-new Date('2000-01-01T'+t))/60000:60
                const c=apptColor(a)
                const cancelledStyle = isCancelled ? {
                  background: 'repeating-linear-gradient(45deg, #fee2e2, #fee2e2 6px, #fecaca 6px, #fecaca 12px)',
                  borderLeft: '3px solid #dc2626',
                  color: '#7f1d1d',
                } : {
                  background: c.bg,
                  borderLeft: `3px solid ${c.border}`,
                  color: c.text,
                }
                return<div key={a.id} className={`appt-block${isCancelled ? ' cancelled' : ''}`}
                  onClick={ev=>{ev.stopPropagation(); a.status==='cancelled' ? openAssignModal(a) : setModal(a)}}
                  style={{top:timeToYLocal(t),height:Math.max(durToH(dur)-2,18),...cancelledStyle}}>
                  <div style={{fontWeight:700,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                    {isCancelled ? `🚫 ${t} Vacante WL` : `${t} ${a.patients?.full_name||''}`}
                  </div>
                  <div style={{fontSize:9,opacity:.8,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                    {isCancelled ? a.patients?.full_name : a.services?.name}
                    {filterProf==='all'&&a.professionals?.name?` · ${a.professionals.name}`:''}
                  </div>
                </div>
              })}
              {showDrag&&(()=>{
                const s=Math.min(drag.startMin,drag.endMin),e=Math.max(drag.startMin,drag.endMin)
                if(e-s<=0)return null
                return<div style={{position:'absolute',top:s-hourFrom*60,height:e-s,left:2,right:2,background:'rgba(192,132,79,0.22)',border:'2px dashed var(--terra,#c0844f)',borderRadius:6,pointerEvents:'none',zIndex:5}}/>
              })()}
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
      <Sel label="Profesional"value={form.prof_id}onChange={e=>setForm(f=>({...f,prof_id:e.target.value}))}options={[['','Seleccionar…'],...profs.map(p=>[p.id,p.name])]}/>
      <Sel label="Servicio"value={form.svc_id}onChange={e=>setForm(f=>({...f,svc_id:e.target.value}))}options={[['','Seleccionar…'],...services.filter(s=>!s.professional_id||s.professional_id===form.prof_id).map(s=>[s.id,`${s.name} (${s.duration_minutes}min)`])]}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Inp label="Fecha"type="date"value={form.date}onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
        <Sel label="Hora"value={form.time}onChange={e=>setForm(f=>({...f,time:e.target.value}))}options={[['','--:--'],...Array.from({length:(21-7)*2+2},(_,i)=>{const h=7+Math.floor(i/2),m=(i%2)*30;const v=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;return[v,v]}).filter(([v])=>v<='21:30')]}/>
      </div>
      <div className="field" style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <Toggle on={form.leave_pending} onChange={v=>setForm(f=>({...f,leave_pending:v}))}/>
        <label className="field-label" style={{marginBottom:0}}>
          Dejar pendiente de confirmación (naranja)
        </label>
      </div>
      <Sel label="Forma de pago (opcional)"value={form.payment_method}onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}options={[['','No especificada'],['efectivo','Efectivo'],['tarjeta','Tarjeta'],['bizum','Bizum'],['transferencia','Transferencia']]}/>
      <div className="field"><label className="field-label">Notas (opcional)</label><textarea className="notes-area"value={form.notes}onChange={e=>setForm(f=>({...f,notes:e.target.value}))}placeholder="Observaciones…"/></div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={createAppt}disabled={!selPat||!form.prof_id||!form.svc_id||!form.date||!form.time}style={{flex:1}}>Guardar</Btn>
      </div>
    </Modal>}

    {/* Detail modal */}
    {modal&&modal!=='create'&&<Modal title="Detalle de cita"onClose={()=>{setModal(null);setCancelConfirm(false)}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>PACIENTE</div><div style={{fontSize:14,fontWeight:700}}>{modal.patients?.full_name||'—'}</div></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>ESTADO</div><Bg variant={STATUS_CLS[modal.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[modal.status]||modal.status}</Bg></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>SERVICIO</div><div style={{fontSize:13}}>{modal.services?.name||'—'}</div></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>FECHA Y HORA</div><div style={{fontSize:13}}>{fDT(modal.starts_at)}</div></div>
      </div>

      {/* Reasignar profesional */}
      <div className="field">
        <label className="field-label">Profesional</label>
        <select className="field-input"value={editProfId}onChange={e=>setEditProfId(e.target.value)}>
          {profs.map(p=><option key={p.id}value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Forma de pago */}
      <div className="field">
        <label className="field-label">Forma de pago</label>
        <select className="field-input"value={editPayment}onChange={e=>setEditPayment(e.target.value)}>
          <option value="">No especificada</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="bizum">Bizum</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>

      {/* Notas editables */}
      <div className="field">
        <label className="field-label">Notas internas</label>
        <textarea className="notes-area"value={editNotes}onChange={e=>setEditNotes(e.target.value)}placeholder="Observaciones del profesional…"/>
      </div>

      {/* Próxima cita (follow-up) — solo si la cita es del pasado o completed */}
      {modal.status==='completed' || (modal.starts_at && modal.starts_at < localDT(new Date())) ? (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:14}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Próxima cita</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <Sel label="Semanas" value={followupWeeks} onChange={e=>setFollowupWeeks(e.target.value)}
              options={[['','—'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['8','8'],['10','10'],['12','12']]}/>
            <Sel label="Hora preferida" value={followupHour} onChange={e=>setFollowupHour(e.target.value)}
              options={[['any','Cualquiera'],['7','07:00'],['8','08:00'],['9','09:00'],['10','10:00'],['11','11:00'],['12','12:00'],['13','13:00'],['14','14:00']]}/>
          </div>
          <Btn onClick={assignFollowup} disabled={followupBusy||!followupWeeks} style={{width:'100%'}}>
            {followupBusy?'Buscando…':'Asignar próxima cita'}
          </Btn>
        </div>
      ) : null}

      {/* Mover a lista (waiting / expedite) */}
      {(modal.status==='pending'||modal.status==='confirmed') && new Date(modal.starts_at) > new Date() && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Mover a cola</div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="ghost" onClick={()=>moveToList('waiting')} style={{flex:1}}>→ Lista de espera</Btn>
            <Btn variant="ghost" onClick={()=>moveToList('expedite')} style={{flex:1}}>→ Lista de adelantar</Btn>
          </div>
        </div>
      )}

      {/* Acciones de estado */}
      {cancelConfirm
        ?<div style={{background:'var(--cream)',border:'1px solid var(--terra)',borderRadius:8,padding:'12px 14px',marginTop:8}}>
            <p style={{fontSize:13,color:'var(--ink)',marginBottom:12,fontWeight:600}}>¿Confirmar cancelación? Esta acción no se puede deshacer.</p>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost"onClick={()=>setCancelConfirm(false)}style={{flex:1}}>Volver</Btn>
              <Btn variant="danger"onClick={()=>{setCancelConfirm(false);cancelAppt(modal.id)}}style={{flex:1}}>Sí, cancelar cita</Btn>
            </div>
          </div>
        :<div className="appt-actions">
          {modal.status==='pending'&&<Btn variant="secondary"onClick={()=>updateStatus('confirmed')}style={{flex:1}}>✓ Confirmar</Btn>}
          {modal.status==='confirmed'&&!modal.reminder_sent_at&&<Btn variant="ghost"onClick={markReminderSent}style={{flex:1}}>📞 Recordatorio enviado</Btn>}
          {(modal.status==='confirmed'||modal.status==='pending')&&<Btn variant="gold"onClick={()=>updateStatus('completed')}style={{flex:1}}>✓ Completada</Btn>}
          {modal.status!=='cancelled'&&<Btn variant="danger"onClick={()=>setCancelConfirm(true)}style={{flex:1}}>Cancelar</Btn>}
        </div>
      }

      <div style={{display:'flex',gap:10,marginTop:10}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cerrar</Btn>
        <Btn onClick={saveApptChanges}disabled={saving}style={{flex:1}}>{saving?'Guardando…':'Guardar cambios'}</Btn>
      </div>
    </Modal>}

    {/* Block modal (crear o ver) */}
    {blockModal&&<Modal title={blockModal.mode==='create'?'Bloquear horario':'Horario bloqueado'}onClose={()=>setBlockModal(null)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>PROFESIONAL</div><div style={{fontSize:14,fontWeight:700}}>{blockModal.professional_name||profs.find(p=>p.id===blockModal.professional_id)?.name||'—'}</div></div>
        <div><div style={{fontSize:11,color:'var(--text-muted)',fontWeight:700,marginBottom:2}}>FECHA</div><div style={{fontSize:13}}>{fD(blockModal.date+'T12:00:00')}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Inp label="Desde"type="time"value={blockModal.start}step="900"
          onChange={e=>setBlockModal(m=>({...m,start:e.target.value}))}
          disabled={blockModal.mode==='view'}/>
        <Inp label="Hasta"type="time"value={blockModal.end}step="900"
          onChange={e=>setBlockModal(m=>({...m,end:e.target.value}))}
          disabled={blockModal.mode==='view'}/>
      </div>
      <div className="field"><label className="field-label">Motivo (opcional)</label>
        <input className="field-input"value={blockModal.reason}placeholder="Comida, formación, ausencia…"
          onChange={e=>setBlockModal(m=>({...m,reason:e.target.value}))}
          disabled={blockModal.mode==='view'}/>
      </div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost"onClick={()=>setBlockModal(null)}style={{flex:1}}>Cerrar</Btn>
        {blockModal.mode==='create'
          ?<Btn onClick={saveBlock}style={{flex:1}}>Bloquear</Btn>
          :<Btn variant="danger"onClick={deleteBlock}style={{flex:1}}>Eliminar bloqueo</Btn>}
      </div>
    </Modal>}

    {assignModal && (() => {
      const waitCount = assignModal.candidates.filter(c=>c.queue_type==='waiting').length
      const expedCount = assignModal.candidates.filter(c=>c.queue_type==='expedite').length
      const visible = assignModal.candidates.filter(c=>c.queue_type===assignTab)
      return <Modal title="Asignar hueco vacante" onClose={()=>setAssignModal(null)}>
      <div style={{marginBottom:12,fontSize:13,color:'var(--text-muted)'}}>
        Hueco del <strong>{fDT(assignModal.appointment.starts_at)}</strong>. Selecciona paciente de la cola:
      </div>
      <div className="tab-pills" style={{margin:'0 0 12px 0'}}>
        <button className={`tab-pill${assignTab==='waiting'?' active':''}`} onClick={()=>setAssignTab('waiting')}>Espera ({waitCount})</button>
        <button className={`tab-pill${assignTab==='expedite'?' active':''}`} onClick={()=>setAssignTab('expedite')}>Adelantar ({expedCount})</button>
      </div>
      <div style={{maxHeight:400,overflowY:'auto'}}>
        {visible.length === 0
          ? <Em icon="📭" title={assignTab==='waiting'?'Lista de espera vacía':'Lista de adelantar vacía'}/>
          : visible.map(c => {
            const allMatch = c.beforeFallback && c.afterTarget && c.hourMatches
            const someMismatch = !allMatch
            // Verde si todo encaja, amarillo si hay algún aviso. Nunca se bloquea.
            const bg = c.isSuggestion ? '#fef3c7' : allMatch ? '#ecfdf5' : '#fefce8'
            const border = c.isSuggestion ? '#f59e0b' : allMatch ? '#10b981' : '#eab308'
            return (
              <div key={c.id} style={{
                padding:'10px 12px',marginBottom:8,
                background:bg,
                border:`1px solid ${border}`,
                borderRadius:6,
                cursor:'pointer',
                display:'flex',alignItems:'center',gap:10
              }}
              onClick={()=>confirmAssignToWL(c)}>
                {c.isSuggestion && <span style={{fontSize:18}}>✨</span>}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>
                    #{c.priority_order} ({c.queue_type==='waiting'?'Espera':'Adelantar'}) · {c.patients?.full_name}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>
                    {c.fallback_starts_at ? `Cita actual: ${fDT(c.fallback_starts_at)}` : 'Sin cita asignada'} ·
                    Hora preferida: {c.preferred_hour != null ? `${pad(c.preferred_hour)}:00` : 'Cualquiera'}
                  </div>
                  {someMismatch && <div style={{fontSize:10,color:'#a16207',marginTop:2,fontWeight:600}}>
                    ⚠ {!c.beforeFallback && 'Posterior a su cita actual. '}
                    {!c.afterTarget && 'Antes de la fecha pautada. '}
                    {!c.hourMatches && `Hora preferida: ${pad(c.preferred_hour)}:00. `}
                    Puedes asignarlo igualmente.
                  </div>}
                </div>
              </div>
            )
          })
        }
      </div>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <Btn variant="danger" onClick={freeHole} style={{flex:1}}>Liberar hueco</Btn>
        <Btn variant="ghost" onClick={()=>setAssignModal(null)} style={{flex:1}}>Cerrar</Btn>
      </div>
    </Modal>
    })()}
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
  const[waPhone,setWaPhone]=useState('')
  const[agendaTime,setAgendaTime]=useState('')
  const[reminderTime,setReminderTime]=useState('10:00')
  const[savingReminder,setSavingReminder]=useState(false)

  useEffect(()=>{
    sb.from('app_config').select('value').eq('key','reminder_time').maybeSingle()
      .then(({data})=>{ if(data?.value) setReminderTime(data.value) })
  },[])

  const saveReminderTime = async () => {
    setSavingReminder(true)
    const{error}=await sb.from('app_config')
      .upsert({key:'reminder_time', value:reminderTime}, {onConflict:'key'})
    setSavingReminder(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:`Recordatorios a las ${reminderTime}`,type:'ok'})
  }
  const WORK_DAYS=[1,2,3,4,5,6]
  const DAY_NAMES=['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

  // Opciones de hora cada 15 min (06:00 → 22:00). Se usan en horarios de trabajo y descansos
  // para garantizar que solo se puedan elegir múltiplos de :00, :15, :30 o :45.
  const TIMES_15 = (() => {
    const arr = []
    for (let m = 6 * 60; m <= 22 * 60; m += 15) {
      arr.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
    }
    return arr
  })()

  useEffect(()=>{
    sb.from('professionals').select('id,name,slot_duration,whatsapp_phone,daily_agenda_time,max_half_hour_per_day').eq('is_active',true).eq('section','osteopathy').order('name')
      .then(({data})=>{setProfs(data||[]);if(data?.length)setSelProf(data[0])})
  },[])

  useEffect(()=>{
    if(!selProf)return
    setSlotDur(selProf.slot_duration||60)
    setWaPhone(selProf.whatsapp_phone||'')
    setAgendaTime(selProf.daily_agenda_time?.slice(0,5)||'')

    // Cargamos working_hours y recurring_breaks en paralelo, luego los fusionamos por día.
    Promise.all([
      sb.from('working_hours').select('day_of_week,start_time,end_time').eq('professional_id',selProf.id),
      sb.from('recurring_breaks').select('id,day_of_week,start_time,end_time').eq('professional_id',selProf.id).order('day_of_week').order('start_time'),
    ]).then(([wh,br])=>{
      const breaksByDay={}
      for (const b of (br.data||[])) {
        // Solo conservamos UN descanso por día (el primero). Si hay más, se ignoran en UI pero permanecen en BD.
        if (!breaksByDay[b.day_of_week]) breaksByDay[b.day_of_week] = b
      }
      setRows(WORK_DAYS.map(d=>{
        const ex=wh.data?.find(r=>r.day_of_week===d)
        const br=breaksByDay[d]
        return ex?{
          day_of_week:d, active:true,
          start_time:ex.start_time?.slice(0,5)||'09:00',
          end_time:ex.end_time?.slice(0,5)||'18:00',
          break_id: br?.id || null,
          break_start: br?.start_time?.slice(0,5) || '',
          break_end: br?.end_time?.slice(0,5) || '',
        }:{
          day_of_week:d, active:false,
          start_time:'09:00', end_time:'18:00',
          break_id: br?.id || null,
          break_start: br?.start_time?.slice(0,5) || '',
          break_end: br?.end_time?.slice(0,5) || '',
        }
      }))
    })
  },[selProf])

  const saveProfNotifs=async()=>{
    const{error}=await sb.from('professionals').update({
      whatsapp_phone: waPhone || null,
      daily_agenda_time: agendaTime || null,
    }).eq('id', selProf.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Datos guardados',type:'ok'})
  }

  const save=async()=>{
    setSaving(true)
    for(const row of rows){
      if(row.active){
        await sb.from('working_hours').upsert(
          {professional_id:selProf.id,day_of_week:row.day_of_week,start_time:row.start_time,end_time:row.end_time},
          {onConflict:'professional_id,day_of_week'}
        )
      } else {
        await sb.from('working_hours').delete()
          .eq('professional_id',selProf.id).eq('day_of_week',row.day_of_week)
      }

      // Gestión del descanso del día
      const hasBreak = row.break_start && row.break_end && row.break_end > row.break_start
      if (hasBreak) {
        if (row.break_id) {
          await sb.from('recurring_breaks').update({
            start_time: row.break_start, end_time: row.break_end,
          }).eq('id', row.break_id)
        } else {
          await sb.from('recurring_breaks').insert({
            professional_id: selProf.id,
            day_of_week: row.day_of_week,
            start_time: row.break_start, end_time: row.break_end,
          })
        }
      } else if (row.break_id) {
        // Vaciaron los campos → borrar la fila existente
        await sb.from('recurring_breaks').delete().eq('id', row.break_id)
      }
    }
    try{await sb.from('professionals').update({slot_duration:slotDur}).eq('id',selProf.id)}catch{}
    setSaving(false); setToast({msg:'Horarios guardados',type:'ok'})
    // Recargar para refrescar break_ids tras inserts
    if (selProf) {
      const tmp = selProf
      setSelProf(null)
      setTimeout(() => setSelProf(tmp), 0)
    }
  }

  const upd=(idx,key,val)=>setRows(rs=>rs.map((r,i)=>i===idx?{...r,[key]:val}:r))

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}

    <div className="card" style={{padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
      <span style={{fontWeight:700,fontSize:13}}>Hora recordatorios D-1</span>
      <div className="field" style={{margin:0,flex:'0 0 auto'}}>
        <select className="field-input" style={{width:'auto'}} value={reminderTime} onChange={e=>setReminderTime(e.target.value)}>
          {Array.from({length:24*4},(_,i)=>{const h=Math.floor(i/4),m=(i%4)*15;const v=`${pad(h)}:${pad(m)}`;return<option key={v}value={v}>{v}</option>})}
        </select>
      </div>
      <Btn onClick={saveReminderTime} disabled={savingReminder}>{savingReminder?'Guardando…':'Guardar hora'}</Btn>
      <span style={{fontSize:11,color:'var(--text-muted)'}}>El bot manda WhatsApp a los pacientes del día siguiente a esta hora</span>
    </div>

    <div className="section-header">
      <span className="section-title">Horarios de trabajo</span>
      <Btn onClick={save}disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</Btn>
    </div>

    {profs.length>1&&<div className="tab-pills">{profs.map(p=><button key={p.id}className={`tab-pill ${selProf?.id===p.id?'active':''}`}onClick={()=>setSelProf(p)}>{p.name}</button>)}</div>}

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
      <div className="hours-grid" style={{borderBottom:'1.5px solid var(--border)',fontWeight:700,fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em'}}>
        <span>Día</span><span>Activo</span><span>Horario</span><span className="hours-break">Descanso (opcional)</span>
      </div>
      {rows.map((row,i)=><div key={row.day_of_week} className="hours-grid">
        <span style={{fontSize:13,fontWeight:700,color:row.active?'var(--text)':'var(--text-muted)'}}>{DAY_NAMES[row.day_of_week]}</span>
        <Toggle on={row.active}onChange={v=>upd(i,'active',v)}/>
        {row.active?<div style={{display:'flex',alignItems:'center',gap:6}}>
          <select className="field-input" style={{width:96,padding:'8px 10px'}} value={row.start_time} onChange={e=>upd(i,'start_time',e.target.value)}>
            {TIMES_15.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{color:'var(--muted)'}}>–</span>
          <select className="field-input" style={{width:96,padding:'8px 10px'}} value={row.end_time} onChange={e=>upd(i,'end_time',e.target.value)}>
            {TIMES_15.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>:<span style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>Día libre</span>}
        {row.active?<div className="hours-break" style={{display:'flex',alignItems:'center',gap:6}}>
          <select className="field-input" style={{width:96,padding:'8px 10px'}} value={row.break_start} onChange={e=>upd(i,'break_start',e.target.value)}>
            <option value="">—</option>
            {TIMES_15.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{color:'var(--muted)'}}>–</span>
          <select className="field-input" style={{width:96,padding:'8px 10px'}} value={row.break_end} onChange={e=>upd(i,'break_end',e.target.value)}>
            <option value="">—</option>
            {TIMES_15.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          {(row.break_start||row.break_end)&&<button onClick={()=>{upd(i,'break_start','');upd(i,'break_end','')}} title="Quitar descanso" style={{background:'transparent',border:0,cursor:'pointer',color:'var(--muted)',fontSize:16,padding:'4px 8px',borderRadius:6,minWidth:32,minHeight:32}}>✕</button>}
        </div>:<span className="hours-break" style={{fontSize:12,color:'var(--text-muted)'}}>—</span>}
      </div>)}
    </div>

    {/* Configuración WhatsApp y agenda diaria */}
    {selProf&&<div className="card"style={{padding:16,marginTop:16}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Notificaciones del profesional</div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:10}}>
        <Inp label="WhatsApp del profesional" placeholder="34612345678" value={waPhone} onChange={e=>setWaPhone(e.target.value)}/>
        <Inp label="Hora envío agenda" type="time" step="900" value={agendaTime} onChange={e=>setAgendaTime(e.target.value)}/>
      </div>
      <Btn onClick={saveProfNotifs}>Guardar</Btn>
    </div>}

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

  useEffect(()=>{sb.from('professionals').select('id,name').eq('is_active',true).eq('section','osteopathy').order('name')
    .then(({data})=>{setProfs(data||[]);if(data?.length)setSelProf(data[0])})},[])

  useEffect(()=>{
    if(!selProf)return
    const from=`${calYear}-${pad(calMonth+1)}-01`, to=`${calYear}-${pad(calMonth+1)}-${pad(new Date(calYear,calMonth+1,0).getDate())}`
    sb.from('blocked_days').select('date').eq('professional_id',selProf.id).gte('date',from).lte('date',to)
      .then(({data,error})=>{
        if(error){setToast({msg:'Error al cargar días: '+error.message,type:'error'});return}
        setBlocked((data||[]).map(r=>r.date))
      })
  },[selProf,calYear,calMonth])

  const toggle=async dateK=>{
    if(!selProf)return
    const targetProfs=blockAll?profs:[selProf]
    if(blocked.includes(dateK)){
      const errs=[]
      for(const p of targetProfs){
        const{error}=await sb.from('blocked_days').delete().eq('professional_id',p.id).eq('date',dateK)
        if(error) errs.push(error.message)
      }
      if(errs.length){setToast({msg:'Error: '+errs[0],type:'error'});return}
      setBlocked(b=>b.filter(d=>d!==dateK)); setToast({msg:'Día desbloqueado',type:'ok'})
    }else{
      const errs=[]
      for(const p of targetProfs){
        const{error}=await sb.from('blocked_days').insert({professional_id:p.id,date:dateK})
        if(error&&error.code!=='23505') errs.push(error.message)
      }
      if(errs.length){setToast({msg:'Error: '+errs[0],type:'error'});return}
      setBlocked(b=>[...b,dateK]); setToast({msg:blockAll?`Día bloqueado para todos (${targetProfs.length})`:'Día bloqueado',type:'ok'})
    }
  }

  const days=gMD(calYear,calMonth)
  const monthName=new Date(calYear,calMonth,1).toLocaleString('es-ES',{month:'long',year:'numeric'})

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header"><span className="section-title">Días bloqueados</span></div>

    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16,flexWrap:'wrap'}}>
      {profs.length>1&&<div className="tab-pills"style={{margin:0}}>{profs.map(p=><button key={p.id}className={`tab-pill ${selProf?.id===p.id?'active':''}`}onClick={()=>setSelProf(p)}>{p.name}</button>)}</div>}
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
  const[tab,setTab]=useState('waiting') // 'waiting' | 'expedite'
  const[loading,setLoading]=useState(true)
  const[rows,setRows]=useState([])
  const[fbMap,setFbMap]=useState({})
  const[toast,setToast]=useState(null)
  const[assignModal,setAssignModal]=useState(null) // {row, candidates: [{appt, fits}]}
  const[editModal,setEditModal]=useState(null) // {row}
  const[editForm,setEditForm]=useState({target_date:'',weeks_pautadas:'',preferred_hour:''})

  const load=useCallback(async()=>{
    setLoading(true)
    const{data}=await sb.from('wait_queue')
      .select('id,queue_type,priority_order,target_date,preferred_hour,weeks_pautadas,fallback_appointment_id,created_at,notes,patient_id,professional_id,service_id,patients(id,full_name,phone),services(name),professionals(name)')
      .eq('queue_type', tab)
      .order('priority_order',{ascending:true})
    const items = data||[]
    // Cargar fallbacks
    const fbIds = items.filter(r=>r.fallback_appointment_id).map(r=>r.fallback_appointment_id)
    let map = {}
    if (fbIds.length) {
      const{data:fb}=await sb.from('appointments').select('id,starts_at,status').in('id',fbIds)
      map = Object.fromEntries((fb||[]).map(f=>[f.id, f]))
    }
    setRows(items); setFbMap(map); setLoading(false)
  },[tab])
  useEffect(()=>{load()},[load])

  const moveUp = async (row, idx) => {
    if (idx === 0) return
    const above = rows[idx-1]
    // Swap priority_order
    await sb.from('wait_queue').update({priority_order: above.priority_order}).eq('id', row.id)
    await sb.from('wait_queue').update({priority_order: row.priority_order}).eq('id', above.id)
    load()
  }
  const moveDown = async (row, idx) => {
    if (idx === rows.length - 1) return
    const below = rows[idx+1]
    await sb.from('wait_queue').update({priority_order: below.priority_order}).eq('id', row.id)
    await sb.from('wait_queue').update({priority_order: row.priority_order}).eq('id', below.id)
    load()
  }
  const moveToOther = async (row) => {
    const other = row.queue_type === 'waiting' ? 'expedite' : 'waiting'
    const{data:max}=await sb.from('wait_queue').select('priority_order').eq('queue_type', other).order('priority_order',{ascending:false}).limit(1).maybeSingle()
    const newPrio = (max?.priority_order || 0) + 1
    await sb.from('wait_queue').update({queue_type: other, priority_order: newPrio}).eq('id', row.id)
    setToast({msg:`Movido a ${other==='waiting'?'lista de espera':'lista de adelantar'}`,type:'ok'}); load()
  }
  const remove = async (id) => {
    const{error}=await sb.from('wait_queue').delete().eq('id', id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Eliminado de la lista',type:'ok'}); load()
  }

  const openAssign = async (row) => {
    // Buscar huecos cancelled del profesional de la fila
    const fbStart = row.fallback_appointment_id ? fbMap[row.fallback_appointment_id]?.starts_at : null
    const minDate = row.target_date || new Date().toISOString().slice(0,10)
    const { data: cancelled } = await sb.from('appointments')
      .select('id,starts_at,ends_at,service_id')
      .eq('professional_id', row.professional_id)
      .eq('status', 'cancelled')
      .gte('starts_at', minDate + 'T00:00:00')
      .order('starts_at')
      .limit(15)
    const candidates = (cancelled || []).map(a => {
      const hour = parseInt(a.starts_at.slice(11,13))
      const beforeFb = !fbStart || a.starts_at < fbStart.slice(0, 19)
      const hourMatches = row.preferred_hour == null || row.preferred_hour === hour
      // Nada bloquea: solo avisos visuales.
      return { appt: a, beforeFb, hourMatches }
    })
    const score2 = c => (c.beforeFb?10:0) + (c.hourMatches?1:0)
    candidates.sort((a,b) => score2(b) - score2(a))
    setAssignModal({ row, candidates })
  }

  const confirmAssign = async (cancelledAppt) => {
    const row = assignModal.row
    const proposedUntil = new Date(Date.now() + 36*60*60*1000).toISOString().slice(0,19)
    // Crear nueva pending para el paciente WL en el mismo slot del cancelled
    const { data: newAppt, error } = await sb.from('appointments').insert({
      patient_id: row.patient_id,
      professional_id: row.professional_id,
      service_id: cancelledAppt.service_id || row.service_id,
      starts_at: cancelledAppt.starts_at,
      ends_at: cancelledAppt.ends_at,
      status: 'pending',
      proposed_until: proposedUntil,
      notes: 'Asignación manual desde lista',
    }).select('id').single()
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    // Marcar el hold con current_offer_id
    await sb.from('cancellation_holds').update({ current_offer_id: newAppt.id }).eq('appointment_id', cancelledAppt.id)
    // Disparar WhatsApp via endpoint del bot (Brecha 3)
    try {
      await fetch('http://localhost:3002/notify-wl-assignment', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ appointment_id: newAppt.id })
      })
    } catch(e) {
      console.warn('notify-wl-assignment fail:', e.message)
    }
    setAssignModal(null); setToast({msg:'Hueco asignado. Esperando confirmación del paciente.',type:'ok'}); load()
  }

  const openEdit = (row) => {
    setEditForm({
      target_date: row.target_date || '',
      weeks_pautadas: row.weeks_pautadas != null ? String(row.weeks_pautadas) : '',
      preferred_hour: row.preferred_hour != null ? String(row.preferred_hour) : '',
    })
    setEditModal(row)
  }

  const saveEdit = async () => {
    const payload = {
      target_date: editForm.target_date || null,
      weeks_pautadas: editForm.weeks_pautadas !== '' ? Number(editForm.weeks_pautadas) : null,
      preferred_hour: editForm.preferred_hour !== '' ? Number(editForm.preferred_hour) : null,
    }
    const{error}=await sb.from('wait_queue').update(payload).eq('id', editModal.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setEditModal(null); setToast({msg:'Actualizado',type:'ok'}); load()
  }

  // Fecha teórica ideal = created_at + weeks_pautadas*7, ajustada si cae en finde
  const fechaPautada = (row) => {
    if (row.weeks_pautadas == null) return null
    const d = new Date(new Date(row.created_at).getTime() + row.weeks_pautadas * 7 * 24 * 36e5)
    const dow = d.getDay()
    if (dow === 6) d.setDate(d.getDate() - 1) // sábado → viernes
    if (dow === 0) d.setDate(d.getDate() + 1) // domingo → lunes
    return d
  }

  // { untilAppt, untilDue } en semanas — untilDue puede ser negativo (ya va tarde)
  const weeksCalc = (row) => {
    const fb = fbMap[row.fallback_appointment_id]
    const untilAppt = fb ? (new Date(fb.starts_at) - Date.now()) / (7*24*36e5) : null
    const fp = fechaPautada(row)
    const untilDue = fp ? (fp - Date.now()) / (7*24*36e5) : null
    return { untilAppt, untilDue }
  }

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Listas</span>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <span style={{fontSize:11,color:'var(--text-muted)'}} title="Próximamente">Auto-asignación</span>
        <Toggle on={false} onChange={()=>setToast({msg:'Próximamente. Habilita tras validar el bot.',type:'ok'})}/>
      </div>
    </div>

    <div style={{display:'flex',gap:8,marginBottom:16}}>
      <button onClick={()=>setTab('waiting')}
        style={{padding:'8px 22px',fontSize:14,fontWeight:600,borderRadius:10,border:'2px solid',cursor:'pointer',
          background:tab==='waiting'?'var(--sage)':'transparent',
          borderColor:tab==='waiting'?'var(--sage)':'var(--stone)',
          color:tab==='waiting'?'#fff':'var(--muted)'}}>Lista de espera</button>
      <button onClick={()=>setTab('expedite')}
        style={{padding:'8px 22px',fontSize:14,fontWeight:600,borderRadius:10,border:'2px solid',cursor:'pointer',
          background:tab==='expedite'?'var(--sage)':'transparent',
          borderColor:tab==='expedite'?'var(--sage)':'var(--stone)',
          color:tab==='expedite'?'#fff':'var(--muted)'}}>Lista de adelantar</button>
    </div>

    {loading?<Sp/>:rows.length===0?<Em icon="✅" title="Lista vacía"/>:
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <div style={{minWidth:920}}>
            <div style={{display:'grid',gridTemplateColumns:'50px 1.5fr 1fr 1fr 0.8fr 1.2fr 1.4fr',gap:8,padding:'12px 14px',background:'var(--cream)',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:'1.5px solid var(--border)'}}>
              <div>#</div><div>Paciente</div><div>Sem. restantes</div><div>Fecha pautada</div>
              <div>Hora pref.</div><div>Próxima cita</div><div>Acciones</div>
            </div>
            {rows.map((r, idx) => {
              const fb = fbMap[r.fallback_appointment_id]
              const { untilAppt, untilDue } = weeksCalc(r)
              const showRatio = untilAppt != null || untilDue != null
              const isLate = untilDue != null && untilDue < 0
              const fmt = v => v == null ? '?' : (v >= 0 ? `+${Math.round(v)}` : String(Math.round(v)))
              return <div key={r.id} style={{display:'grid',gridTemplateColumns:'50px 1.5fr 1fr 1fr 0.8fr 1.2fr 1.4fr',gap:8,padding:'14px',borderBottom:'1px solid var(--border)',alignItems:'center',fontSize:13}}>
                <div style={{fontWeight:700,fontSize:15,color:'var(--sage-deep)'}}>{r.priority_order}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.patients?.full_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{r.patients?.phone}</div>
                </div>
                <div>
                  {showRatio
                    ? <span style={{fontWeight:600,color: isLate ? '#dc2626' : untilDue != null && untilDue < 1 ? '#d97706' : 'var(--text)'}}>
                        {untilAppt != null ? `${Math.round(untilAppt)} sem` : '?'} / {untilDue != null ? `${Math.round(untilDue)} sem` : '?'}
                      </span>
                    : <span style={{color:'var(--text-muted)',fontSize:11}}>Sin límite</span>}
                </div>
                <div>{(()=>{const fp=fechaPautada(r);if(!fp)return<span style={{color:'var(--text-muted)',fontSize:11}}>—</span>;const isLate=fp<new Date();return<span style={{fontWeight:600,color:isLate?'#dc2626':'var(--text)'}}>{fp.toLocaleDateString('es-ES',{day:'numeric',month:'short'})}{isLate?' ⚠':''}</span>})()}</div>
                <div>{r.preferred_hour!=null ? `${pad(r.preferred_hour)}:00` : 'Cualquiera'}</div>
                <div style={{minWidth:0}}>
                  {fb ? <span style={fb.status==='cancelled'?{color:'#dc2626'}:{}}>{fDT(fb.starts_at)}</span> : <span style={{color:'#dc2626'}}>Sin cita</span>}
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  <Btn variant="ghost" style={{padding:'6px 10px',fontSize:13,minHeight:34}} onClick={()=>moveUp(r, idx)} disabled={idx===0} title="Subir">⬆</Btn>
                  <Btn variant="ghost" style={{padding:'6px 10px',fontSize:13,minHeight:34}} onClick={()=>moveDown(r, idx)} disabled={idx===rows.length-1} title="Bajar">⬇</Btn>
                  <Btn variant="ghost" style={{padding:'6px 10px',fontSize:11,minHeight:34}} onClick={()=>moveToOther(r)}>{r.queue_type==='waiting'?'→ Adelantar':'→ Espera'}</Btn>
                  <Btn variant="ghost" style={{padding:'6px 10px',fontSize:13,minHeight:34}} onClick={()=>openEdit(r)} title="Editar fechas">✏️</Btn>
                  <Btn variant="ghost" style={{padding:'6px 10px',fontSize:13,minHeight:34}} onClick={()=>openAssign(r)} title="Buscar hueco cancelado">🔍</Btn>
                  <Btn variant="danger" style={{padding:'6px 10px',fontSize:13,minHeight:34}} onClick={()=>remove(r.id)} title="Quitar">🗑</Btn>
                </div>
              </div>
            })}
          </div>
        </div>
      </div>
    }

    {assignModal && <Modal title={`Asignar hueco a ${assignModal.row.patients?.full_name || ''}`} onClose={()=>setAssignModal(null)}>
      <div style={{maxHeight:400,overflowY:'auto'}}>
        {assignModal.candidates.length === 0
          ? <Em icon="📭" title="No hay huecos cancelados disponibles"/>
          : assignModal.candidates.map(({appt, beforeFb, hourMatches}) => {
            const allMatch = beforeFb && hourMatches
            const bg = allMatch ? '#ecfdf5' : '#fefce8'
            const border = allMatch ? '#10b981' : '#eab308'
            return (
              <div key={appt.id} style={{
                padding:'10px 12px',marginBottom:8,
                background:bg,
                border:`1px solid ${border}`,
                borderRadius:6,cursor:'pointer'
              }} onClick={() => confirmAssign(appt)}>
                <div style={{fontSize:13,fontWeight:700}}>{fDT(appt.starts_at)}</div>
                {!allMatch && <div style={{fontSize:10,color:'#a16207',fontWeight:600}}>
                  ⚠ {!beforeFb && 'Posterior a su cita actual. '}
                  {!hourMatches && 'Hora preferida distinta. '}
                  Puedes asignarlo igualmente.
                </div>}
              </div>
            )
          })
        }
      </div>
      <Btn variant="ghost" onClick={()=>setAssignModal(null)} style={{marginTop:8,width:'100%'}}>Cerrar</Btn>
    </Modal>}

    {editModal&&<Modal title="Editar parámetros de espera" onClose={()=>setEditModal(null)}>
      <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>{editModal.patients?.full_name}</p>
      <Inp label="Fecha pautada (no ofrecer antes de esta fecha)" type="date"
        value={editForm.target_date}
        onChange={e=>setEditForm(f=>({...f,target_date:e.target.value}))}/>
      <Inp label="Semanas pautadas (para calcular si lleva demasiado tiempo)" type="number" min={1} max={52}
        placeholder="Ej: 4"
        value={editForm.weeks_pautadas}
        onChange={e=>setEditForm(f=>({...f,weeks_pautadas:e.target.value}))}/>
      <div className="field">
        <label className="field-label">Hora preferida</label>
        <select className="field-input" value={editForm.preferred_hour} onChange={e=>setEditForm(f=>({...f,preferred_hour:e.target.value}))}>
          <option value="">Cualquier hora</option>
          {Array.from({length:13},(_,i)=>i+7).map(h=><option key={h} value={h}>{pad(h)}:00</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost" onClick={()=>setEditModal(null)} style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={saveEdit} style={{flex:1}}>Guardar</Btn>
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
  const[form,setForm]=useState({start:'',end:'',max_bookings:8,service_id:'',professional_id:''})
  const[services,setServices]=useState([])
  const[professionals,setProfessionals]=useState([])
  const[toast,setToast]=useState(null)
  const[tab,setTab]=useState('upcoming')

  const load=useCallback(async()=>{
    setLoading(true)
    const[{data:svcs},{data:profs}]=await Promise.all([
      sb.from('services').select('id,name').eq('section','yoga').eq('is_active',true),
      sb.from('professionals').select('id,name').eq('section','yoga').eq('is_active',true).order('name'),
    ])
    setServices(svcs||[])
    setProfessionals(profs||[])
    setForm(f=>({...f,
      professional_id:f.professional_id||(profs||[])[0]?.id||'',
      service_id:f.service_id||(svcs||[])[0]?.id||'',
    }))
    const svcIds=(svcs||[]).map(s=>s.id)
    if(svcIds.length===0){setSlots([]);setLoading(false);return}
    const now=localDT(new Date())
    let q=sb.from('availability_slots')
      .select('id,starts_at,ends_at,max_bookings,is_published,professionals(id,name),services(id,name),bookings(id,status,patients(full_name,phone))')
      .in('service_id',svcIds).order('starts_at',{ascending:tab==='upcoming'})
    if(tab==='upcoming') q=q.gte('starts_at',now); else q=q.lt('starts_at',now)
    const{data}=await q.limit(30)
    setSlots((data||[]).map(s=>({...s,booked:(s.bookings||[]).filter(b=>b.status!=='cancelled').length})))
    setLoading(false)
  },[section,tab])

  useEffect(()=>{load()},[load])

  const saveSlot=async()=>{
    if(!form.start||!form.max_bookings||!form.service_id||!form.professional_id)return
    const startStr=form.start.length===16?form.start+':00':form.start
    const endStr=form.end?(form.end.length===16?form.end+':00':form.end):null
    const payload={service_id:form.service_id,professional_id:form.professional_id,starts_at:startStr,ends_at:endStr,max_bookings:Number(form.max_bookings),is_published:false}
    let error
    if(modal?.id)({error}=await sb.from('availability_slots').update(payload).eq('id',modal.id))
    else({error}=await sb.from('availability_slots').insert(payload))
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setModal(null);setForm({start:'',end:'',max_bookings:8,service_id:'',professional_id:''})
    setToast({msg:modal?.id?'Clase actualizada':'Clase creada',type:'ok'});load()
  }

  const deleteSlot=async id=>{await sb.from('availability_slots').delete().eq('id',id);setToast({msg:'Clase eliminada',type:'ok'});load()}

  const cancelClass=async slot=>{
    await sb.from('availability_slots').update({is_published:false}).eq('id',slot.id)
    // Cancel all active bookings for this slot
    await sb.from('bookings').update({status:'cancelled',cancelled_by:'secretary'}).eq('slot_id',slot.id).neq('status','cancelled')
    setCancelModal(null); setToast({msg:`Clase cancelada. ${slot.booked} reserva${slot.booked!==1?'s':''} cancelada${slot.booked!==1?'s':''}`,type:'ok'}); load()
  }

  const togglePublish=async slot=>{
    await sb.from('availability_slots').update({is_published:!slot.is_published}).eq('id',slot.id)
    setToast({msg:slot.is_published?'Clase ocultada':'Clase publicada',type:'ok'}); load()
  }
  const openEdit=slot=>{setForm({start:slot.starts_at?.slice(0,16)||'',end:slot.ends_at?.slice(0,16)||'',max_bookings:slot.max_bookings,service_id:slot.services?.id||'',professional_id:slot.professionals?.id||''});setModal(slot)}
  const openBookings=slot=>{setShowBook(slot);setBookings(slot.bookings||[])}

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Clases de {title}</span>
      <div style={{display:'flex',gap:8}}>
        <div className="tab-pills"style={{margin:0}}>{[['upcoming','Próximas'],['past','Pasadas']].map(([id,l])=><button key={id}className={`tab-pill ${tab===id?'active':''}`}onClick={()=>setTab(id)}>{l}</button>)}</div>
        <Btn onClick={()=>{setModal('new');setForm({start:'',end:'',max_bookings:8,service_id:services[0]?.id||'',professional_id:professionals[0]?.id||''})}}>+ Nueva</Btn>
      </div>
    </div>
    <div className="card"style={{overflow:'hidden'}}>
      {slots.length===0?<Em icon={isYoga?'🧘':'✨'}title="Sin clases"sub={`No hay clases ${tab==='upcoming'?'próximas':'pasadas'}`}/>
      :slots.map(slot=>{const pct=slot.max_bookings>0?Math.round(slot.booked/slot.max_bookings*100):0;return(
        <div key={slot.id}className="slot-card">
          <div className="slot-info">
            <div className="slot-title">{slot.services?.name||title}</div>
            <div className="slot-meta">{fDT(slot.starts_at)} · {slot.professionals?.name||''}{slot.professionals?.name?' · ':''}{slot.booked}/{slot.max_bookings} reservas</div>
            <div className="slot-bar"><div className="slot-bar-fill"style={{width:`${pct}%`}}/></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
            <Bg variant={slot.is_published?'green':'gray'}>{slot.is_published?'Publicada':'Borrador'}</Bg>
            <div style={{display:'flex',gap:4,marginTop:4}}>
              <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>openBookings(slot)}>👥 {slot.booked}</Btn>
              <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>openEdit(slot)}>✏️</Btn>
              <Btn variant={slot.is_published?'secondary':'primary'}style={{padding:'4px 8px',fontSize:11}}onClick={()=>togglePublish(slot)}>{slot.is_published?'Ocultar':'Publicar'}</Btn>
              {slot.booked>0&&<Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>setCancelModal(slot)}>Cancelar clase</Btn>}
              <Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>deleteSlot(slot.id)}>🗑</Btn>
            </div>
          </div>
        </div>
      )})}
    </div>

    {modal&&<Modal title={modal?.id?'Editar clase':'Nueva clase'}onClose={()=>setModal(null)}>
      <Sel label="Servicio"value={form.service_id}onChange={e=>setForm(f=>({...f,service_id:e.target.value}))}options={[['','Seleccionar…'],...services.map(s=>[s.id,s.name])]}/>
      <Sel label="Profesional"value={form.professional_id}onChange={e=>setForm(f=>({...f,professional_id:e.target.value}))}options={[['','Seleccionar…'],...professionals.map(p=>[p.id,p.name])]}/>
      {(()=>{const QHOURS=Array.from({length:(21-7)*4+4},(_,i)=>{const h=7+Math.floor(i/4),m=(i%4)*15;const v=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;return[v,v]}).filter(([v])=>v<='21:45');const date=form.start?.slice(0,10)||'';return(<div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
        <Inp label="Fecha"type="date"value={date}onChange={e=>{const d=e.target.value||'';setForm(f=>({...f,start:d?d+'T'+(f.start?.slice(11,16)||'09:00'):'',end:d?d+'T'+(f.end?.slice(11,16)||'10:00'):''}))}}/>
        <Sel label="Hora inicio"value={form.start?.slice(11,16)||''}onChange={e=>setForm(f=>({...f,start:(f.start?.slice(0,10)||'')+'T'+e.target.value}))}options={[['','--:--'],...QHOURS]}/>
        <Sel label="Hora fin"value={form.end?.slice(11,16)||''}onChange={e=>setForm(f=>({...f,end:(f.start?.slice(0,10)||'')+'T'+e.target.value}))}options={[['','--:--'],...QHOURS]}/>
      </div>)})()}
      <Inp label="Plazas máximas"type="number"min={1}value={form.max_bookings}onChange={e=>setForm(f=>({...f,max_bookings:e.target.value}))}/>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={saveSlot}disabled={!form.start||!form.end||!form.service_id||!form.professional_id}style={{flex:1}}>Guardar</Btn>
      </div>
    </Modal>}

    {showBook&&<Modal title={`Reservas — ${showBook.services?.name}`}onClose={()=>setShowBook(null)}>
      <div style={{marginBottom:14,fontSize:13,color:'var(--text-muted)'}}>{fDT(showBook.starts_at)} · {showBook.booked}/{showBook.max_bookings} plazas</div>
      {bookings.filter(b=>b.status!=='cancelled').length===0?<Em icon="👥"title="Sin reservas"/>
      :bookings.filter(b=>b.status!=='cancelled').map(b=><div key={b.id}style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
        <div className="pac-avatar">{b.patients?.full_name?.slice(0,2).toUpperCase()||'?'}</div>
        <div><div style={{fontSize:13,fontWeight:700}}>{b.patients?.full_name||'—'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{b.patients?.phone||'Sin teléfono'}</div></div>
      </div>)}
      <Btn variant="ghost"onClick={()=>setShowBook(null)}style={{width:'100%',marginTop:16}}>Cerrar</Btn>
    </Modal>}

    {cancelModal&&<Modal title="¿Cancelar esta clase?"onClose={()=>setCancelModal(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
        Se cancelará la clase <strong>{cancelModal.services?.name}</strong> del <strong>{fDT(cancelModal.starts_at)}</strong>.<br/>
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
  const[showNewModal,setShowNewModal]=useState(false)
  const[newName,setNewName]=useState('')
  const[newPhone,setNewPhone]=useState('')
  const[savingNew,setSavingNew]=useState(false)
  const[toast,setToast]=useState(null)
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
      sb.from('appointments').select('id,starts_at,status,professionals(name),services(name)').eq('patient_id',patId).order('starts_at',{ascending:false}).limit(20),
      sb.from('bookings').select('id,status,created_at,availability_slots(starts_at,services(name))').eq('patient_id',patId).order('created_at',{ascending:false}).limit(10),
    ])
    const a=(appts.data||[]).map(x=>({id:x.id,type:'osteo',typeLabel:'Osteopatía',name:x.services?.name||'Osteopatía',pro:x.professionals?.name,date:x.starts_at,status:x.status}))
    const b=(bookings.data||[]).map(x=>{const name=x.availability_slots?.services?.name||'Clase';return{id:x.id,type:name.toLowerCase().includes('yoga')?'yoga':'belleza',typeLabel:name.toLowerCase().includes('yoga')?'Yoga':'Belleza',name,date:x.availability_slots?.starts_at||x.created_at,status:x.status}})
    setHistory([...a,...b].sort((x,y)=>new Date(y.date)-new Date(x.date)));setHistLoad(false)
  }

  const selectPat=p=>{setSelected(p);fetchHistory(p.id)}
  const totalPages=Math.ceil(total/PAGE_SIZE)

  const normalizePhone = (raw) => {
    if (!raw) return ''
    let p = String(raw).replace(/[^\d+]/g, '')
    if (p.startsWith('+') && !p.startsWith('+34')) return ''
    p = p.replace(/^\+?34/, '').replace(/^0+/, '')
    return /^\d{9}$/.test(p) ? p : ''
  }

  const createPatient = async () => {
    const name = newName.trim()
    const phone = normalizePhone(newPhone)
    if (!name) { setToast({msg:'Nombre obligatorio',type:'error'}); return }
    if (!phone) { setToast({msg:'Teléfono inválido (debe ser español, 9 dígitos)',type:'error'}); return }

    setSavingNew(true)
    // Comprobar si ya existe por teléfono
    const { data: ex } = await sb.from('patients').select('id, full_name').ilike('phone', `%${phone}`).maybeSingle()
    if (ex) {
      setToast({msg:`Ya existe: ${ex.full_name}`,type:'error'})
      setSavingNew(false)
      return
    }
    const { error } = await sb.from('patients').insert({ full_name: name, phone })
    setSavingNew(false)
    if (error) { setToast({msg:'Error: '+error.message,type:'error'}); return }
    setShowNewModal(false); setNewName(''); setNewPhone('')
    setToast({msg:'Paciente añadido',type:'ok'})
    fetchPats(query, 0)
  }

  return<div className="pac-layout">
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div>
      <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'stretch'}}>
        <div className="pac-search-bar" style={{margin:0,flex:1}}>
          <span style={{fontSize:16}}>🔍</span>
          <input className="pac-search-input"placeholder="Buscar por nombre o teléfono…"value={query}onChange={e=>setQuery(e.target.value)}autoFocus/>
          {query&&<button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:14}}onClick={()=>setQuery('')}>✕</button>}
        </div>
        <Btn onClick={()=>setShowNewModal(true)} style={{whiteSpace:'nowrap'}}>+ Cliente</Btn>
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

    {showNewModal && <Modal title="Nuevo cliente" onClose={()=>{setShowNewModal(false);setNewName('');setNewPhone('')}}>
      <Inp label="Nombre completo" value={newName} onChange={e=>setNewName(e.target.value)} autoFocus placeholder="Ej: Lucia Sánchez García"/>
      <Inp label="Teléfono (9 dígitos, sin +34)" value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="612345678" inputMode="tel"/>
      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:-8,marginBottom:14}}>
        Sólo móviles o fijos españoles. Ejemplo: 666 111 222 → 666111222.
      </div>
      <div style={{display:'flex',gap:10,marginTop:6}}>
        <Btn variant="ghost" onClick={()=>{setShowNewModal(false);setNewName('');setNewPhone('')}} style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={createPatient} disabled={savingNew} style={{flex:1}}>{savingNew?'Guardando…':'Crear cliente'}</Btn>
      </div>
    </Modal>}
  </div>
}

// ─── Belleza Admin ────────────────────────────────────────────────────────────
function BellezaAdmin(){
  const[tab,setTab]=useState('espera')
  const[requests,setRequests]=useState([])
  const[sessions,setSessions]=useState([])
  const[loading,setLoading]=useState(true)
  const[toast,setToast]=useState(null)
  const[modal,setModal]=useState(null)
  const[sessionDate,setSessionDate]=useState('')
  const[selected,setSelected]=useState(new Set())
  const[saving,setSaving]=useState(false)
  const[sending,setSending]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const{data}=await sb.from('beauty_requests')
      .select('id,status,session_date,session_time,created_at,patients(id,full_name,phone),services(id,name)')
      .in('status',tab==='espera'?['waiting']:['confirmed'])
      .order('created_at')
    if(tab==='espera'){
      setRequests(data||[])
    } else {
      const groups={}
      for(const r of (data||[])){
        const key=`${r.session_date}__${r.services?.id}`
        if(!groups[key]) groups[key]={date:r.session_date,service:r.services,patients:[]}
        groups[key].patients.push({...r.patients,reqId:r.id,session_time:r.session_time||''})
      }
      setSessions(Object.values(groups).sort((a,b)=>a.date<b.date?-1:1))
    }
    setLoading(false)
  },[tab])
  useEffect(()=>{load()},[load])

  const byService={}
  for(const r of requests){
    const sid=r.services?.id
    if(!byService[sid]) byService[sid]={service:r.services,patients:[]}
    byService[sid].patients.push({...r.patients,reqId:r.id})
  }
  const groups=Object.values(byService)

  const openModal=g=>{setModal(g);setSessionDate('');setSelected(new Set(g.patients.map(p=>p.reqId)))}

  const createSession=async()=>{
    if(!sessionDate||selected.size===0)return
    setSaving(true)
    const{error}=await sb.from('beauty_requests').update({status:'confirmed',session_date:sessionDate}).in('id',[...selected])
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setModal(null)
    setToast({msg:`Sesión creada · ${selected.size} paciente${selected.size!==1?'s':''} confirmado${selected.size!==1?'s':''}`,type:'ok'})
    load()
  }

  const cancelRequest=async id=>{
    await sb.from('beauty_requests').update({status:'cancelled'}).eq('id',id)
    setToast({msg:'Solicitud cancelada',type:'ok'}); load()
  }

  const cancelSession=async s=>{
    const ids=s.patients.map(p=>p.reqId)
    const{error}=await sb.from('beauty_requests').update({status:'waiting',session_date:null,session_time:null}).in('id',ids)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Sesión cancelada',type:'ok'}); load()
  }

  const saveTime=async(reqId,time)=>{
    await sb.from('beauty_requests').update({session_time:time||null}).eq('id',reqId)
  }

  const sendWhatsApp=async s=>{
    const msgs=s.patients.filter(p=>p.session_time).map(p=>({
      phone:p.phone,
      text:`Hola ${p.full_name} 👋\n\nTe confirmamos tu cita de *${s.service?.name}* el *${fD(s.date)}* a las *${p.session_time?.slice(0,5)}*.\n\n¡Te esperamos en Anantara! 🌿`
    }))
    if(msgs.length===0){setToast({msg:'Asigna horas antes de enviar',type:'error'});return}
    setSending(s.date+'__'+s.service?.id)
    try{
      const res=await fetch('http://localhost:3001/send-beauty',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs})})
      if(!res.ok)throw new Error(await res.text())
      setToast({msg:`${msgs.length} mensaje${msgs.length!==1?'s':''} enviado${msgs.length!==1?'s':''}`,type:'ok'})
    }catch(e){
      setToast({msg:'Error al enviar: '+e.message,type:'error'})
    }finally{setSending(null)}
  }

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Belleza</span>
      <div className="tab-pills"style={{margin:0}}>
        {[['espera','Lista de espera'],['sesiones','Sesiones']].map(([id,l])=>
          <button key={id}className={`tab-pill ${tab===id?'active':''}`}onClick={()=>setTab(id)}>{l}</button>
        )}
      </div>
    </div>

    {loading&&<Sp/>}

    {!loading&&tab==='espera'&&(groups.length===0
      ?<Em icon="✨"title="Sin solicitudes"sub="Nadie está esperando ningún servicio"/>
      :groups.map(g=><div key={g.service?.id}className="card"style={{padding:'16px 20px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{g.service?.name}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{g.patients.length} persona{g.patients.length!==1?'s':''} esperando</div>
            </div>
            <Btn onClick={()=>openModal(g)}>Crear sesión</Btn>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {g.patients.map(p=><div key={p.reqId}style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--cream)',borderRadius:8}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{p.full_name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{p.phone}</div></div>
              <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11}}onClick={()=>cancelRequest(p.reqId)}>Cancelar</Btn>
            </div>)}
          </div>
        </div>
      )
    )}

    {!loading&&tab==='sesiones'&&(sessions.length===0
      ?<Em icon="📅"title="Sin sesiones"sub="Aún no hay sesiones creadas"/>
      :sessions.map((s,i)=>{
        const key=s.date+'__'+s.service?.id
        const isSending=sending===key
        return<div key={i}className="card"style={{padding:'16px 20px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
            <div style={{fontWeight:700,fontSize:15}}>{s.service?.name}</div>
            <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11,color:'var(--red)'}}onClick={()=>cancelSession(s)}>Cancelar sesión</Btn>
          </div>
          <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>📅 {fD(s.date)}</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
            {s.patients.map((p,j)=><div key={j}style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--cream)',borderRadius:8}}>
              <div className="pac-avatar"style={{width:32,height:32,fontSize:12}}>{p?.full_name?.slice(0,2).toUpperCase()||'?'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600}}>{p?.full_name||'—'}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{p?.phone}</div>
              </div>
              <input type="time"defaultValue={p.session_time?.slice(0,5)||''}
                style={{border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',fontSize:12,color:'var(--text)',background:'white',width:90}}
                onBlur={e=>saveTime(p.reqId,e.target.value)}/>
            </div>)}
          </div>
          <Btn onClick={()=>sendWhatsApp(s)}disabled={isSending}style={{width:'100%'}}>
            {isSending?'Enviando…':'📲 Enviar citas por WhatsApp'}
          </Btn>
        </div>
      })
    )}

    {modal&&<Modal title={`Crear sesión — ${modal.service?.name}`}onClose={()=>setModal(null)}>
      <Inp label="Fecha de la sesión"type="date"value={sessionDate}onChange={e=>setSessionDate(e.target.value)}/>
      <div style={{marginTop:12,marginBottom:8,fontWeight:700,fontSize:13}}>Pacientes a incluir</div>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
        {modal.patients.map(p=><label key={p.reqId}style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--cream)',borderRadius:8,cursor:'pointer'}}>
          <input type="checkbox"checked={selected.has(p.reqId)}onChange={e=>{setSelected(prev=>{const s=new Set(prev);e.target.checked?s.add(p.reqId):s.delete(p.reqId);return s})}}/>
          <div><div style={{fontSize:13,fontWeight:600}}>{p.full_name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{p.phone}</div></div>
        </label>)}
      </div>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={createSession}disabled={!sessionDate||selected.size===0||saving}style={{flex:1}}>{saving?'Guardando…':'Crear sesión'}</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Servicios ────────────────────────────────────────────────────────────────
function Servicios(){
  const[items,setItems]=useState([])
  const[profs,setProfs]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const EMPTY_FORM={name:'',duration_minutes:60,price:'',section:'osteopathy',is_active:true,description:'',professional_id:''}
  const[form,setForm]=useState(EMPTY_FORM)
  const[delConfirm,setDelConfirm]=useState(null)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  const CATS=[['osteopathy','Osteopatía'],['yoga','Yoga'],['escalada','Escalada'],['beauty','Belleza']]
  const CAT_CLS={osteopathy:'osteopatia',yoga:'yoga',beauty:'belleza'}

  const load=useCallback(async()=>{
    setLoading(true)
    const[{data:svcs,error},{data:ps}]=await Promise.all([
      sb.from('services').select('*').order('section').order('name'),
      sb.from('professionals').select('id,name,section').eq('is_active',true).order('name',{ascending:false}),
    ])
    if(error){setToast({msg:'Error al cargar: '+error.message,type:'error'});setLoading(false);return}
    setItems(svcs||[]);setProfs(ps||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm(EMPTY_FORM);setModal('new')}
  const openEdit=svc=>{setForm({name:svc.name||'',duration_minutes:svc.duration_minutes||60,price:svc.price??'',section:svc.section||'osteopathy',is_active:svc.is_active!==false,description:svc.description||'',professional_id:svc.professional_id||''});setModal(svc)}

  // Filtra los profesionales relevantes según la sección del form
  const profsForSection = profs.filter(p => p.section === form.section || form.section === 'osteopathy')

  const save=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    const payload={
      name:form.name.trim(),
      duration_minutes:Number(form.duration_minutes),
      price:form.price!==''?Number(form.price):null,
      section:form.section,
      is_active:form.is_active,
      description:form.description||null,
      professional_id:form.professional_id||null,
    }
    let error
    if(modal?.id){
      ({error}=await sb.from('services').update(payload).eq('id',modal.id))
    }else{
      ({error}=await sb.from('services').insert(payload))
    }
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setModal(null);setToast({msg:modal?.id?'Servicio actualizado':'Servicio creado',type:'ok'});load()
  }

  const del=async id=>{
    const{error}=await sb.from('services').delete().eq('id',id)
    setDelConfirm(null)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Servicio eliminado',type:'ok'});load()
  }

  const toggleActive=async svc=>{
    const{error}=await sb.from('services').update({is_active:!svc.is_active}).eq('id',svc.id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    load()
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
      :items.map(svc=>{
        const profName = svc.professional_id ? profs.find(p=>p.id===svc.professional_id)?.name : null
        return<div key={svc.id}className="svc-row">
        <span className={`svc-cat svc-cat-${CAT_CLS[svc.section]||'otro'}`}>{CATS.find(([k])=>k===svc.section)?.[1]||svc.section}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:svc.is_active?'var(--text)':'var(--text-muted)',display:'flex',alignItems:'center',gap:8}}>
            {svc.name}
            {profName&&<Bg variant="sage">{profName}</Bg>}
            {!profName&&<Bg variant="gray">Todos</Bg>}
            {!svc.is_active&&<Bg variant="gray">Inactivo</Bg>}
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
            {svc.duration_minutes} min{svc.price!=null?` · ${svc.price}€`:''}
            {svc.description?` · ${svc.description}`:''}
          </div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <Toggle on={svc.is_active}onChange={()=>toggleActive(svc)}/>
          <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11}}onClick={()=>openEdit(svc)}>✏️ Editar</Btn>
          <Btn variant="danger"style={{padding:'4px 10px',fontSize:11}}onClick={()=>setDelConfirm(svc.id)}>🗑</Btn>
        </div>
      </div>
      })}
    </div>

    {modal&&<Modal title={modal?.id?'Editar servicio':'Nuevo servicio'}onClose={()=>setModal(null)}>
      <Inp label="Nombre del servicio *"value={form.name}onChange={e=>setForm(f=>({...f,name:e.target.value}))}required placeholder="Ej: Maderoterapia"/>
      <Sel label="Sección"value={form.section}onChange={e=>setForm(f=>({...f,section:e.target.value,professional_id:''}))}options={CATS}/>
      <div className="field">
        <label className="field-label">Profesional</label>
        <select className="field-input"value={form.professional_id}onChange={e=>setForm(f=>({...f,professional_id:e.target.value}))}>
          <option value="">Todos los profesionales</option>
          {profsForSection.map(p=><option key={p.id}value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div className="field">
          <label className="field-label">Duración (minutos)</label>
          <select className="field-input"value={form.duration_minutes}onChange={e=>setForm(f=>({...f,duration_minutes:e.target.value}))}>
            {[15,20,30,45,60,75,90,120].map(d=><option key={d}value={d}>{d} min</option>)}
          </select>
        </div>
        <Inp label="Precio (€, opcional)"type="number"min={0}step="0.01"value={form.price}onChange={e=>setForm(f=>({...f,price:e.target.value}))}placeholder="0.00"/>
      </div>
      <Inp label="Descripción (opcional)"value={form.description}onChange={e=>setForm(f=>({...f,description:e.target.value}))}placeholder="Breve descripción del servicio"/>
      <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13,marginBottom:16,cursor:'pointer'}}>
        <Toggle on={form.is_active}onChange={v=>setForm(f=>({...f,is_active:v}))}/>
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
  const[form,    setForm]    =useState({name:'',specialty:'',bio:'',section:'osteopathy',is_active:true})
  const[delConfirm,setDelConfirm]=useState(null)
  const[saving,  setSaving]  =useState(false)
  const[toast,   setToast]   =useState(null)

  const[loadErr,setLoadErr]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setLoadErr('')
    const{data,error}=await sb.from('professionals').select('*').order('name')
    if(error){setLoadErr(error.message);setItems([]);setLoading(false);return}
    setItems(data||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm({name:'',specialty:'',bio:'',section:'osteopathy',is_active:true});setModal('new')}
  const openEdit=p=>{setForm({name:p.name||'',specialty:p.specialty||'',bio:p.bio||'',section:p.section||'osteopathy',is_active:p.is_active!==false});setModal(p)}

  const save=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    const payload={name:form.name.trim(),specialty:form.specialty.trim()||null,bio:form.bio.trim()||null,section:form.section,is_active:form.is_active}
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
    const{error}=await sb.from('professionals').delete().eq('id',id)
    setDelConfirm(null)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Profesional eliminado',type:'ok'});load()
  }

  const toggleActive=async(id,val)=>{
    const{error}=await sb.from('professionals').update({is_active:val}).eq('id',id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setItems(prev=>prev.map(p=>p.id===id?{...p,is_active:val}:p))
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
              {(p.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:15,color:'var(--text)'}}>{p.name||'Sin nombre'}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{p.specialty||'Sin especialidad'}</div>
            </div>
            <span className={`badge ${p.is_active!==false?'badge-green':'badge-gray'}`}>{p.is_active!==false?'Activo':'Inactivo'}</span>
          </div>
          {p.bio&&<p style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6,margin:0}}>{p.bio}</p>}
          <div style={{display:'flex',gap:8,borderTop:'1px solid var(--border)',paddingTop:12}}>
            <Btn variant="ghost" onClick={()=>openEdit(p)} style={{flex:1,fontSize:12}}>Editar</Btn>
            <Btn variant={p.is_active?'secondary':'primary'} onClick={()=>toggleActive(p.id,!p.is_active)} style={{flex:1,fontSize:12}}>
              {p.is_active?'Desactivar':'Activar'}
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
        <input className="field-input" name="name" value={form.name} onChange={upd} placeholder="Ana García López" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Sección</label>
        <select className="field-input" name="section" value={form.section} onChange={upd}>
          <option value="osteopathy">Osteopatía</option>
          <option value="yoga">Yoga</option>
          <option value="escalada">Escalada</option>
          <option value="beauty">Belleza</option>
        </select>
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
        <input type="checkbox" id="pro-active" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} style={{width:16,height:16,accentColor:'var(--green)'}}/>
        <label htmlFor="pro-active" style={{fontSize:13,fontWeight:600,cursor:'pointer'}}>Activo (visible para reservas)</label>
      </div>
      <div style={{display:'flex',gap:10,marginTop:4}}>
        <Btn variant="ghost" onClick={()=>setModal(null)} style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={save} disabled={!form.name.trim()||saving} style={{flex:1}}>{saving?'Guardando…':'Guardar'}</Btn>
      </div>
    </Modal>}

    {delConfirm&&<Modal title="¿Eliminar profesional?" onClose={()=>setDelConfirm(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Se eliminará permanentemente. Las citas existentes no se borrarán pero quedarán sin profesional asignado.</p>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost" onClick={()=>setDelConfirm(null)} style={{flex:1}}>Cancelar</Btn>
        <Btn variant="danger" onClick={()=>del(delConfirm)} style={{flex:1}}>Eliminar</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Escalada ─────────────────────────────────────────────────────────────────
function Escalada(){
  const[tab,setTab]=useState('clases')
  const[slotsTab,setSlotsTab]=useState('upcoming')
  const[slots,setSlots]=useState([])
  const[templates,setTemplates]=useState([])
  const[services,setServices]=useState([])
  const[professionals,setProfessionals]=useState([])
  const[loading,setLoading]=useState(true)
  const[tplModal,setTplModal]=useState(null)
  const[slotModal,setSlotModal]=useState(null)
  const[bookingsModal,setBookingsModal]=useState(null)
  const[cancelModal,setCancelModal]=useState(null)
  const[toast,setToast]=useState(null)
  const[saving,setSaving]=useState(false)
  const DAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const QHOURS=Array.from({length:(21-7)*4+1},(_,i)=>{const h=7+Math.floor(i/4),m=(i%4)*15;return`${pad(h)}:${pad(m)}`})
  const EMPTY_TPL={day_of_week:2,start_time:'17:00',end_time:'18:30',max_bookings:10,service_id:'',professional_id:'',is_active:true}
  const[tplForm,setTplForm]=useState(EMPTY_TPL)
  const[slotForm,setSlotForm]=useState({date:'',start_time:'',end_time:'',max_bookings:10})

  const load=useCallback(async()=>{
    setLoading(true)
    const now=localDT(new Date())
    const[{data:svcs},{data:profs},{data:tpls}]=await Promise.all([
      sb.from('services').select('id,name,duration_minutes').eq('section','escalada').eq('is_active',true),
      sb.from('professionals').select('id,name').eq('is_active',true).order('name',{ascending:false}),
      sb.from('class_templates').select('*,services(name),professionals(name)').eq('section','escalada').order('day_of_week').order('start_time'),
    ])
    setServices(svcs||[])
    setProfessionals(profs||[])
    setTemplates(tpls||[])
    let q=sb.from('availability_slots')
      .select('id,starts_at,ends_at,max_bookings,is_published,template_id,professionals(id,name),services(id,name),bookings(id,status,patients(full_name,phone))')
      .not('template_id','is',null)
      .order('starts_at',{ascending:slotsTab==='upcoming'})
    if(slotsTab==='upcoming') q=q.gte('starts_at',now); else q=q.lt('starts_at',now)
    const{data:sl}=await q.limit(40)
    setSlots((sl||[]).map(s=>({...s,booked:(s.bookings||[]).filter(b=>b.status!=='cancelled').length})))
    setLoading(false)
  },[slotsTab])

  useEffect(()=>{load()},[load])

  const saveTpl=async()=>{
    if(!tplForm.service_id||!tplForm.professional_id){setToast({msg:'Selecciona servicio y profesional',type:'error'});return}
    setSaving(true)
    const payload={section:'escalada',day_of_week:Number(tplForm.day_of_week),start_time:tplForm.start_time+':00',end_time:tplForm.end_time+':00',max_bookings:Number(tplForm.max_bookings),service_id:tplForm.service_id,professional_id:tplForm.professional_id,is_active:tplForm.is_active}
    let error
    if(tplModal?.id)({error}=await sb.from('class_templates').update(payload).eq('id',tplModal.id))
    else({error}=await sb.from('class_templates').insert(payload))
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setTplModal(null);setToast({msg:tplModal?.id?'Plantilla actualizada':'Plantilla creada',type:'ok'});load()
  }

  const deleteTpl=async id=>{
    const{error}=await sb.from('class_templates').delete().eq('id',id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Plantilla eliminada',type:'ok'});load()
  }

  const generateFromTpl=async(tpl,weeks=8)=>{
    const today=new Date()
    const end=new Date(today.getTime()+weeks*7*86400000)
    const dates=[]
    for(let d=new Date(today);d<=end;d.setDate(d.getDate()+1)){
      if(d.getDay()===tpl.day_of_week) dates.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
    }
    const{data:existing}=await sb.from('availability_slots').select('starts_at').eq('template_id',tpl.id).gte('starts_at',today.toISOString().slice(0,10))
    const existingDates=new Set((existing||[]).map(s=>s.starts_at.slice(0,10)))
    const toCreate=dates.filter(d=>!existingDates.has(d)).map(d=>({
      service_id:tpl.service_id,professional_id:tpl.professional_id,
      starts_at:`${d}T${tpl.start_time.slice(0,5)}:00`,
      ends_at:`${d}T${tpl.end_time.slice(0,5)}:00`,
      max_bookings:tpl.max_bookings,is_published:false,template_id:tpl.id,
    }))
    if(toCreate.length===0){setToast({msg:'Todas las clases ya existen para ese periodo',type:'ok'});return}
    const{error}=await sb.from('availability_slots').insert(toCreate)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:`${toCreate.length} clase${toCreate.length!==1?'s':''} generada${toCreate.length!==1?'s':''}`,type:'ok'});load()
  }

  const saveSlotEdit=async()=>{
    if(!slotForm.date||!slotForm.start_time||!slotForm.end_time)return
    setSaving(true)
    const{error}=await sb.from('availability_slots').update({
      starts_at:`${slotForm.date}T${slotForm.start_time}:00`,
      ends_at:`${slotForm.date}T${slotForm.end_time}:00`,
      max_bookings:Number(slotForm.max_bookings),
    }).eq('id',slotModal.id)
    setSaving(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setSlotModal(null);setToast({msg:'Clase actualizada',type:'ok'});load()
  }

  const deleteSlot=async id=>{
    const{error}=await sb.from('availability_slots').delete().eq('id',id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setToast({msg:'Clase eliminada',type:'ok'});load()
  }

  const cancelClass=async slot=>{
    await sb.from('availability_slots').update({is_published:false}).eq('id',slot.id)
    await sb.from('bookings').update({status:'cancelled',cancelled_by:'secretary'}).eq('slot_id',slot.id).neq('status','cancelled')
    setCancelModal(null);setToast({msg:'Clase cancelada',type:'ok'});load()
  }

  const togglePublish=async slot=>{
    await sb.from('availability_slots').update({is_published:!slot.is_published}).eq('id',slot.id)
    setToast({msg:slot.is_published?'Clase ocultada':'Clase publicada',type:'ok'});load()
  }

  if(loading)return<Sp/>
  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Escalada</span>
      <div className="tab-pills"style={{margin:0}}>
        <button className={`tab-pill${tab==='clases'?' active':''}`}onClick={()=>setTab('clases')}>Clases</button>
        <button className={`tab-pill${tab==='plantillas'?' active':''}`}onClick={()=>setTab('plantillas')}>Plantillas recurrentes</button>
      </div>
    </div>

    {tab==='plantillas'&&<>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <Btn onClick={()=>{setTplForm({...EMPTY_TPL,service_id:services[0]?.id||'',professional_id:professionals[0]?.id||''});setTplModal('new')}}>+ Nueva plantilla</Btn>
      </div>
      {templates.length===0
        ?<Em icon="🔁"title="Sin plantillas"sub="Crea una plantilla para generar clases recurrentes"/>
        :<div className="card"style={{overflow:'hidden'}}>
          {templates.map(tpl=><div key={tpl.id}style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                {DAYS[tpl.day_of_week]}s · {tpl.start_time?.slice(0,5)} – {tpl.end_time?.slice(0,5)}
                <Bg variant={tpl.is_active?'green':'gray'}>{tpl.is_active?'Activa':'Pausada'}</Bg>
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                {tpl.services?.name||'—'} · {tpl.professionals?.name||'—'} · {tpl.max_bookings} plazas
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
              <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11}}onClick={()=>generateFromTpl(tpl,8)}>⚡ Generar 8 sem.</Btn>
              <Btn variant="ghost"style={{padding:'4px 10px',fontSize:11}}onClick={()=>{setTplForm({day_of_week:tpl.day_of_week,start_time:tpl.start_time?.slice(0,5),end_time:tpl.end_time?.slice(0,5),max_bookings:tpl.max_bookings,service_id:tpl.service_id||'',professional_id:tpl.professional_id||'',is_active:tpl.is_active});setTplModal(tpl)}}>✏️</Btn>
              <Toggle on={tpl.is_active}onChange={async()=>{await sb.from('class_templates').update({is_active:!tpl.is_active}).eq('id',tpl.id);load()}}/>
              <Btn variant="danger"style={{padding:'4px 10px',fontSize:11}}onClick={()=>deleteTpl(tpl.id)}>🗑</Btn>
            </div>
          </div>)}
        </div>}
    </>}

    {tab==='clases'&&<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div className="tab-pills"style={{margin:0}}>
          {[['upcoming','Próximas'],['past','Pasadas']].map(([id,l])=><button key={id}className={`tab-pill${slotsTab===id?' active':''}`}onClick={()=>setSlotsTab(id)}>{l}</button>)}
        </div>
      </div>
      <div className="card"style={{overflow:'hidden'}}>
        {slots.length===0
          ?<Em icon="🧗"title="Sin clases"sub={`No hay clases ${slotsTab==='upcoming'?'próximas':'pasadas'}. Genera desde Plantillas.`}/>
          :slots.map(slot=>{
            const pct=slot.max_bookings>0?Math.round(slot.booked/slot.max_bookings*100):0
            return<div key={slot.id}className="slot-card">
              <div className="slot-info">
                <div className="slot-title">{slot.services?.name||'Escalada'}</div>
                <div className="slot-meta">{fDT(slot.starts_at)} · {slot.professionals?.name||''}{slot.professionals?.name?' · ':''}{slot.booked}/{slot.max_bookings} reservas</div>
                <div className="slot-bar"><div className="slot-bar-fill"style={{width:`${pct}%`}}/></div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                <Bg variant={slot.is_published?'green':'gray'}>{slot.is_published?'Publicada':'Borrador'}</Bg>
                <div style={{display:'flex',gap:4,marginTop:4}}>
                  <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>setBookingsModal(slot)}>👥 {slot.booked}</Btn>
                  <Btn variant="ghost"style={{padding:'4px 8px',fontSize:11}}onClick={()=>{setSlotForm({date:slot.starts_at?.slice(0,10)||'',start_time:slot.starts_at?.slice(11,16)||'',end_time:slot.ends_at?.slice(11,16)||'',max_bookings:slot.max_bookings});setSlotModal(slot)}}>✏️</Btn>
                  <Btn variant={slot.is_published?'secondary':'primary'}style={{padding:'4px 8px',fontSize:11}}onClick={()=>togglePublish(slot)}>{slot.is_published?'Ocultar':'Publicar'}</Btn>
                  {slot.booked>0&&<Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>setCancelModal(slot)}>Cancelar</Btn>}
                  <Btn variant="danger"style={{padding:'4px 8px',fontSize:11}}onClick={()=>deleteSlot(slot.id)}>🗑</Btn>
                </div>
              </div>
            </div>
          })}
      </div>
    </>}

    {tplModal&&<Modal title={tplModal?.id?'Editar plantilla':'Nueva plantilla recurrente'}onClose={()=>setTplModal(null)}>
      <Sel label="Servicio"value={tplForm.service_id}onChange={e=>setTplForm(f=>({...f,service_id:e.target.value}))}options={[['','Seleccionar…'],...services.map(s=>[s.id,s.name])]}/>
      <Sel label="Profesional / Monitor"value={tplForm.professional_id}onChange={e=>setTplForm(f=>({...f,professional_id:e.target.value}))}options={[['','Seleccionar…'],...professionals.map(p=>[p.id,p.name])]}/>
      <Sel label="Día de la semana"value={String(tplForm.day_of_week)}onChange={e=>setTplForm(f=>({...f,day_of_week:Number(e.target.value)}))}options={DAYS.map((d,i)=>[String(i),d]).filter(([i])=>i>='1'&&i<='6')}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <Sel label="Hora inicio"value={tplForm.start_time}onChange={e=>setTplForm(f=>({...f,start_time:e.target.value}))}options={QHOURS.map(h=>[h,h])}/>
        <Sel label="Hora fin"value={tplForm.end_time}onChange={e=>setTplForm(f=>({...f,end_time:e.target.value}))}options={QHOURS.map(h=>[h,h])}/>
        <Inp label="Plazas máx."type="number"min={1}value={tplForm.max_bookings}onChange={e=>setTplForm(f=>({...f,max_bookings:e.target.value}))}/>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13,marginBottom:16,cursor:'pointer'}}>
        <Toggle on={tplForm.is_active}onChange={v=>setTplForm(f=>({...f,is_active:v}))}/>
        Plantilla activa
      </label>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setTplModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={saveTpl}disabled={!tplForm.service_id||!tplForm.professional_id||saving}style={{flex:1}}>{saving?'Guardando…':'Guardar'}</Btn>
      </div>
    </Modal>}

    {slotModal&&<Modal title="Editar clase individual"onClose={()=>setSlotModal(null)}>
      <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>Solo modifica esta clase. No afecta a la plantilla ni al resto de semanas.</p>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
        <Inp label="Fecha"type="date"value={slotForm.date}onChange={e=>setSlotForm(f=>({...f,date:e.target.value}))}/>
        <Sel label="Hora inicio"value={slotForm.start_time}onChange={e=>setSlotForm(f=>({...f,start_time:e.target.value}))}options={[['','--:--'],...QHOURS.map(h=>[h,h])]}/>
        <Sel label="Hora fin"value={slotForm.end_time}onChange={e=>setSlotForm(f=>({...f,end_time:e.target.value}))}options={[['','--:--'],...QHOURS.map(h=>[h,h])]}/>
      </div>
      <Inp label="Plazas máximas"type="number"min={1}value={slotForm.max_bookings}onChange={e=>setSlotForm(f=>({...f,max_bookings:e.target.value}))}style={{marginTop:10}}/>
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <Btn variant="ghost"onClick={()=>setSlotModal(null)}style={{flex:1}}>Cancelar</Btn>
        <Btn onClick={saveSlotEdit}disabled={!slotForm.date||!slotForm.start_time||!slotForm.end_time||saving}style={{flex:1}}>{saving?'Guardando…':'Guardar'}</Btn>
      </div>
    </Modal>}

    {bookingsModal&&<Modal title={`Reservas — ${bookingsModal.services?.name}`}onClose={()=>setBookingsModal(null)}>
      <div style={{marginBottom:14,fontSize:13,color:'var(--text-muted)'}}>{fDT(bookingsModal.starts_at)} · {bookingsModal.booked}/{bookingsModal.max_bookings} plazas</div>
      {(bookingsModal.bookings||[]).filter(b=>b.status!=='cancelled').length===0?<Em icon="👥"title="Sin reservas"/>
      :(bookingsModal.bookings||[]).filter(b=>b.status!=='cancelled').map(b=><div key={b.id}style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
        <div className="pac-avatar">{b.patients?.full_name?.slice(0,2).toUpperCase()||'?'}</div>
        <div><div style={{fontSize:13,fontWeight:700}}>{b.patients?.full_name||'—'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{b.patients?.phone||'Sin teléfono'}</div></div>
      </div>)}
      <Btn variant="ghost"onClick={()=>setBookingsModal(null)}style={{width:'100%',marginTop:16}}>Cerrar</Btn>
    </Modal>}

    {cancelModal&&<Modal title="¿Cancelar esta clase?"onClose={()=>setCancelModal(null)}>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
        Se cancelará la clase del <strong>{fDT(cancelModal.starts_at)}</strong>.<br/>
        Las <strong>{cancelModal.booked} reserva{cancelModal.booked!==1?'s':''}</strong> activas también se cancelarán.
      </p>
      <div style={{display:'flex',gap:10}}>
        <Btn variant="ghost"onClick={()=>setCancelModal(null)}style={{flex:1}}>Volver</Btn>
        <Btn variant="danger"onClick={()=>cancelClass(cancelModal)}style={{flex:1}}>Cancelar clase</Btn>
      </div>
    </Modal>}
  </>
}

// ─── Facturación ──────────────────────────────────────────────────────────────
function Facturacion(){
  const PAY={efectivo:'Efectivo',tarjeta:'Tarjeta',bizum:'Bizum',transferencia:'Transferencia'}

  function mP(){
    const d=new Date(),y=d.getFullYear(),m=d.getMonth()
    return{type:'month',from:`${y}-${pad(m+1)}-01`,to:`${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`}
  }
  function qP(){
    const d=new Date(),y=d.getFullYear(),q=Math.floor(d.getMonth()/3),sm=q*3,em=sm+2
    return{type:'quarter',from:`${y}-${pad(sm+1)}-01`,to:`${y}-${pad(em+1)}-${pad(new Date(y,em+1,0).getDate())}`}
  }
  function distribute(list,p){
    if(!list.length)return new Set()
    // Reglas:
    // - bizum, tarjeta, transferencia → SIEMPRE facturadas (trazables).
    // - efectivo o sin método → sometidas al porcentaje p.
    const forced = list.filter(a => ['bizum','tarjeta','transferencia'].includes(a.payment_method))
    const discretionary = list.filter(a => !['bizum','tarjeta','transferencia'].includes(a.payment_method))
    const result = new Set(forced.map(a => a.id))

    const n = discretionary.length
    if (n === 0) return result
    const keep = Math.round(n * p / 100)
    if (keep >= n) {
      for (const a of discretionary) result.add(a.id)
      return result
    }
    if (keep <= 0) return result
    // Distribuir los `keep` seleccionados entre días de la semana proporcionalmente
    const byDow = {}
    for (const a of discretionary) {
      const dow = new Date(a.starts_at.slice(0,10)+'T12:00:00').getDay()
      if (!byDow[dow]) byDow[dow] = []
      byDow[dow].push(a)
    }
    const excl = n - keep
    const dows = Object.keys(byDow).map(Number)
    const exPerDow = {}
    let assigned = 0
    for (let i = 0; i < dows.length; i++) {
      const dow = dows[i], cnt = byDow[dow].length
      if (i === dows.length-1) exPerDow[dow] = Math.max(0, Math.min(excl - assigned, cnt))
      else { const e = Math.min(Math.round(cnt/n * excl), cnt); exPerDow[dow] = e; assigned += e }
    }
    const exIds = new Set()
    for (const dow of dows) {
      const lst = byDow[dow], ex = exPerDow[dow] || 0
      if (!ex) continue
      const step = lst.length / ex
      for (let j = 0; j < ex; j++) exIds.add(lst[Math.min(Math.floor(j*step + step/2), lst.length-1)].id)
    }
    for (const a of discretionary) if (!exIds.has(a.id)) result.add(a.id)
    return result
  }

  const[period,setPeriod]=useState(mP)
  const[cFrom,setCFrom]=useState('')
  const[cTo,setCTo]=useState('')
  const[appts,setAppts]=useState([])
  const[selected,setSelected]=useState(new Set())
  const[pct,setPct]=useState(100)
  const pctRef=useRef(100)
  const[loading,setLoading]=useState(false)
  const[exporting,setExporting]=useState(false)
  const[toast,setToast]=useState(null)

  const load=useCallback(async()=>{
    const from=period.type==='custom'?cFrom:period.from
    const to=period.type==='custom'?cTo:period.to
    if(!from||!to)return
    setLoading(true)
    const{data,error}=await sb.from('appointments')
      .select('id,starts_at,status,payment_method,notes,patients(id,full_name),services(name,price,duration_minutes)')
      .gte('starts_at',from+'T00:00:00').lte('starts_at',to+'T23:59:59')
      .neq('status','cancelled').order('starts_at')
    setLoading(false)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    const list=data||[]
    setAppts(list)
    setSelected(distribute(list,pctRef.current))
  },[period,cFrom,cTo])
  useEffect(()=>{load()},[load])

  const selArr=appts.filter(a=>selected.has(a.id))
  const totalAmt=selArr.reduce((s,a)=>s+(a.services?.price||0),0)
  const handlePct=v=>{pctRef.current=v;setPct(v);setSelected(distribute(appts,v))}
  const toggle=id=>setSelected(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s})

  const eff={from:period.type==='custom'?cFrom:period.from,to:period.type==='custom'?cTo:period.to}

  function periodLabel(){
    if(!eff.from)return'—'
    if(period.type==='month'){const d=new Date(eff.from+'T12:00:00');const mn=MONTHS[d.getMonth()];return`${mn.charAt(0).toUpperCase()+mn.slice(1)} ${d.getFullYear()}`}
    if(period.type==='quarter'){const d=new Date(eff.from+'T12:00:00'),q=Math.floor(d.getMonth()/3)+1;return`${q}T ${d.getFullYear()}`}
    return`${eff.from} — ${eff.to}`
  }
  function fileLabel(){
    if(!eff.from)return'Facturacion'
    if(period.type==='month'){const d=new Date(eff.from+'T12:00:00'),mn=MONTHS[d.getMonth()];return`Facturacion_${mn.charAt(0).toUpperCase()+mn.slice(1)}_${d.getFullYear()}`}
    if(period.type==='quarter'){const d=new Date(eff.from+'T12:00:00'),q=Math.floor(d.getMonth()/3)+1;return`Facturacion_${q}T_${d.getFullYear()}`}
    return`Facturacion_${eff.from}_${eff.to}`
  }

  const exportExcel=async()=>{
    if(!selArr.length){setToast({msg:'No hay citas seleccionadas',type:'error'});return}
    setExporting(true)
    try{
      const ExcelJS=(await import('exceljs')).default
      const wb=new ExcelJS.Workbook()
      wb.creator='Anantara';wb.created=new Date()
      const hFont={name:'Arial',bold:true,size:11,color:{argb:'FFFFFFFF'}}
      const hFill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F3864'}}
      const dFont={name:'Arial',size:10}
      const gFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F2F2'}}
      const yFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFCC0'}}
      const bd={style:'thin',color:{argb:'FFCCCCCC'}}
      const ab={top:bd,left:bd,bottom:bd,right:bd}
      const yr=new Date((eff.from||'2025-01-01')+'T12:00:00').getFullYear()

      // ── Hoja 1: Facturas ──
      const ws1=wb.addWorksheet('Facturas')
      ws1.views=[{state:'frozen',ySplit:1}]
      ws1.addRow(['Nº Factura','Fecha','Paciente','DNI/NIE','Concepto','Duración (min)','Precio (€)','Forma de pago','Estado','Notas'])
      ws1.getRow(1).eachCell(c=>{c.font=hFont;c.fill=hFill;c.alignment={vertical:'middle',horizontal:'center'};c.border=ab})
      ws1.getRow(1).height=20
      selArr.forEach((a,i)=>{
        const r=ws1.addRow([
          `${yr}-${String(i+1).padStart(3,'0')}`,
          a.starts_at.slice(0,10).split('-').reverse().join('/'),
          a.patients?.full_name||'—','',
          a.services?.name||'Sesión',
          a.services?.duration_minutes||60,
          a.services?.price||0,
          PAY[a.payment_method]||a.payment_method||'',
          STATUS_TXT[a.status]||a.status||'',
          a.notes||'',
        ])
        r.eachCell(c=>{c.font=dFont;c.border=ab})
        if(i%2)r.eachCell(c=>{c.fill=gFill})
        r.getCell(7).numFmt='#,##0.00 €'
      })
      const tRow=ws1.addRow(['','','','','','Total',{formula:`SUM(G2:G${selArr.length+1})`},'','',''])
      tRow.eachCell(c=>{c.font={name:'Arial',bold:true,size:10};c.fill=yFill;c.border=ab})
      tRow.getCell(7).numFmt='#,##0.00 €'
      ws1.columns=[{width:14},{width:12},{width:28},{width:14},{width:30},{width:14},{width:14},{width:15},{width:12},{width:25}]

      // ── Hoja 2: Resumen ──
      const ws2=wb.addWorksheet('Resumen')
      const addH2=t=>{const r=ws2.addRow([t]);r.eachCell(c=>{c.font=hFont;c.fill=hFill})}
      const add2=(l,v,nf=null)=>{const r=ws2.addRow([l,v]);r.eachCell(c=>{c.font=dFont});if(nf)r.getCell(2).numFmt=nf}
      addH2('PERÍODO')
      add2('Período exportado',periodLabel())
      add2('Fecha de generación',new Date().toLocaleDateString('es'))
      add2('% facturado sobre el total',`${appts.length?Math.round(selArr.length/appts.length*100):0}%`)
      ws2.addRow([])
      addH2('TOTALES')
      add2('Total ingresos facturados (€)',totalAmt,'#,##0.00 €')
      add2('Nº sesiones facturadas',selArr.length)
      add2('Nº sesiones totales en el período',appts.length)
      add2('Nº pacientes distintos',new Set(selArr.map(a=>a.patients?.id)).size)
      add2('Ticket medio (€)',selArr.length?totalAmt/selArr.length:0,'#,##0.00 €')
      ws2.addRow([])
      addH2('DESGLOSE POR FORMA DE PAGO')
      ws2.addRow(['Forma de pago','Nº sesiones','Importe (€)','% del total']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10}})
      const byPay={}
      for(const a of selArr){const p=PAY[a.payment_method]||a.payment_method||'No especificado';if(!byPay[p])byPay[p]={n:0,amt:0};byPay[p].n++;byPay[p].amt+=(a.services?.price||0)}
      for(const[p,{n,amt}]of Object.entries(byPay)){
        const r=ws2.addRow([p,n,amt,totalAmt?`${Math.round(amt/totalAmt*100)}%`:'—'])
        r.eachCell(c=>{c.font=dFont});r.getCell(3).numFmt='#,##0.00 €'
      }
      ws2.addRow([])
      addH2('DESGLOSE MENSUAL')
      ws2.addRow(['Mes','Nº sesiones','Importe (€)']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10}})
      const byMon={}
      for(const a of selArr){const k=a.starts_at.slice(0,7);if(!byMon[k])byMon[k]={n:0,amt:0};byMon[k].n++;byMon[k].amt+=(a.services?.price||0)}
      for(const[k,{n,amt}]of Object.entries(byMon).sort()){
        const[y,m]=k.split('-')
        const lbl=`${MONTHS[Number(m)-1].charAt(0).toUpperCase()+MONTHS[Number(m)-1].slice(1)} ${y}`
        const r=ws2.addRow([lbl,n,amt]);r.eachCell(c=>{c.font=dFont});r.getCell(3).numFmt='#,##0.00 €'
      }
      ws2.columns=[{width:35},{width:15},{width:16},{width:14}]

      // ── Hoja 3: Para gestoría ──
      const ws3=wb.addWorksheet('Para gestoría')
      const fd=new Date((eff.from||'2025-01-01')+'T12:00:00')
      const q3=Math.floor(fd.getMonth()/3)+1
      const qNames=['Enero, Febrero, Marzo','Abril, Mayo, Junio','Julio, Agosto, Septiembre','Octubre, Noviembre, Diciembre']
      ws3.addRow([`MODELO 130 · ${q3}T ${fd.getFullYear()} — ${qNames[q3-1]}`])
        .eachCell(c=>{c.font={name:'Arial',bold:true,size:12,color:{argb:'FFFFFFFF'}};c.fill=hFill})
      ws3.addRow([])
      const pagadas=selArr.filter(a=>a.status==='confirmed'||a.status==='completed')
      const totPag=pagadas.reduce((s,a)=>s+(a.services?.price||0),0)
      const add3=(l,v,bold=false,nf=null,yfill=false)=>{
        const r=ws3.addRow([l,v]);r.eachCell(c=>{c.font={name:'Arial',bold:!!bold,size:10}})
        if(nf)r.getCell(2).numFmt=nf
        if(yfill)r.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFFCC'}}
      }
      add3('Total ingresos trimestre (citas Confirmadas/Completadas):',totPag,true,'#,##0.00 €')
      ws3.addRow([])
      ws3.addRow(['DESGLOSE MENSUAL']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE0E8F0'}}})
      ws3.addRow(['Mes','Nº sesiones','Ingresos (€)']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10}})
      const byMonG={}
      for(const a of pagadas){const k=a.starts_at.slice(0,7);if(!byMonG[k])byMonG[k]={n:0,amt:0};byMonG[k].n++;byMonG[k].amt+=(a.services?.price||0)}
      for(const[k,{n,amt}]of Object.entries(byMonG).sort()){
        const[y,m]=k.split('-')
        const r=ws3.addRow([`${MONTHS[Number(m)-1].charAt(0).toUpperCase()+MONTHS[Number(m)-1].slice(1)} ${y}`,n,amt])
        r.eachCell(c=>{c.font=dFont});r.getCell(3).numFmt='#,##0.00 €'
      }
      ws3.addRow([])
      ws3.addRow(['NOTA FISCAL']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10}})
      ws3.addRow(['Actividad exenta de IVA según art. 20.1.3º LIVA (osteopatía/fisioterapia). Sin retención IRPF (clientes particulares).'])
        .eachCell(c=>{c.font={name:'Arial',italic:true,size:9,color:{argb:'FF555555'}}})
      ws3.addRow([])
      ws3.addRow(['PARA LA GESTORÍA (completar):']).eachCell(c=>{c.font={name:'Arial',bold:true,size:10}})
      for(const l of['Gastos deducibles del trimestre (€):','Cuota Seguridad Social (€):','Rendimiento neto estimado (€):']) add3(l,'',false,'#,##0.00 €',true)
      ws3.columns=[{width:55},{width:18}]

      const buf=await wb.xlsx.writeBuffer()
      const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
      const url=URL.createObjectURL(blob)
      const el=document.createElement('a');el.href=url;el.download=`${fileLabel()}.xlsx`;el.click()
      URL.revokeObjectURL(url)
      setToast({msg:'Excel generado · '+fileLabel()+'.xlsx',type:'ok'})
    }catch(e){
      console.error('[facturacion]',e)
      setToast({msg:'Error al generar Excel: '+e.message,type:'error'})
    }finally{setExporting(false)}
  }

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Facturación</span>
      <Btn onClick={exportExcel}disabled={exporting||!selArr.length}>
        {exporting?'Generando…':'📥 Exportar Excel'}
      </Btn>
    </div>

    {/* Período */}
    <div className="card"style={{padding:'16px 20px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div className="tab-pills"style={{margin:0}}>
          {[['month','Mes actual'],['quarter','Trimestre'],['custom','Rango personalizado']].map(([id,l])=>
            <button key={id}className={`tab-pill ${period.type===id?'active':''}`}
              onClick={()=>id==='month'?setPeriod(mP()):id==='quarter'?setPeriod(qP()):setPeriod(p=>({...p,type:'custom'}))}>{l}</button>
          )}
        </div>
        {period.type==='custom'&&<>
          <input type="date"value={cFrom}onChange={e=>setCFrom(e.target.value)}className="field-input"style={{width:140}}/>
          <span style={{color:'var(--text-muted)'}}>—</span>
          <input type="date"value={cTo}onChange={e=>setCTo(e.target.value)}className="field-input"style={{width:140}}/>
          <Btn onClick={load}style={{padding:'6px 14px'}}>Aplicar</Btn>
        </>}
      </div>
    </div>

    {/* Slider + resumen */}
    <div className="card"style={{padding:'16px 20px',marginBottom:12}}>
      <div style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <label style={{fontSize:13,fontWeight:700}}>¿Qué % de citas quieres facturar?</label>
          <span style={{fontSize:15,fontWeight:800,color:'var(--green)'}}>{pct}%</span>
        </div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>
          Bizum, tarjeta y transferencia se facturan siempre. El porcentaje aplica solo a efectivo y citas sin método.
        </div>
        <input type="range"min={10}max={100}step={5}value={pct}
          onChange={e=>handlePct(Number(e.target.value))}
          style={{width:'100%',accentColor:'var(--green)'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-muted)',marginTop:2}}>
          <span>10%</span><span>100%</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          ['Citas totales',appts.length,''],
          ['Seleccionadas',selArr.length,'var(--green)'],
          ['No facturadas',appts.length-selArr.length,'var(--text-muted)'],
          ['Importe total',`${totalAmt.toFixed(2)} €`,'var(--green)'],
        ].map(([l,v,c])=><div key={l}style={{textAlign:'center',padding:'8px 4px',background:'var(--cream)',borderRadius:8}}>
          <div style={{fontSize:18,fontWeight:800,color:c||'var(--text)'}}>{v}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{l}</div>
        </div>)}
      </div>
    </div>

    {/* Botones */}
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
      <Btn variant="ghost"onClick={()=>setSelected(new Set(appts.map(a=>a.id)))}>Seleccionar todas</Btn>
      <Btn variant="ghost"onClick={()=>setSelected(new Set())}>Deseleccionar todas</Btn>
      <Btn variant="ghost"onClick={()=>setSelected(distribute(appts,pct))}>↺ Redistribuir</Btn>
    </div>

    {/* Tabla */}
    {loading?<Sp/>:appts.length===0
      ?<Em icon="🧾"title="Sin citas en este período"sub="Selecciona otro rango de fechas"/>
      :<div className="card"style={{overflow:'auto',padding:0}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'var(--green)',color:'white'}}>
              <th style={{padding:'10px 12px',textAlign:'center',width:40}}>
                <input type="checkbox"
                  checked={appts.length>0&&selected.size===appts.length}
                  onChange={e=>setSelected(e.target.checked?new Set(appts.map(a=>a.id)):new Set())}/>
              </th>
              {['Fecha','Hora','Paciente','Concepto','Importe (€)','Forma de pago'].map(h=>
                <th key={h}style={{padding:'10px 12px',textAlign:'left',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {appts.map((a,i)=>{
              const inc=selected.has(a.id)
              return<tr key={a.id}
                style={{background:inc?(i%2?'white':'var(--cream)'):'#efefef',opacity:inc?1:0.5,cursor:'pointer'}}
                onClick={()=>toggle(a.id)}>
                <td style={{padding:'8px 12px',textAlign:'center'}}onClick={e=>{e.stopPropagation();toggle(a.id)}}>
                  <input type="checkbox"checked={inc}onChange={()=>toggle(a.id)}/>
                </td>
                <td style={{padding:'8px 12px',whiteSpace:'nowrap',textDecoration:inc?'none':'line-through'}}>
                  {a.starts_at.slice(0,10).split('-').reverse().join('/')}
                </td>
                <td style={{padding:'8px 12px',whiteSpace:'nowrap'}}>{a.starts_at.slice(11,16)}</td>
                <td style={{padding:'8px 12px',fontWeight:600}}>{a.patients?.full_name||'—'}</td>
                <td style={{padding:'8px 12px'}}>{a.services?.name||'—'}</td>
                <td style={{padding:'8px 12px',whiteSpace:'nowrap',fontWeight:700,color:'var(--green)'}}>
                  {a.services?.price!=null?`${a.services.price} €`:'—'}
                </td>
                <td style={{padding:'8px 12px',color:a.payment_method?'var(--text)':'var(--text-muted)',fontStyle:a.payment_method?'normal':'italic'}}>
                  {PAY[a.payment_method]||a.payment_method||'—'}
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    }
  </>
}

// ─── App ──────────────────────────────────────────────────────────────────────
const PAGE_TITLES={dashboard:'Dashboard',agenda:'Agenda',horarios:'Horarios',bloqueados:'Días bloqueados',espera:'Lista de espera',yoga:'Yoga',escalada:'Escalada',belleza:'Belleza',pacientes:'Pacientes',servicios:'Servicios',profesionales:'Profesionales',facturacion:'Facturación'}

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
      case 'escalada':   return<Escalada/>
      case 'belleza':    return<BellezaAdmin/>
      case 'pacientes':     return<Pacientes/>
      case 'profesionales': return<Profesionales/>
      case 'servicios':     return<Servicios/>
      case 'facturacion':   return<Facturacion/>
      default:              return<Dashboard onNav={setPage}/>
    }
  }

  return<Layout title={PAGE_TITLES[page]||'Panel'}page={page}onNav={setPage}sidebarOpen={sidebarOpen}onToggleSidebar={setSidebarOpen}notifCount={notifCount}onLogout={logout}>
    {renderPage()}
  </Layout>
}
