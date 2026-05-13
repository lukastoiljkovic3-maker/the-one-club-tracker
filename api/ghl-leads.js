const GHL_TOKEN = 'pit-336276cf-3229-4e01-b00d-484fa69c1bf0';
const GHL_LOC   = 'mjc2N2JeJS4XWoGGgd8j';
const BASE      = 'https://services.leadconnectorhq.com';

async function fetchByTag(tag) {
  const contacts = [];
  let startAfter = null;

  while (true) {
    const url = new URL(`${BASE}/contacts/`);
    url.searchParams.set('locationId', GHL_LOC);
    url.searchParams.set('tags', tag);
    url.searchParams.set('limit', '100');
    if (startAfter) url.searchParams.set('startAfter', startAfter);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: '2021-07-28',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const page = json.contacts || [];
    contacts.push(...page);

    if (page.length < 100) break;
    startAfter = page[page.length - 1].id;
  }

  return contacts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const [qualified, disqualified, webinarLead, leadMagnet] = await Promise.all([
      fetchByTag('qualified'),
      fetchByTag('disqualified'),
      fetchByTag('webinar-lead'),
      fetchByTag('lead-magnet'),
    ]);

    res.status(200).json({ qualified, disqualified, webinarLead, leadMagnet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
