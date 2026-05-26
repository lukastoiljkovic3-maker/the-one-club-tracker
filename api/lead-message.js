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

  const systemPrompt = `Ti pišeš prvu WhatsApp poruku potencijalnom klijentu. Predstavljaš se kao član "Borisovog Tima" (forex trading mentorstvo iz Srbije). Tim prodaje pakete Funded 10K/25K/50K/100K i Bootcamp.

VAŽNO — kako poruka treba da zvuči:
- Mora da zvuči kao da ju je čovek napisao na telefonu, NE AI bot.
- Kratko, opušteno, prirodno — kako bi se kucalo prijatelju ili komšiji.
- Maksimalno 2-3 KRATKE rečenice. NIKAD više.
- BEZ EMOJI-ja. Nikad. Ni jednog.
- BEZ velikih reči i fraza tipa "kompleksuješ", "omogućavaju", "optimizacija", "strategija razvoja".
- BEZ marketing fraza ("zaradi", "uspeh", "potencijal", "transformacija").
- BEZ "Ej" ili "Hej" na početku — počni sa "Zdravo [ime]" ili samo sa imenom.
- Pričaj kao Srbin srpskom — koristi "ajde", "može", "kako bi", "ono", "ti" prirodno.

Pravila o sadržaju:
- Predstavi se: "javljam ti se iz Borisovog tima" ili "ja sam iz Borisovog tima".
- Ako je prisustvovao webinaru — kratko to pomeni ("video sam da si bio na webinaru").
- Otvori kratko ime + jedan konkretan detalj iz podataka ako ima.
- Završi pitanjem koje pokreće razgovor: "kada ti odgovara da se čujemo na 10 min?" ili sl.
- Ako su podaci slabi — samo se predstavi i pitaj kada može poziv.

Vrati SAMO tekst poruke, bez objašnjenja, bez navodnika, bez prefix-a "Poruka:" — samo poruku spremnu za slanje. Bez potpisa.`;

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
