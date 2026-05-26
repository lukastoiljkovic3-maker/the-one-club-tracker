// Generate a personalized Serbian WhatsApp first-touch message for a lead.
// POST body: { lead: {...} }  →  { message: "Zdravo Marko, ..." }
const MODEL = 'claude-haiku-4-5';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const lead = body.lead || {};
  const firstName = (lead.name || '').split(' ')[0] || '';
  const repName = lead.assigned_to === 'mateja' ? 'Mateja'
               : lead.assigned_to === 'dusica' ? 'Dušica' : '';

  const ctx = [];
  if (lead.experience)    ctx.push(`Iskustvo: ${lead.experience}`);
  if (lead.knowledge)     ctx.push(`Nivo znanja: ${lead.knowledge}`);
  if (lead.time_frame)    ctx.push(`Vremenski okvir: ${lead.time_frame}`);
  if (lead.pain_point)    ctx.push(`Pain point: ${lead.pain_point}`);
  if (lead.qualification) ctx.push(`Kvalifikacija: ${lead.qualification}`);
  if (lead.notes)         ctx.push(`Beleške: ${lead.notes}`);
  if (Array.isArray(lead.tags) && lead.tags.length) ctx.push(`Tagovi: ${lead.tags.join(', ')}`);

  const attended = (lead.tags || []).includes('prisustvovao-webinaru');
  const qualified = (lead.tags || []).some(t => t === 'qualified' || t === 'qualified-webinar');

  const systemPrompt = `Ti pišeš prvu WhatsApp poruku potencijalnom klijentu za "The One Club" (forex trading akademija u Srbiji). Tim prodaje pakete Funded 10K/25K/50K/100K i Bootcamp.

Pravila:
- ISKLJUČIVO srpski (latinica), prirodan, neformalan ton (ti, ne Vi).
- Maks. 4 kratke rečenice + emoji ako prirodno pasuje (1-2 maks).
- BEZ "spam" izraza, BEZ velikih obećanja ("zaradi 10K za nedelju").
- Otvori personalno koristeći ime i konkretan detalj iz njegovih podataka.
- Ako je prisustvovao webinaru — pomeni to.
- Ako je qualified — direktno ponudi kratak poziv kao sledeći korak.
- Ako su podaci slabi — pitaj 1 pitanje koje otvara razgovor.
- ZAVRŠI sa pozivom na akciju (npr. "Kada bi ti odgovaralo 10-min poziv u toku ove nedelje?").
- Ne potpisuj se ako rep ime postoji u sistemu — vraćamo SAMO sadržaj poruke bez potpisa.

Vrati SAMO tekst poruke, bez objašnjenja, bez navodnika, bez prefix-a "Poruka:" — samo poruku spremnu za slanje.`;

  const userPrompt = `Lead:
Ime: ${firstName || 'nepoznato'}
${repName ? `Šalje: ${repName}` : ''}
${attended ? 'Prisustvovao webinaru: DA' : ''}
${qualified ? 'Kvalifikovan: DA' : ''}
${ctx.join('\n')}

Napiši prvu WhatsApp poruku.`;

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
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Claude API ${r.status}: ${t.slice(0, 240)}` });
    }
    const json = await r.json();
    const message = (json.content || []).map(c => c.text || '').join('').trim();
    if (!message) return res.status(500).json({ error: 'Empty AI response' });
    res.status(200).json({ message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
