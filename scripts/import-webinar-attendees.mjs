#!/usr/bin/env node
// One-shot importer: tag webinar attendees in Supabase ghl_leads.
//
// Usage:
//   node scripts/import-webinar-attendees.mjs <csv-path> <tag>
// Example:
//   node scripts/import-webinar-attendees.mjs ~/Downloads/webinar.csv prisustvovao-31-05-2026
//
// Behavior:
//   - Reads the CSV, filters to rows where "Attended live" = Yes OR "Watched replay" = Yes.
//   - Matches each attendee by email against ghl_leads.
//   - For matches: appends <tag> to the lead's tags array (no-op if already there).
//   - For non-matches: inserts a new minimal lead row with the tag and a synthetic id
//     so the new attendees show up in the tracker too.

import fs from 'node:fs';
import readline from 'node:readline';

const SUPA_URL = 'https://ckwdfqfkkvjomlgojqjq.supabase.co';
const SUPA_KEY = 'sb_publishable_dDOsQkiJWIp8SgsUeh2fTA_Q_m6LUVr';

const [, , csvPath, tag] = process.argv;
if (!csvPath || !tag) {
  console.error('Usage: node scripts/import-webinar-attendees.mjs <csv-path> <tag>');
  process.exit(1);
}

// --- Tiny CSV parser (handles quoted fields with commas) ---
function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') { inQ = true; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const lines = raw.split(/\r?\n/).filter(Boolean);
const headers = parseCSVLine(lines[0]);
const idx = name => headers.indexOf(name);

const iFirst   = idx('First name');
const iLast    = idx('Last name');
const iPhone   = idx('Phone number');
const iEmail   = idx('Email');
const iAttLive = idx('Attended live');
const iReplay  = idx('Watched replay');
const iSrc     = idx('UTM source');
const iCamp    = idx('UTM campaign');
const iContent = idx('UTM content');

const attendees = [];
for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  const live = (row[iAttLive] || '').trim().toLowerCase() === 'yes';
  const rep  = (row[iReplay]  || '').trim().toLowerCase() === 'yes';
  if (!live && !rep) continue;
  const email = (row[iEmail] || '').trim().toLowerCase();
  if (!email) continue;
  attendees.push({
    email,
    first: (row[iFirst] || '').trim(),
    last:  (row[iLast]  || '').trim(),
    phone: (row[iPhone] || '').trim(),
    attended_live: live,
    watched_replay: rep,
    utm_source:   (row[iSrc]||'').trim() || null,
    utm_campaign: (row[iCamp]||'').trim() || null,
    utm_content:  (row[iContent]||'').trim() || null,
  });
}
console.log(`Found ${attendees.length} attendees in CSV.`);

// Supabase REST helpers
const supaHeaders = {
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};
const supa = (path, opts={}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...opts, headers: { ...supaHeaders, ...(opts.headers||{}) },
});

// --- Fetch existing leads matching these emails ---
const emails = [...new Set(attendees.map(a => a.email))];
const existing = new Map();  // email → { id, tags }
const CHUNK = 80;
for (let i = 0; i < emails.length; i += CHUNK) {
  const slice = emails.slice(i, i + CHUNK);
  // PostgREST in. filter, comma-separated, quote each
  const list = slice.map(e => `"${e.replace(/"/g,'\\"')}"`).join(',');
  const r = await supa(`ghl_leads?select=id,email,tags&email=in.(${encodeURIComponent(list)})`);
  if (!r.ok) {
    console.error('Fetch failed:', r.status, await r.text());
    process.exit(1);
  }
  const data = await r.json();
  data.forEach(l => existing.set((l.email||'').toLowerCase(), l));
}
console.log(`Matched ${existing.size}/${emails.length} existing leads by email.`);

// --- Update existing leads' tags ---
let updated = 0, alreadyTagged = 0, errors = 0;
for (const att of attendees) {
  const existRow = existing.get(att.email);
  if (!existRow) continue;
  const currentTags = Array.isArray(existRow.tags) ? existRow.tags : [];
  if (currentTags.includes(tag)) { alreadyTagged++; continue; }
  const newTags = [...currentTags, tag];
  const r = await supa(`ghl_leads?id=eq.${encodeURIComponent(existRow.id)}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ tags: newTags }),
  });
  if (!r.ok) { errors++; console.error('Update failed for', att.email, r.status, await r.text()); }
  else updated++;
}
console.log(`Tagged ${updated} existing leads (${alreadyTagged} already had the tag, ${errors} errors).`);

// --- Insert new leads for unmatched attendees ---
const newRows = attendees
  .filter(a => !existing.has(a.email))
  .map(a => {
    const name = [a.first, a.last].filter(Boolean).join(' ').trim() || a.email.split('@')[0];
    return {
      id: `webinar-${tag}-${a.email.replace(/[^a-zA-Z0-9]/g,'_')}`.slice(0, 80),
      email: a.email,
      name,
      phone: a.phone || null,
      tags: [tag, 'webinar-lead'],
      lead_type: 'webinar_attended',
      date_added: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      status: 'Novi',
      utm_source: a.utm_source,
      utm_campaign: a.utm_campaign,
      utm_content: a.utm_content,
    };
  });

let inserted = 0;
if (newRows.length) {
  // Upsert in chunks (on conflict id ignore)
  for (let i = 0; i < newRows.length; i += 200) {
    const slice = newRows.slice(i, i + 200);
    const r = await supa(`ghl_leads?on_conflict=id`, {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(slice),
    });
    if (!r.ok) {
      console.error('Insert chunk failed:', r.status, await r.text());
    } else {
      inserted += slice.length;
    }
  }
}
console.log(`Inserted ${inserted} new leads.`);
console.log('Done.');
