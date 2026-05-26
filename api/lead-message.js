// Generate a personalized Serbian WhatsApp message for a lead.
// POST body: { lead: {...}, scenario?: 'first-touch' | 'no-pickup' | 'asked-info' | 'cant-now' | 'post-call' | 'closing-nudge' }
//   → { message }
const MODEL = 'claude-haiku-4-5';

const SCENARIO_PROMPTS = {
  'first-touch': `Ovo je PRVA poruka leadu koji je bio na predavanju u nedelju (ili je samo prijavljen).

Format (drži se ovog tačno):
"Ćao [ime], ovde [rep] iz Borisovog tima, vidim da si bio na predavanju u nedelju. Jel imaš sekund?"

Ako NIJE prisustvovao predavanju:
"Ćao [ime], ovde [rep] iz Borisovog tima. Jel imaš sekund?"

Ako ime nije poznato — preskoči ", [ime]".
Ako rep nije poznat — koristi "javljam ti se" umesto "ovde [rep]".

Vrati SAMO tekst poruke, 2 rečenice maksimum.`,

  'no-pickup': `Ovo je FOLLOW-UP poruka za leada koji se NIJE javio na prethodni poziv. Već si već pokušao da ga dobiješ.

Stil:
- Lagano, bez pritiska. Nije ljutnja, samo provera.
- Maks 2 KRATKE rečenice.
- Ne objašnjavaj zašto si zvao.
- Završi sa otvorenim pozivom da odgovori kada može.

Primer dobre poruke:
"[ime], pokušao sam da te dobijem ranije. Kada ti odgovara, javi se na poruku pa se čujemo."

Drugi primeri:
"Ej [ime], nisam mogao da te dobijem. Daj mi ti znak kada budeš slobodan."
"[ime], video sam da si zauzet. Javi mi kada budeš mogao za 5-10 min razgovor."`,

  'asked-info': `Lead je tražio dodatne informacije ali NIJE više odgovorio. Ovo je nudge da nastavi razgovor.

Stil:
- Prisetiti ga, bez pritiska.
- Maks 2 rečenice.
- Pitati ga da li je razmislio / ima pitanja.

Primer:
"[ime], jesi imao priliku da pogledaš ono što sam ti poslao? Ako imaš pitanje, slobodno pitaj."

Drugi:
"Ej [ime], jesi razmislio o onome o čemu smo pričali?"`,

  'cant-now': `Lead je rekao da ne može sada (loš timing, finansije, nije u zemlji, itd). Ovo je revisit posle nekog vremena.

Stil:
- Tople, kao prijatelj koji se javlja posle pauze.
- Bez pritiska da sada kupuje.
- Maks 2 rečenice.

Primer:
"[ime], šta ima novo kod tebe? Razmišljaš li još uvek o trgovanju ili je trenutak loš?"

Drugi:
"Ej [ime], javljam ti se posle nekog vremena — kako stojiš sada?"`,

  'post-call': `Već si imao poziv sa leadom. Lead razmišlja, čeka odluku. Ovo je gentle check-in posle 1-2 dana.

Stil:
- Kratak check-in, bez navaljivanja.
- Maks 2 rečenice.
- Pitati ako ima dodatnih pitanja.

Primer:
"[ime], šta misliš o onome o čemu smo pričali? Ima li nešto što ti je ostalo nejasno?"`,

  'closing-nudge': `Lead ima sve informacije, već je pokazao interesovanje, sada čeka da donese odluku. Ovo je finalni push.

Stil:
- Direktan ali ne agresivan.
- Maks 2 rečenice.
- Konkretan sledeći korak (npr. "spreman si da krenemo?").

Primer:
"[ime], hoćeš da završimo to danas? Mogu da ti pošaljem link za pristup."

Drugi:
"Ej [ime], jesi spreman za sledeći korak? Ovo je dobar trenutak."`,
};

const BASE_RULES = `OPŠTA PRAVILA — STRIKTNO:
- ISKLJUČIVO srpski, latinica.
- BEZ EMOJI-ja. Ni jednog.
- BEZ pominjanja "Funded", "paketi", "10K/25K/50K", "Bootcamp", "kapital".
- BEZ pominjanja reči "webinar" — uvek "predavanje".
- BEZ velikih obećanja ("zaradi", "uspeh", "transformacija").
- Pričaj kao Srbin srpskom, prirodno (ti, ne Vi).
- Vrati SAMO tekst poruke, bez navodnika, bez objašnjenja, bez potpisa.`;

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
  const scenario = body.scenario || 'first-touch';
  const scenarioPrompt = SCENARIO_PROMPTS[scenario] || SCENARIO_PROMPTS['first-touch'];

  const firstName = (lead.name || '').split(' ')[0] || '';
  const repName = lead.assigned_to === 'mateja' ? 'Mateja'
               : lead.assigned_to === 'dusica' ? 'Dušica' : '';
  const attended = (lead.tags || []).includes('prisustvovao-webinaru');

  const ctx = [];
  if (lead.experience)    ctx.push(`Iskustvo: ${lead.experience}`);
  if (lead.knowledge)     ctx.push(`Nivo znanja: ${lead.knowledge}`);
  if (lead.time_frame)    ctx.push(`Vremenski okvir: ${lead.time_frame}`);
  if (lead.pain_point)    ctx.push(`Pain point: ${lead.pain_point}`);
  if (lead.qualification) ctx.push(`Kvalifikacija: ${lead.qualification}`);
  if (lead.notes)         ctx.push(`Beleške rep-a: ${lead.notes}`);

  const systemPrompt = scenarioPrompt + '\n\n' + BASE_RULES;
  const userPrompt = `Lead:
Ime: ${firstName || 'nepoznato'}
${repName ? `Šalje: ${repName}` : ''}
${attended ? 'Prisustvovao predavanju: DA' : 'Prisustvovao predavanju: NE/nepoznato'}
${ctx.length ? ctx.join('\n') : '(Nema dodatnih detalja.)'}

Napiši poruku.`;

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
    res.status(200).json({ message, scenario });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
