// AI summary for a single lead using Anthropic's Claude API.
// Reads ANTHROPIC_API_KEY from Vercel env vars.
// POST body: { lead: { name, experience, knowledge, time_frame, pain_point, qualification, notes, tags, status, ... } }

const MODEL = 'claude-haiku-4-5';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY missing. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const lead = body.lead || {};
  const fields = [];
  if (lead.name)          fields.push(`Ime: ${lead.name}`);
  if (lead.status)        fields.push(`Status: ${lead.status}`);
  if (lead.experience)    fields.push(`Iskustvo: ${lead.experience}`);
  if (lead.knowledge)     fields.push(`Nivo znanja: ${lead.knowledge}`);
  if (lead.time_frame)    fields.push(`Vremenski okvir: ${lead.time_frame}`);
  if (lead.pain_point)    fields.push(`Pain point: ${lead.pain_point}`);
  if (lead.qualification) fields.push(`Kvalifikacija (slobodan tekst): ${lead.qualification}`);
  if (lead.notes)         fields.push(`Beleške rep-a: ${lead.notes}`);
  if (Array.isArray(lead.tags) && lead.tags.length) fields.push(`Tagovi: ${lead.tags.join(', ')}`);
  if (lead.assigned_to)   fields.push(`Dodeljen: ${lead.assigned_to}`);
  if (lead.follow_up_date)fields.push(`Sledeći follow-up: ${lead.follow_up_date}`);

  if (fields.length < 2) {
    return res.status(200).json({ summary: 'Nedovoljno podataka za AI sažetak. Popuni kvalifikaciju ili beleške i pokušaj ponovo.' });
  }

  const systemPrompt = `Ti si pomoćnik prodajnom timu firme "The One Club" (forex trading akademija sa sedištem u Srbiji). Tim zatvara klijente na pakete tipa Funded 10K/25K/50K/100K i Bootcamp. Tvoj zadatak je da na osnovu sirovih podataka o leadu napišeš kratak, konkretan brief za prodavca.

Pravila:
- Piši ISKLJUČIVO na srpskom (latinica).
- Odgovor ima maksimalno 3 rečenice, bez bullet pointa.
- 1. rečenica: ko je lead i glavna motivacija (npr. "Početnik koji traži dodatni izvor prihoda").
- 2. rečenica: koliko je "vruć" — vruć / topao / hladan — i ZAŠTO baš to.
- 3. rečenica: konkretan sledeći korak za rep-a (npr. "Zovi do 24h i ponudi 25K paket sa fokusom na risk management").
- Ne ponavljaj sirove podatke doslovno. Sintezuj.
- Ako su informacije siromašne, jasno reci "Malo podataka — pozovi i pitaj o budžetu i vremenu."`;

  const userPrompt = `Podaci o leadu:\n\n${fields.join('\n')}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 350,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Claude API ${r.status}: ${t.slice(0, 240)}` });
    }
    const json = await r.json();
    const summary = (json.content || []).map(c => c.text || '').join('').trim();
    if (!summary) return res.status(500).json({ error: 'Empty AI response' });
    res.status(200).json({ summary, model: json.model });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
