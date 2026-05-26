// Generate a personalized Serbian WhatsApp message for a lead.
// POST body: { lead: {...}, scenario?: 'first-touch' | 'no-pickup' | 'asked-info' | 'cant-now' | 'post-call' | 'closing-nudge' }
//   → { message }
const MODEL = 'claude-haiku-4-5';

// ─────────────────── BORIS FX BRAND VOICE ─────────────────────
// Boris ton: chill, never chases, confident. We don't pursue leads —
// they pursue us. Every message qualifies whether the lead is a fit,
// not whether they'll buy. Casual, friend-to-friend Serbian. Logic
// over pressure. Mi nikog ne jurimo puskom — idi kod drugih slobodno.
//
// Key playbook phrases capturing the energy:
//   "Idi kod drugih slobodno, mi nikog ne jurimo puskom da dodje kod nas"
//   "Ja nemam magicni stapic i nisam deda mraz"
//   "Ajde da odemo na poziv da vidimo sta je najbolja opcija za tebe?"
// ────────────────────────────────────────────────────────────────

const SCENARIO_PROMPTS = {
  'first-touch': `Ovo je PRVA poruka leadu koji je bio na predavanju u nedelju (ili je samo prijavljen).

Format (drži se ovog tačno):
"Ćao [ime], ovde [rep] iz Boris FX tima, vidim da si bio na predavanju u nedelju. Jel imaš sekund?"

Ako NIJE prisustvovao predavanju:
"Ćao [ime], ovde [rep] iz Boris FX tima. Jel imaš sekund?"

Ako ime nije poznato — preskoči ", [ime]".
Ako rep nije poznat — koristi "javljam ti se" umesto "ovde [rep]".

Vrati SAMO tekst poruke, 2 rečenice maksimum.`,

  'no-pickup': `Ti, lično, si pokušao da pozoveš leada, on se nije javio. Sada mu pišeš WhatsApp poruku.

KRITIČNO za razumevanje:
- TI (rep iz konteksta) si onaj koji je zvao. Ne neko drugi.
- Ne pričaš o sebi u 3. licu, ne pominješ ime rep-a u poruci.
- Ne pominješ druge ljude iz tima.

VIBE:
- Mi ne jurimo nikoga. Ovo nije "molim te javi se", ovo je "ako te zanima — znaš gde sam".
- Mirno, kratko, bez izvinjavanja, bez molbi.
- Maks 1-2 rečenice. NIKAD više.

Primeri dobre energije (ti si onaj koji piše, ne pominješ svoje ime):
"[ime], probao sam da te dobijem ali se nisi javio. Kad budeš slobodan javi mi se."
"[ime], nisam uspeo da te dobijem. Javi mi se kad možeš."
"Pokušao sam [ime], slobodno se javi kad ti odgovara."

NIKAD:
- "Molim te"
- "Čuo sam za tebe od [neko]"  ← TI si zvao, nije te neko drugi pominjao
- "Bilo bi super da..."
- "Čekam tvoju poruku"`,

  'asked-info': `Lead je pre nekoliko dana tražio info pa nije odgovorio. Ovo je nudge.

VIBE:
- Bez pritiska, bez podsećanja "Hej, šaljem ti opet info!".
- Postavi pitanje koje ga vraća u razgovor, ne dodatni info.
- Kvalifikuj — da li je on uopšte ozbiljan.
- Maks 2 kratke rečenice.

Primeri:
"[ime], jesi pogledao ono? Pitaj ako nešto nije jasno."
"Ej [ime], stigao si da razmisliš? Ako je za tebe — okej, ako ne — slobodno."
"[ime], jesi imao priliku ono da vidiš?"

NIKAD:
- Ne ponavljaj info koji si već poslao.
- Ne preklinji za odgovor.`,

  'cant-now': `Lead je ranije rekao "ne mogu sad" (timing, novac, vreme). Posle pauze.

VIBE — najvažnije:
- Pričaš kao s drugarom posle par meseci. Nema sales-a, nema pressure-a.
- Pitanje treba da otvori vrata, ne da zatvori prodaju.
- Lagana energija — "samo da čujem kako si, ne moraš ništa".
- Maks 2 rečenice.

Primeri:
"[ime], šta ima novo? Da li još uvek razmišljaš o ovome ili je leglo na čekanje?"
"Ej [ime], kako si? Prošlo je već neko vreme, je li za tebe trenutak bolji sada?"
"[ime], javljam ti se posle nekog vremena. Šta se dešava kod tebe?"

NIKAD:
- "Ponuda je istekla"
- "Imam specijalan deal za tebe"
- "Sada je idealan trenutak"`,

  'post-call': `Imali ste poziv. Lead razmišlja, nije još odlučio. Ovo je check-in posle 1-2 dana.

VIBE — kritično:
- Mi ne guramo. Lead sam odlučuje. Naša poruka je samo provera.
- Nikad ne ponavljaj prodajne argumente sa poziva.
- Pitaj otvoreno, daj mu prostor da kaže ne.
- Maks 2 rečenice.

Primeri:
"[ime], šta si zaključio? Slobodno reci ako nije za tebe."
"Ej [ime], jesi razmislio? Kako stojiš?"
"[ime], gde si sa odlukom? Ako ti treba još nešto da vidiš — kaži."

NIKAD:
- "Samo da te podsetim..."
- Ponavljanje funded/cene/garancije
- "Ovo je odlična prilika..."`,

  'closing-nudge': `Lead ima sve info, već warm, sada čeka da odluči. Finalni nudge.

VIBE — direktno ali bez pritiska:
- Direktno pitanje za odluku. Bez "molim te kupi".
- Energija: "ja imam svoj posao da radim, treba mi tvoj odgovor da znam jel idemo".
- Maks 2 rečenice.

Primeri:
"[ime], šta kažeš — krećemo ili ne? Treba mi samo da znam."
"[ime], jesi spreman da krenemo ili još uvek razmišljaš?"
"Ajde [ime], da završimo to. Ako je da — šaljem ti link, ako ne — okej, slobodno."

NIKAD:
- "Specijalna ponuda samo danas"
- "Cena raste sutra"
- Emocionalne ucene`,
};

