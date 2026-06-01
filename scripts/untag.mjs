#!/usr/bin/env node
// One-shot: remove a tag from all leads that have it.
// Usage: node scripts/untag.mjs <tag>

const SUPA_URL = 'https://ckwdfqfkkvjomlgojqjq.supabase.co';
const SUPA_KEY = 'sb_publishable_dDOsQkiJWIp8SgsUeh2fTA_Q_m6LUVr';
const [, , tag] = process.argv;
if (!tag) { console.error('Usage: node scripts/untag.mjs <tag>'); process.exit(1); }

const H = {
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

const filter = `tags=cs.%7B${encodeURIComponent(tag)}%7D`;
const r = await fetch(`${SUPA_URL}/rest/v1/ghl_leads?${filter}&select=id,tags&limit=5000`, { headers: H });
const leads = await r.json();
console.log(`Found ${leads.length} leads with tag "${tag}".`);
let ok = 0, fail = 0;
for (const l of leads) {
  const newTags = (l.tags || []).filter(t => t !== tag);
  const u = await fetch(`${SUPA_URL}/rest/v1/ghl_leads?id=eq.${encodeURIComponent(l.id)}`, {
    method: 'PATCH',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ tags: newTags }),
  });
  if (u.ok) ok++; else { fail++; console.error('Failed:', l.id, u.status, await u.text()); }
}
console.log(`Untagged ${ok} leads (${fail} errors).`);
