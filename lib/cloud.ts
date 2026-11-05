import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppData, emptyData } from "./types";

const KEY = "mi-secretaria-ia:v1";
export const isCloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export function browserSupabase(): SupabaseClient | null {
  if (!isCloudConfigured) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
}
export function loadLocal(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch { return emptyData(); }
}
export function saveLocal(data: AppData) {
  window.localStorage.setItem(KEY, JSON.stringify(data));
}
