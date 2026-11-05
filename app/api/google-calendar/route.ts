import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ical from "node-ical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  days: string[];
  allDay: boolean;
  location: string | null;
};

function localDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function daysIncluded(start: Date, end: Date, allDay: boolean) {
  const first = localDay(start, allDay ? "UTC" : "Europe/Madrid");
  const last = localDay(new Date(Math.max(end.getTime() - 1, start.getTime())), allDay ? "UTC" : "Europe/Madrid");
  const days: string[] = [];
  const cursor = new Date(first + "T12:00:00Z");
  for (let i = 0; i < 40; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (key > last) break;
    days.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function checkOwner(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!supabaseUrl || !anon || !owner || !token) return false;
  const client = createClient(supabaseUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && !!data.user?.email && data.user.email.toLowerCase() === owner;
}

export async function GET(req: NextRequest) {
  // La dirección iCal es un secreto. Nunca se devuelve al navegador ni se registra.
  const allowed = await checkOwner(req);
  if (!allowed) {
    return NextResponse.json(
      { error: "Inicia sesión con tu cuenta principal para ver Calendar." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const icalSecret = process.env.GOOGLE_CALENDAR_ICAL_URL?.trim();
  if (!icalSecret) return NextResponse.json(
    { status: "not_configured", events: [] },
    { headers: { "Cache-Control": "no-store" } }
  );

  // Previene acceder desde el servidor a URL arbitrarias (SSRF).
  let feedUrl: URL;
  try {
    feedUrl = new URL(icalSecret);
  } catch {
    return NextResponse.json({ error: "La dirección privada de Calendar no es válida." }, { status: 503 });
  }
  if (
    feedUrl.protocol !== "https:" ||
    feedUrl.hostname !== "calendar.google.com" ||
    !feedUrl.pathname.startsWith("/calendar/ical/") ||
    !feedUrl.pathname.endsWith(".ics")
  ) {
    return NextResponse.json({ error: "Configura una dirección iCal secreta de Google Calendar válida." }, { status: 503 });
  }

  const month = req.nextUrl.searchParams.get("month") || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Mes incorrecto." }, { status: 400 });
  }
  const [year, num] = month.split("-").map(Number);
  if (year < 2020 || year > 2100) return NextResponse.json({ error: "Mes fuera del intervalo." }, { status: 400 });

  const from = new Date(Date.UTC(year, num - 1, 1) - 40 * 86400000);
  const to = new Date(Date.UTC(year, num + 1, 1) + 40 * 86400000);

  try {
    const response = await fetch(feedUrl.toString(), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(14000),
      headers: { Accept: "text/calendar,text/plain;q=0.8" }
    });
    if (!response.ok) throw new Error("ICS_HTTP_" + response.status);
    if (Number(response.headers.get("content-length") || "0") > 5_000_000) throw new Error("ICS_TOO_LARGE");
    const raw = await response.text();
    if (raw.length > 5_000_000 || !raw.includes("BEGIN:VCALENDAR")) throw new Error("ICS_INVALID");

    const parsed = await ical.async.parseICS(raw);
    type Entry = {
      type?: string; uid?: string; summary?: string;
      location?: string; rrule?: unknown; datetype?: string;
      start?: Date & { dateOnly?: boolean };
      end?: Date;
      isFullDay?: boolean;
    };
    const expand = ical.expandRecurringEvent as unknown as (
      event: Entry, options: { from: Date; to: Date }
    ) => Entry[];
    const events: CalendarEvent[] = [];

    for (const rawEvent of Object.values(parsed)) {
      const event = rawEvent as Entry;
      if (event?.type !== "VEVENT" || !event.start) continue;
      const instances = event.rrule ? expand(event, { from, to }) : [event];

      for (const instance of instances) {
        const start = instance.start ? new Date(instance.start) : new Date(event.start);
        const end = instance.end ? new Date(instance.end) : (
          event.end && event.start ? new Date(start.getTime() + (new Date(event.end).getTime() - new Date(event.start).getTime())) : new Date(start.getTime() + 3600000)
        );
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        if (start > to || end < from) continue;
        const allDay = Boolean(instance.isFullDay || event.datetype === "date" || event.start.dateOnly);
        events.push({
          id: String(event.uid || "evento") + ":" + start.toISOString(),
          title: String(instance.summary || event.summary || "Evento sin título").slice(0,220),
          start: start.toISOString(),
          end: end.toISOString(),
          days: daysIncluded(start, end, allDay),
          allDay,
          location: instance.location || event.location ? String(instance.location || event.location).slice(0,250) : null
        });
        if (events.length >= 750) break;
      }
      if (events.length >= 750) break;
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json(
      { status: "connected", events, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "No he podido leer el Calendar privado. Comprueba la dirección iCal en Vercel." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
