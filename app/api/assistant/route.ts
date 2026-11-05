import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const system = [
  "Eres una secretaria personal organizada, cálida, concisa y profesional. Habla en español de España.",
  "Ayudas a organizar proyectos, tareas y notas personales y profesionales, sin datos clínicos.",
  "No envías correos, no creas eventos en cuentas externas y no realizas acciones por tu cuenta.",
  "Si el usuario dicta un pendiente o proyecto, PROPÓN una acción. Todo cambio se confirma en la interfaz.",
  "Usa la fecha actual proporcionada y fechas exactas YYYY-MM-DD. No inventes fechas si no las conoces.",
  "Devuelve SOLO JSON válido: {\"reply\":\"texto claro\",\"proposals\":[{\"type\":\"create_task\",\"title\":\"...\",\"space\":\"personal|profesional\",\"due\":null,\"priority\":\"media\",\"description\":\"...\",\"project\":\"...\"}]}",
  "Otras propuestas válidas: {\"type\":\"create_project\",\"name\":\"...\",\"space\":\"...\"}, {\"type\":\"add_note\",\"text\":\"...\",\"space\":\"...\"}, {\"type\":\"complete_task\",\"taskId\":\"id real\"}.",
  "Si no hay cambios concretos, proposals será []. Las fechas relativas deben resolverse con la fecha actual.",
  "Nunca propongas una tarea que incluya datos sanitarios identificables de un paciente.",
  "Limita proposals a cinco y reply a 600 caracteres. No inventes identificadores.",
].join("\n");

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!apiKey || !owner || !supabaseUrl || !anonKey) {
    return NextResponse.json({error:"La IA requiere las credenciales del servidor y una cuenta autorizada."},{status:503});
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /i,"");
  if (!token) return NextResponse.json({error:"Inicia sesión para usar la IA."},{status:401});
  const supabase = createClient(supabaseUrl, anonKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const auth = await supabase.auth.getUser(token);
  if (auth.error || !auth.data.user || auth.data.user.email?.toLowerCase() !== owner) {
    return NextResponse.json({error:"Acceso no autorizado."},{status:403});
  }
  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({error:"Solicitud incorrecta."},{status:400}); }
  const text = String(payload.text || "").slice(0,4000);
  const space = payload.space === "personal" ? "personal" : "profesional";
  if (!text.trim()) return NextResponse.json({error:"Mensaje vacío."},{status:400});
  const context = {
    space,
    today:new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Madrid"}),
    tasks:Array.isArray(payload.tasks) ? payload.tasks.slice(0,80).map((t:any)=>({id:String(t.id).slice(0,50),title:String(t.title).slice(0,160),due:t.due,done:Boolean(t.done),space:t.space,priority:t.priority})) : [],
    projects:Array.isArray(payload.projects) ? payload.projects.slice(0,35).map((p:any)=>({name:String(p.name).slice(0,100),space:p.space})) : [],
    memories:Array.isArray(payload.memories) ? payload.memories.slice(-30).map((n:any)=>({text:String(n.text).slice(0,350),space:n.space})) : [],
    recentMessages:Array.isArray(payload.messages) ? payload.messages.slice(-10).map((m:any)=>({role:m.role,text:String(m.text).slice(0,700)})) : []
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer " + apiKey},
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature:0.25,
      response_format:{type:"json_object"},
      max_tokens:850,
      messages:[{role:"system",content:system},{role:"user",content:"Contexto de la aplicación: "+JSON.stringify(context)+"\n\nSolicitud actual: "+text}]
    }),
    cache:"no-store",
    signal:AbortSignal.timeout(25000)
  }).catch(() => null);
  if (!response?.ok) return NextResponse.json({error:"Ahora mismo no puedo contactar con el modelo de IA."},{status:502});
  try {
    const json = await response.json();
    const data = JSON.parse(json.choices?.[0]?.message?.content || "{}");
    const allowed = new Set(["create_task","create_project","add_note","complete_task"]);
    const proposals = Array.isArray(data.proposals) ? data.proposals.filter((p:any)=>{
      if(!p || !allowed.has(p.type)) return false;
      if(p.type === "create_task") return typeof p.title === "string" && p.title.trim().length > 0;
      if(p.type === "create_project") return typeof p.name === "string" && p.name.trim().length > 0;
      if(p.type === "add_note") return typeof p.text === "string" && p.text.trim().length > 0;
      if(p.type === "complete_task") return typeof p.taskId === "string";
      return false;
    }).slice(0,5).map((p:any)=>({
      ...p,
      space: p.space === "personal" ? "personal" : p.space === "profesional" ? "profesional" : space,
      project: typeof p.project === "string" ? p.project.slice(0,140) : undefined,
      due: typeof p.due === "string" ? p.due : null
    })) : [];
    return NextResponse.json({reply:String(data.reply || "He revisado tu petición.").slice(0,1200),proposals});
  } catch {
    return NextResponse.json({error:"La respuesta de la IA no se pudo interpretar."},{status:502});
  }
}
