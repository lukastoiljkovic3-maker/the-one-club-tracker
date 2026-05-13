const GHL_TOKEN = 'pit-336276cf-3229-4e01-b00d-484fa69c1bf0';
const GHL_LOC   = 'mjc2N2JeJS4XWoGGgd8j';
const BASE      = 'https://services.leadconnectorhq.com';

async function fetchAllContacts() {
  const contacts = [];
  let url = `${BASE}/contacts/?locationId=${GHL_LOC}&limit=100`;

  while (url) {
    const res = await fetch(url, {
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
    contacts.push(...(json.contacts || []));
    url = json.meta?.nextPageUrl || null;
  }

  return contacts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const all = await fetchAllContacts();

    const qualified    = all.filter(c => c.tags?.includes('qualified'));
    const disqualified = all.filter(c => c.tags?.includes('disqualified'));
    const webinarLead  = all.filter(c => c.tags?.includes('webinar-lead'));
    const leadMagnet   = all.filter(c => c.tags?.includes('lead-magnet'));

    res.status(200).json({ qualified, disqualified, webinarLead, leadMagnet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