const BASE_RULES = `OPŠTA PRAVILA — STRIKTNO (BORIS FX BRAND VOICE):

JEZIK & FORMAT:
- ISKLJUČIVO srpski, latinica.
- BEZ EMOJI-ja. Ni jednog. Nikad.
- Pričaj kao Srbin srpskom, neformalno (ti, ne Vi).
- Maks 2 rečenice (3 samo izuzetno).

ZABRANJENO (NIKAD):
- Reč "webinar" — uvek "predavanje".
- "Funded", "paketi", "10K/25K/50K", "Bootcamp", "kapital", "challenge" u prvoj poruci.
- Velika obećanja ("zaradi", "uspeh", "transformacija", "promeniće ti život").
- Sales fraze ("specijalna ponuda", "ne propusti", "idealna prilika", "ekskluzivno").
- Molbe i izvinjavanja ("molim te", "izvini što smetam", "samo da te podsetim").
- "Kada ti odgovara da se čujemo na 10 min".
- Generičnost ("javljam se da pitam jesi razmislio").

BORIS FX VIBE — OBAVEZNO:
- Chill, opušteno, nikad u žurbi.
- Mi ne jurimo nikoga. Lead nas zove, ne mi njega.
- Confidence: "ako je za tebe — okej, ako nije — slobodno idi dalje".
- Kvalifikacija > closing. Pitanja koja proveravaju da li je on za nas, ne da li mi njemu treba.

Vrati SAMO tekst poruke, bez navodnika, bez objašnjenja, bez potpisa.`;

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
