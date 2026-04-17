import { createClient } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback } from 'react'

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
  ]},
  {label:'Centro',items:[
    {id:'belleza',icon:'✨',label:'Belleza'},
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
      sb.from('appointments').select('id,start_time,status,patients(full_name),services(name),professionals(name)',{count:'exact'})
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
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.services?.name} {a.professionals?.name?`· ${a.professionals.name}`:''}</div>
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
const SLOT_H=60
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
      sb.from('appointments').select('id,start_time,status,professional_id,notes,patients(id,full_name),services(name,duration_minutes),professionals(name)')
        .gte('start_time',from).lte('start_time',to).neq('status','cancelled'),
      sb.from('professionals').select('id,name').eq('is_active',true).order('name'),
    ])
    setAppts(appts.data||[])
    setProfs(profsR.data||[])
    setLoading(false)
  },[weekRef]) // eslint-disable-line

  useEffect(()=>{load()},[load])
  useEffect(()=>{sb.from('services').select('id,name,duration_minutes').eq('is_active',true).order('name').then(({data})=>setServices(data||[]))},[])

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
    const dur=svc?.duration_minutes||60
    const startDT=new Date(`${form.date}T${form.time}:00`)
    const endDT=new Date(startDT.getTime()+dur*60000)
    // Overlap check
    const{data:overlap}=await sb.from('appointments').select('id')
      .eq('professional_id',form.prof_id).neq('status','cancelled')
      .gte('start_time',startDT.toISOString()).lt('start_time',endDT.toISOString())
    if(overlap?.length){setToast({msg:'El profesional ya tiene una cita en ese horario.',type:'error'});return}
    const{error}=await sb.from('appointments').insert({
      patient_id:selPat.id,professional_id:form.prof_id,service_id:form.svc_id,
      start_time:startDT.toISOString(),notes:form.notes||null,status:'confirmed',
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
          {profs.map(p=><option key={p.id}value={p.id}>{p.name}</option>)}
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
                  <div style={{fontSize:9,opacity:.8,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{a.services?.name}{filterProf==='all'&&a.professionals?.name?` · ${a.professionals.name}`:''}</div>
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
      <Sel label="Profesional"value={form.prof_id}onChange={e=>setForm(f=>({...f,prof_id:e.target.value}))}options={[['','Seleccionar…'],...profs.map(p=>[p.id,p.name])]}/>
      <Sel label="Servicio"value={form.svc_id}onChange={e=>setForm(f=>({...f,svc_id:e.target.value}))}options={[['','Seleccionar…'],...services.map(s=>[s.id,`${s.name} (${s.duration_minutes}min)`])]}/>
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
          {profs.map(p=><option key={p.id}value={p.id}>{p.name}</option>)}
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
    sb.from('professionals').select('id,name,slot_duration').eq('is_active',true).order('name')
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

  useEffect(()=>{sb.from('professionals').select('id,name').eq('is_active',true).order('name')
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
      .select('id,patient_id,professional_id,service_id,created_at,notes,patients(full_name,phone),services(name,duration_minutes),professionals(name)')
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
    const dur=assignItem.services?.duration_minutes||60
    const endDT=new Date(startDT.getTime()+dur*60000)
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
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{item.patients?.phone||'Sin tel.'}{item.services?.name?` · ${item.services.name}`:''}{item.professionals?.name?` · ${item.professionals.name}`:''}</div>
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
        {assignItem.services?.name}{assignItem.professionals?.name?` · ${assignItem.professionals.name}`:''}
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
    const{data:svcs}=await sb.from('services').select('id,name').eq('section','yoga').eq('is_active',true)
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
      sb.from('appointments').select('id,start_time,status,professionals(name),services(name)').eq('patient_id',patId).order('start_time',{ascending:false}).limit(20),
      sb.from('bookings').select('id,status,created_at,availability_slots(start_time,services(name))').eq('patient_id',patId).order('created_at',{ascending:false}).limit(10),
    ])
    const a=(appts.data||[]).map(x=>({id:x.id,type:'osteo',typeLabel:'Osteopatía',name:x.services?.name||'Osteopatía',pro:x.professionals?.name,date:x.start_time,status:x.status}))
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

// ─── Belleza Admin ────────────────────────────────────────────────────────────
function BellezaAdmin(){
  const[appts,setAppts]=useState([])
  const[loading,setLoading]=useState(true)
  const[toast,setToast]=useState(null)
  const[tab,setTab]=useState('pending')
  const[modal,setModal]=useState(null) // appointment detail
  const TABS=[['pending','Pendientes'],['confirmed','Confirmadas'],['past','Pasadas'],['cancelled','Canceladas']]

  const load=useCallback(async()=>{
    setLoading(true)
    const now=new Date().toISOString()
    // Get beauty professionals
    const{data:pros}=await sb.from('professionals').select('id').eq('section','beauty')
    const proIds=(pros||[]).map(p=>p.id)
    if(proIds.length===0){setAppts([]);setLoading(false);return}

    let q=sb.from('appointments')
      .select('id,start_time,status,notes,patients(id,full_name,phone),professionals(id,name),services(name,duration_minutes)')
      .in('professional_id',proIds)
      .order('start_time',{ascending:tab!=='past'})

    if(tab==='pending')   q=q.eq('status','pending').gte('start_time',now)
    if(tab==='confirmed') q=q.eq('status','confirmed').gte('start_time',now)
    if(tab==='past')      q=q.lt('start_time',now).neq('status','cancelled')
    if(tab==='cancelled') q=q.eq('status','cancelled')

    const{data,error}=await q.limit(40)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});setLoading(false);return}
    setAppts(data||[]);setLoading(false)
  },[tab])
  useEffect(()=>{load()},[load])

  const updateStatus=async(id,status)=>{
    const{error}=await sb.from('appointments').update({status}).eq('id',id)
    if(error){setToast({msg:'Error: '+error.message,type:'error'});return}
    setModal(null)
    setToast({msg:status==='confirmed'?'Cita confirmada':'Cita cancelada',type:'ok'})
    load()
  }

  const pendingCount=tab==='pending'?appts.length:0

  return<>
    {toast&&<Toast msg={toast.msg}type={toast.type}onDone={()=>setToast(null)}/>}
    <div className="section-header">
      <span className="section-title">Citas de Belleza</span>
      <div className="tab-pills"style={{margin:0}}>
        {TABS.map(([id,l])=><button key={id}className={`tab-pill ${tab===id?'active':''}`}onClick={()=>setTab(id)}>{l}</button>)}
      </div>
    </div>

    {tab==='pending'&&pendingCount>0&&<div className="alert-banner"style={{cursor:'default'}}>
      <span style={{fontSize:20}}>⏳</span>
      <span className="alert-banner-text">{pendingCount} cita{pendingCount!==1?'s':''} pendiente{pendingCount!==1?'s':''} de confirmación</span>
    </div>}

    {loading&&<Sp/>}
    {!loading&&appts.length===0&&<Em icon="✨"title="Sin citas"sub={`No hay citas ${TABS.find(([id])=>id===tab)?.[1]?.toLowerCase()}`}/>}

    {!loading&&<div className="card"style={{overflow:'hidden'}}>
      {appts.map(a=>(
        <div key={a.id}className="dash-row"style={{cursor:'pointer'}}onClick={()=>setModal(a)}>
          <div style={{minWidth:48,textAlign:'right'}}>
            <div style={{fontSize:13,fontWeight:800,color:'var(--purple)'}}>{fTime(a.start_time)}</div>
            <div style={{fontSize:10,color:'var(--text-muted)'}}>{fD(a.start_time)}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.patients?.full_name||'—'}</div>
            <div style={{fontSize:11,color:'var(--text-muted)'}}>{a.notes||a.services?.name||'Belleza'}{a.professionals?.name?` · ${a.professionals.name}`:''}</div>
          </div>
          <Bg variant={STATUS_CLS[a.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[a.status]||a.status}</Bg>
        </div>
      ))}
    </div>}

    {modal&&<Modal title="Detalle de cita"onClose={()=>setModal(null)}>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={{fontWeight:700}}>{modal.patients?.full_name||'—'}</span>
          <Bg variant={STATUS_CLS[modal.status]?.replace('badge-','')||'gray'}>{STATUS_TXT[modal.status]||modal.status}</Bg>
        </div>
        <div style={{fontSize:13,color:'var(--text-muted)'}}>📞 {modal.patients?.phone||'Sin teléfono'}</div>
        <div style={{fontSize:13,color:'var(--text-muted)'}}>🗓 {fDT(modal.start_time)}</div>
        <div style={{fontSize:13,color:'var(--text-muted)'}}>✨ {modal.notes||modal.services?.name||'Belleza'}</div>
        {modal.professionals?.name&&<div style={{fontSize:13,color:'var(--text-muted)'}}>👩‍⚕️ {modal.professionals.name}</div>}
      </div>
      {modal.status==='pending'&&<div style={{display:'flex',gap:10}}>
        <Btn variant="danger"onClick={()=>updateStatus(modal.id,'cancelled')}style={{flex:1}}>Cancelar cita</Btn>
        <Btn variant="primary"onClick={()=>updateStatus(modal.id,'confirmed')}style={{flex:1}}>Confirmar</Btn>
      </div>}
      {modal.status==='confirmed'&&<Btn variant="danger"onClick={()=>updateStatus(modal.id,'cancelled')}style={{width:'100%'}}>Cancelar cita</Btn>}
      {(modal.status==='cancelled'||modal.status==='completed')&&<Btn variant="ghost"onClick={()=>setModal(null)}style={{width:'100%'}}>Cerrar</Btn>}
    </Modal>}
  </>
}

// ─── Servicios ────────────────────────────────────────────────────────────────
function Servicios(){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[form,setForm]=useState({name:'',duration_minutes:60,price:'',section:'osteopathy',is_active:true,description:''})
  const[delConfirm,setDelConfirm]=useState(null)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState(null)
  const CATS=[['osteopathy','Osteopatía'],['yoga','Yoga'],['beauty','Belleza']]
  const CAT_CLS={osteopathy:'osteopatia',yoga:'yoga',beauty:'belleza'}

  const load=useCallback(async()=>{
    setLoading(true)
    const{data,error}=await sb.from('services').select('*').order('name')
    if(error){setToast({msg:'Error al cargar: '+error.message,type:'error'});setLoading(false);return}
    setItems(data||[]);setLoading(false)
  },[])
  useEffect(()=>{load()},[load])

  const openNew=()=>{setForm({name:'',duration_minutes:60,price:'',section:'osteopathy',is_active:true,description:''});setModal('new')}
  const openEdit=svc=>{setForm({name:svc.name||'',duration_minutes:svc.duration_minutes||60,price:svc.price??'',section:svc.section||'osteopathy',is_active:svc.is_active!==false,description:svc.description||''});setModal(svc)}

  const save=async()=>{
    if(!form.name.trim())return
    setSaving(true)
    const payload={name:form.name.trim(),duration_minutes:Number(form.duration_minutes),price:form.price!==''?Number(form.price):null,section:form.section,is_active:form.is_active,description:form.description||null}
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
      :items.map(svc=><div key={svc.id}className="svc-row">
        <span className={`svc-cat svc-cat-${CAT_CLS[svc.section]||'otro'}`}>{CATS.find(([k])=>k===svc.section)?.[1]||svc.section}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:svc.is_active?'var(--text)':'var(--text-muted)',display:'flex',alignItems:'center',gap:8}}>
            {svc.name}
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
      </div>)}
    </div>

    {modal&&<Modal title={modal?.id?'Editar servicio':'Nuevo servicio'}onClose={()=>setModal(null)}>
      <Inp label="Nombre del servicio *"value={form.name}onChange={e=>setForm(f=>({...f,name:e.target.value}))}required placeholder="Ej: Consulta osteopatía"/>
      <Sel label="Sección"value={form.section}onChange={e=>setForm(f=>({...f,section:e.target.value}))}options={CATS}/>
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
      case 'belleza':    return<BellezaAdmin/>
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
