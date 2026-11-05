"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight, Bell, BookOpenText, CalendarDays, Check, CheckCheck, ChevronDown,
  Circle, ClipboardList, Clock3, Cloud, CloudOff, FolderKanban, House, Inbox,
  LayoutDashboard, LogIn, LogOut, Menu, MessageCircle, Plus, Search, Send, Settings2,
  ShieldCheck, Sparkles, Trash2, X
} from "lucide-react";
import { browserSupabase, isCloudConfigured, loadLocal, saveLocal } from "@/lib/cloud";
import { applyProposals, brief, dayOffset, googleCalendarUrl, prioritise, proposeLocally, spaceName, visible } from "@/lib/engine";
import { AppData, emptyData, MemoryNote, Message, Priority, Project, Proposal, Scope, Space, Task, toDateLocal, uid } from "@/lib/types";

type Tab = "chat" | "tareas" | "proyectos" | "agenda" | "memoria";
const menu: {id:Tab;label:string;Icon:typeof MessageCircle}[] = [
  {id:"chat",label:"Mi secretaria",Icon:MessageCircle},
  {id:"tareas",label:"Pendientes",Icon:CheckCheck},
  {id:"proyectos",label:"Proyectos",Icon:FolderKanban},
  {id:"agenda",label:"Agenda",Icon:CalendarDays},
  {id:"memoria",label:"Memoria",Icon:BookOpenText}
];
const titleFor: Record<Tab,string> = {
  chat:"Tu secretaria", tareas:"Tus pendientes", proyectos:"Tus proyectos", agenda:"Tu agenda", memoria:"Tu memoria"
};
function formatDate(date:string) {
  return new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric"}).format(toDateLocal(date));
}
function proposalTitle(p:Proposal) {
  if(p.type==="create_task") return "Nueva tarea: " + p.title;
  if(p.type==="create_project") return "Nuevo proyecto: " + p.name;
  if(p.type==="add_note") return "Guardar nota: " + p.text;
  return "Marcar tarea como completada";
}
function isOverdue(t:Task) { return Boolean(t.due && !t.done && t.due < dayOffset(0)); }
function welcomeStats(data:AppData,scope:Scope){
  const b=brief(data,scope);
  if(!b.total) return "Tienes todo despejado. Puedes contarme lo que necesitas organizar.";
  const chunks=[b.total+" pendiente"+(b.total===1?"":"s")];
  if(b.overdue.length) chunks.push(b.overdue.length+" vencida"+(b.overdue.length===1?"":"s"));
  if(b.upcoming.length) chunks.push(b.upcoming.length+" próxima"+(b.upcoming.length===1?"":"s"));
  return "Hoy tienes "+chunks.join(", ")+".";
}
export default function Home() {
  const cloud = useMemo(() => browserSupabase(),[]);
  const [data,setData] = useState<AppData>(emptyData);
  const [scope,setScope] = useState<Scope>("profesional");
  const [tab,setTab] = useState<Tab>("chat");
  const [ready,setReady] = useState(false);
  const [email,setEmail] = useState<string|null>(null);
  const [loginEmail,setLoginEmail] = useState("");
  const [showLogin,setShowLogin] = useState(false);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [taskText,setTaskText] = useState("");
  const [taskDue,setTaskDue] = useState("");
  const [taskPriority,setTaskPriority] = useState<Priority>("media");
  const [taskProject,setTaskProject] = useState("");
  const [projectText,setProjectText] = useState("");
  const [noteText,setNoteText] = useState("");
  const [query,setQuery] = useState("");
  const [notice,setNotice] = useState("");
  const [mobileNav,setMobileNav] = useState(false);
  const messagesEnd=useRef<HTMLDivElement>(null);
  const currentSpace:Space=scope==="personal"?"personal":"profesional";
  const filteredTasks=useMemo(()=>visible(data.tasks,scope).filter(t=>t.title.toLowerCase().includes(query.toLowerCase())).sort(prioritise),[data.tasks,scope,query]);
  const filteredProjects=useMemo(()=>visible(data.projects,scope),[data.projects,scope]);
  const filteredNotes=useMemo(()=>visible(data.memories,scope).slice().reverse(),[data.memories,scope]);
  const filteredMessages=useMemo(()=>data.messages.filter(m=>(m as Message & {space?:Space}).space===currentSpace || !(m as Message & {space?:Space}).space),[data.messages,currentSpace]);
  const stats=useMemo(()=>brief(data,scope),[data,scope]);

  useEffect(()=>{
    let active=true;
    async function start(){
      const local=loadLocal();
      let initial=local;
      if(cloud){
        const {data:auth}=await cloud.auth.getSession();
        if(auth.session){
          const {data:row,error}=await cloud.from("secretaria_state").select("data").eq("user_id",auth.session.user.id).maybeSingle();
          if(row?.data && !error) initial=row.data as AppData;
          else if(!error) await cloud.from("secretaria_state").upsert({user_id:auth.session.user.id,data:local,updated_at:new Date().toISOString()});
          if(active) setEmail(auth.session.user.email || null);
        }
      }
      if(active){setData(initial);setReady(true);}
    }
    void start();
    return ()=>{active=false};
  },[cloud]);

  useEffect(()=>{
    if(!ready)return;
    saveLocal(data);
    if(!cloud || !email)return;
    const timer=setTimeout(async()=>{
      const {data:auth}=await cloud.auth.getSession();
      if(auth.session){
        const {error}=await cloud.from("secretaria_state").upsert({user_id:auth.session.user.id,data,updated_at:new Date().toISOString()});
        if(error)setNotice("No se pudo sincronizar. Tus cambios siguen guardados en este dispositivo.");
      }
    },850);
    return ()=>clearTimeout(timer);
  },[data,ready,cloud,email]);

  useEffect(()=>{if(tab==="chat")messagesEnd.current?.scrollIntoView({behavior:"smooth"});},[filteredMessages.length,tab]);

  async function login(){
    if(!cloud || !loginEmail.trim())return;
    const {error}=await cloud.auth.signInWithOtp({email:loginEmail.trim(),options:{emailRedirectTo:window.location.origin}});
    setNotice(error ? error.message : "Te hemos enviado un enlace de acceso al correo. Ábrelo en este dispositivo.");
    if(!error)setShowLogin(false);
  }
  async function logout(){
    if(cloud)await cloud.auth.signOut();
    window.localStorage.removeItem("mi-secretaria-ia:v1");
    setData(emptyData());setEmail(null);setNotice("Sesión cerrada. Se ha borrado la copia local de este dispositivo.");
  }
  function changeScope(next:Scope) {
    setScope(next);setQuery("");setMobileNav(false);
  }
  function addTask(){
    if(!taskText.trim())return;
    setData(prev=>applyProposals(prev,[{type:"create_task",title:taskText.trim(),space:currentSpace,due:taskDue||null,priority:taskPriority,project:data.projects.find(p=>p.id===taskProject)?.name}],currentSpace));
    setTaskText("");setTaskDue("");setTaskPriority("media");setTaskProject("");setNotice("Tarea guardada.");
  }
  function addProject(){
    if(!projectText.trim())return;
    setData(prev=>applyProposals(prev,[{type:"create_project",name:projectText,space:currentSpace}],currentSpace));
    setProjectText("");setNotice("Proyecto creado.");
  }
  function addNote(){
    if(!noteText.trim())return;
    setData(prev=>applyProposals(prev,[{type:"add_note",text:noteText,space:currentSpace}],currentSpace));
    setNoteText("");setNotice("Nota guardada.");
  }
  function toggleTask(id:string){
    setData(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}));
  }
  function deleteTask(id:string){
    setData(prev=>({...prev,tasks:prev.tasks.filter(t=>t.id!==id)}));
  }
  function removeProject(id:string){
    if(!window.confirm("¿Eliminar este proyecto? Las tareas se conservarán sin proyecto."))return;
    setData(prev=>({...prev,projects:prev.projects.filter(p=>p.id!==id),tasks:prev.tasks.map(t=>t.projectId===id?{...t,projectId:null}:t)}));
  }
  function applyMessage(id:string){
    setData(prev=>{
      const msg=prev.messages.find(m=>m.id===id);
      if(!msg || msg.applied || !msg.proposals?.length)return prev;
      const next=applyProposals(prev,msg.proposals,(msg as Message & {space?:Space}).space||currentSpace);
      return {...next,messages:next.messages.map(m=>m.id===id?{...m,applied:true}:m)};
    });
    setNotice("Cambios guardados.");
  }
  async function sendMessage(draft?:string){
    const text=(draft||message).trim();
    if(!text || busy)return;
    setMessage("");setBusy(true);setNotice("");
    const user:Message & {space:Space}={id:uid(),role:"user",text,space:currentSpace,createdAt:new Date().toISOString()};
    setData(prev=>({...prev,messages:[...prev.messages,user]}));
    let answer:{reply:string;proposals:Proposal[]}|null=null;
    if(cloud && email){
      try{
        const {data:auth}=await cloud.auth.getSession();
        const res=await fetch("/api/assistant",{
          method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+auth.session?.access_token},
          body:JSON.stringify({text,space:currentSpace,tasks:data.tasks,projects:data.projects,memories:data.memories,messages:data.messages.slice(-10)})
        });
        if(res.ok) answer=await res.json();
        else {const err=await res.json();setNotice(err.error||"La IA no responde. He utilizado el modo local.");}
      }catch{setNotice("No hay conexión con la IA. He utilizado el modo local.");}
    }
    if(!answer)answer=proposeLocally(text,currentSpace,data);
    const assistant:Message & {space:Space}={id:uid(),role:"assistant",text:answer.reply,proposals:answer.proposals,applied:false,space:currentSpace,createdAt:new Date().toISOString()};
    setData(prev=>({...prev,messages:[...prev.messages,assistant]}));setBusy(false);
  }
  const greeting=new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const overdue=stats.overdue.length;
  return (
    <div className="app-shell">
      <aside className={"sidebar "+(mobileNav?"sidebar-open":"")}>
        <div className="brand"><div className="brand-icon"><Sparkles size={22}/></div><div><strong>Mi Secretaria</strong><span>Tu asistente personal</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
        <div className="side-caption">TU ESPACIO</div>
        <div className="spaces">
          <button className={scope==="profesional"?"space selected":"space"} onClick={()=>changeScope("profesional")}><div className="space-symbol work"><FolderKanban size={16}/></div>Profesional {scope==="profesional"&&<Check size={15}/>}</button>
          <button className={scope==="personal"?"space selected":"space"} onClick={()=>changeScope("personal")}><div className="space-symbol personal"><House size={16}/></div>Personal {scope==="personal"&&<Check size={15}/>}</button>
          <button className={scope==="todos"?"space selected":"space"} onClick={()=>changeScope("todos")}><div className="space-symbol all"><LayoutDashboard size={16}/></div>Vista global {scope==="todos"&&<Check size={15}/>}</button>
        </div>
        <div className="side-caption side-separator">ORGANIZACIÓN</div>
        <nav aria-label="Menú principal">
          {menu.map(({id,label,Icon})=><button key={id} className={"nav-item "+(tab===id?"active":"")} onClick={()=>{setTab(id);setMobileNav(false);setQuery("");}}><Icon size={19}/><span>{label}</span>{id==="tareas"&&stats.total>0&&<small>{stats.total}</small>}</button>)}
        </nav>
        <div className="side-bottom">
          <div className="side-info"><ShieldCheck size={18}/><span>Solo información personal y administrativa. No introduzcas datos clínicos.</span></div>
          {isCloudConfigured ?
            (email?<button className="account-btn" onClick={logout}><Cloud size={17}/><span className="account-email">{email}</span><LogOut size={16}/></button>:
            <button className="account-btn" onClick={()=>setShowLogin(true)}><LogIn size={18}/> Iniciar sesión para sincronizar</button>):
            <div className="account-btn account-static"><CloudOff size={18}/>Modo local · sin sincronización</div>}
        </div>
      </aside>
      {mobileNav&&<button className="mobile-shade" aria-label="Cerrar menú" onClick={()=>setMobileNav(false)}/>}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Abrir menú" onClick={()=>setMobileNav(true)}><Menu size={23}/></button>
          <div className="crumb"><span>Mi espacio</span><ArrowRight size={13}/><strong>{titleFor[tab]}</strong></div>
          <div className="top-actions"><span className="today-small">{greeting}</span><span className={"status-pill "+(email?"online":"")}><Circle size={7} fill="currentColor"/>{email?"Sincronizada":"Modo local"}</span></div>
        </header>
        {!ready ? <div className="loading">Preparando tu espacio…</div> : <>
          <div className="content-wrap">
            {tab==="chat"&&<div className="chat-view">
              <div className="intro">
                <div className="eyebrow"><Sparkles size={16}/> TU ESPACIO PARA ORGANIZARTE</div>
                <h1>Buenos días, ¿por dónde empezamos?</h1>
                <p>{welcomeStats(data,scope)}</p>
              </div>
              <div className="summary-grid">
                <button className="summary-card" onClick={()=>setTab("tareas")}><div className="mini-icon"><ClipboardList size={19}/></div><div><strong>{stats.total}</strong><span>Por hacer</span></div><ArrowRight className="card-arrow" size={17}/></button>
                <button className="summary-card" onClick={()=>setTab("tareas")}><div className="mini-icon amber"><Bell size={19}/></div><div><strong>{overdue}</strong><span>Vencidas</span></div><ArrowRight className="card-arrow" size={17}/></button>
                <button className="summary-card" onClick={()=>setTab("agenda")}><div className="mini-icon blue"><CalendarDays size={19}/></div><div><strong>{stats.upcoming.length}</strong><span>Próximos 7 días</span></div><ArrowRight className="card-arrow" size={17}/></button>
              </div>
              {stats.total>0&&<div className="attention"><div className="attention-heading"><span><Bell size={16}/> REQUIEREN ATENCIÓN</span><button onClick={()=>setTab("tareas")}>Ver todas <ArrowRight size={15}/></button></div>
                {stats.tasks.slice().sort(prioritise).slice(0,3).map(t=><div className="attention-row" key={t.id}><button className="round-check" aria-label="Completar" onClick={()=>toggleTask(t.id)}><Circle size={21}/></button><div className="attention-copy"><strong>{t.title}</strong><span>{t.due ? (isOverdue(t)?"Vencida · ":"")+formatDate(t.due):spaceName(t.space)+" · Sin fecha"}</span></div>{t.priority==="alta"&&<span className="priority high">Prioritaria</span>}</div>)}
              </div>}
              <section className="chat-panel">
                <div className="chat-heading"><span><span className="assistant-avatar"><Sparkles size={17}/></span><strong>Conversación</strong></span><small>{scope==="todos"?"El chat guarda las nuevas tareas en Profesional":spaceName(currentSpace)}</small></div>
                <div className="message-list" aria-live="polite">
                  {filteredMessages.length===0&&<div className="empty-chat"><div className="assistant-avatar big"><Sparkles size={24}/></div><strong>Cuéntame qué tienes en mente</strong><p>Puedes dictarme pendientes, iniciar proyectos o preguntarme qué requiere atención.</p>
                    <div className="suggestions"><button onClick={()=>void sendMessage("¿Qué tengo pendiente?")}>¿Qué tengo pendiente?</button><button onClick={()=>setMessage("Recuérdame revisar ")}>Añadir recordatorio</button><button onClick={()=>setMessage("Crea un proyecto llamado ")}>Nuevo proyecto</button></div>
                  </div>}
                  {filteredMessages.map(m=><div key={m.id} className={"message "+m.role}><div className={"bubble "+m.role}>{m.text.split("\n").map((x,i)=><span key={i}>{x}<br/></span>)}</div>
                    {m.role==="assistant"&&Boolean(m.proposals?.length)&&<div className="proposals">
                      <span className="proposal-caption">CAMBIOS PROPUESTOS · PENDIENTES DE CONFIRMACIÓN</span>
                      {m.proposals?.map((p,i)=><div className="proposal-item" key={i}><ClipboardList size={16}/><span>{proposalTitle(p)}</span></div>)}
                      <button className="btn-primary small" disabled={Boolean(m.applied)} onClick={()=>applyMessage(m.id)}>{m.applied?<><Check size={16}/> Guardado</>:<><Check size={16}/> Confirmar y guardar</>}</button>
                    </div>}
                  </div>)}
                  {busy&&<div className="typing"><span/><span/><span/></div>}
                  <div ref={messagesEnd}/>
                </div>
                <form className="composer" onSubmit={e=>{e.preventDefault();void sendMessage();}}>
                  <input aria-label="Escribe a tu secretaria" maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Escribe lo que necesitas organizar…"/>
                  <button type="submit" disabled={!message.trim()||busy} aria-label="Enviar mensaje"><Send size={18}/></button>
                </form>
                <div className="composer-caption">{email?"Las propuestas necesitan tu confirmación.":"Modo local: reconoce órdenes sencillas. Activa Supabase y OpenAI para el chat con IA."}</div>
              </section>
            </div>}

            {tab==="tareas"&&<div className="page-view">
              <div className="page-title"><div><span className="eyebrow">ORDENA TUS PRIORIDADES</span><h1>Tareas y pendientes</h1><p>Todo lo que tienes abierto, sin perder nada por el camino.</p></div><span className="count-pill">{stats.total} pendientes</span></div>
              <form className="add-box" onSubmit={e=>{e.preventDefault();addTask();}}>
                <div className="add-main"><Plus size={20}/><input value={taskText} onChange={e=>setTaskText(e.target.value)} placeholder="¿Qué tienes que hacer?" aria-label="Nueva tarea"/></div>
                <div className="add-options"><label>Fecha <input aria-label="Fecha límite" type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><label>Prioridad <select value={taskPriority} onChange={e=>setTaskPriority(e.target.value as Priority)}><option value="media">Media</option><option value="alta">Alta</option><option value="baja">Baja</option></select></label><label>Proyecto <select value={taskProject} onChange={e=>setTaskProject(e.target.value)}><option value="">Sin proyecto</option>{data.projects.filter(p=>p.space===currentSpace).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn-primary" disabled={!taskText.trim()} type="submit">Añadir <Plus size={16}/></button></div>
              </form>
              <div className="list-toolbar"><strong>Listado de tareas</strong><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tareas" aria-label="Buscar tareas"/></div></div>
              <div className="task-list">{filteredTasks.length===0?<div className="blank"><CheckCheck size={28}/><strong>Sin tareas en este espacio</strong><span>Añade una arriba o cuéntaselo a tu secretaria.</span></div>:filteredTasks.map(t=><div key={t.id} className={"task-item "+(t.done?"completed":"")}><button className="task-toggle" aria-label={t.done?"Reabrir tarea":"Completar tarea"} onClick={()=>toggleTask(t.id)}>{t.done?<CheckCheck size={23}/>:<Circle size={23}/>}</button><div className="task-main"><strong>{t.title}</strong><span>{spaceName(t.space)}{t.projectId&&data.projects.find(p=>p.id===t.projectId)?" · "+data.projects.find(p=>p.id===t.projectId)?.name:""}</span></div><div className="task-end">{t.due&&<span className={"date-label "+(isOverdue(t)?"late":"")}><Clock3 size={14}/>{formatDate(t.due)}</span>}<span className={"priority "+(t.priority==="alta"?"high":t.priority==="baja"?"low":"")}>{t.priority}</span><button className="delete-btn" onClick={()=>deleteTask(t.id)} aria-label="Eliminar tarea"><Trash2 size={17}/></button></div></div>)}</div>
            </div>}

            {tab==="proyectos"&&<div className="page-view">
              <div className="page-title"><div><span className="eyebrow">TUS FRENTES ABIERTOS</span><h1>Proyectos</h1><p>Un lugar para cada iniciativa, idea o compromiso.</p></div></div>
              <form className="add-box inline-add" onSubmit={e=>{e.preventDefault();addProject()}}><Plus size={21}/><input value={projectText} onChange={e=>setProjectText(e.target.value)} placeholder="Nombre del nuevo proyecto" aria-label="Nombre del proyecto"/><button className="btn-primary" type="submit" disabled={!projectText.trim()}>Crear proyecto</button></form>
              <div className="project-grid">{filteredProjects.length===0?<div className="blank span-all"><FolderKanban size={28}/><strong>Todavía no tienes proyectos</strong><span>Empieza por uno: tu web, una presentación o un plan personal.</span></div>:filteredProjects.map(p=>{
                const tasks=data.tasks.filter(t=>t.projectId===p.id);const completed=tasks.filter(t=>t.done).length;
                return <div className="project-card" key={p.id}><div className="project-top"><span className="project-symbol"><FolderKanban size={22}/></span><button className="delete-btn" aria-label="Eliminar proyecto" onClick={()=>removeProject(p.id)}><Trash2 size={17}/></button></div><strong>{p.name}</strong><span className="project-space">{spaceName(p.space)}</span><div className="project-progress"><div style={{width:(tasks.length?completed/tasks.length*100:0)+"%"}}/></div><div className="project-footer"><span>{completed} de {tasks.length} tareas completadas</span><button onClick={()=>{setScope(p.space);setTab("tareas");setQuery("");}}>Ver tareas <ArrowRight size={14}/></button></div></div>
              })}</div>
            </div>}

            {tab==="agenda"&&<div className="page-view">
              <div className="page-title"><div><span className="eyebrow">PRÓXIMAS FECHAS</span><h1>Agenda</h1><p>Revisa vencimientos y prepara eventos para tu calendario.</p></div></div>
              <div className="info-strip"><CalendarDays size={20}/><div><strong>Google Calendar, siempre bajo tu control.</strong><span>Pulsa «Preparar en Calendar» para abrir un evento con la información lista. Tú decides si lo guardas.</span></div></div>
              <div className="agenda-list">{visible(data.tasks,scope).filter(t=>t.due&&!t.done).sort((a,b)=>(a.due||"").localeCompare(b.due||"")).length===0?<div className="blank"><CalendarDays size={28}/><strong>No hay fechas programadas</strong><span>Añade una fecha a tus tareas y aparecerán aquí.</span></div>:visible(data.tasks,scope).filter(t=>t.due&&!t.done).sort((a,b)=>(a.due||"").localeCompare(b.due||"")).map(t=><div className="agenda-item" key={t.id}><div className="agenda-day"><strong>{toDateLocal(t.due!).getDate()}</strong><span>{new Intl.DateTimeFormat("es-ES",{month:"short"}).format(toDateLocal(t.due!))}</span></div><div className="agenda-copy"><strong>{t.title}</strong><span>{spaceName(t.space)}{isOverdue(t)?" · Fecha vencida":""}</span></div><a href={googleCalendarUrl(t)} target="_blank" rel="noopener noreferrer" className="btn-outline">Preparar en Calendar <ArrowRight size={15}/></a></div>)}</div>
            </div>}

            {tab==="memoria"&&<div className="page-view">
              <div className="page-title"><div><span className="eyebrow">LO QUE IMPORTA RECORDAR</span><h1>Memoria</h1><p>Guarda decisiones, ideas y detalles que quieras recuperar.</p></div></div>
              <form className="add-box note-form" onSubmit={e=>{e.preventDefault();addNote()}}><textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Escribe algo que quieras recordar…" aria-label="Nueva nota"/><div className="form-bottom"><small>Una nota que se quedará contigo y ayudará a contextualizar tus conversaciones.</small><button type="submit" className="btn-primary" disabled={!noteText.trim()}>Guardar nota <Plus size={16}/></button></div></form>
              <div className="notes-grid">{filteredNotes.length===0?<div className="blank span-all"><BookOpenText size={28}/><strong>Tu memoria está esperando</strong><span>Empieza guardando una idea o una decisión pendiente.</span></div>:filteredNotes.map(n=><div className="note-card" key={n.id}><div className="note-top"><span>{spaceName(n.space)} · {formatDate(n.createdAt.slice(0,10))}</span><button aria-label="Eliminar nota" className="delete-btn" onClick={()=>setData(prev=>({...prev,memories:prev.memories.filter(x=>x.id!==n.id)}))}><Trash2 size={17}/></button></div><p>{n.text}</p></div>)}</div>
            </div>}
          </div>
        </>}
      </main>
      {notice&&<div className="toast" role="status"><span>{notice}</span><button aria-label="Cerrar aviso" onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {showLogin&&<div className="modal-backdrop" onClick={()=>setShowLogin(false)}><div className="modal" role="dialog" aria-modal="true" aria-label="Iniciar sesión" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowLogin(false)} aria-label="Cerrar"><X size={19}/></button><div className="brand-icon modal-icon"><ShieldCheck size={25}/></div><h2>Tu espacio, en todos tus dispositivos</h2><p>Introduce tu correo para recibir un enlace de acceso. Tus tareas se guardarán en tu cuenta privada de Supabase.</p><form onSubmit={e=>{e.preventDefault();void login()}}><input type="email" required placeholder="tu@correo.com" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}/><button className="btn-primary">Enviar enlace de acceso <ArrowRight size={16}/></button></form></div></div>}
    </div>
  );
}
