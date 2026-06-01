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

    const hasTag = (c, ...tags) => tags.some(t => c.tags?.includes(t));

    const qualified    = all.filter(c => hasTag(c, 'qualified', 'qualified-webinar'));
    const disqualified = all.filter(c => hasTag(c, 'disqualified-webinar', 'dq'));
    const webinarLead     = all.filter(c => hasTag(c, 'webinar-lead'));
    const webinarAttended = all.filter(c => hasTag(c, 'prisustvovao-webinaru'));
    // 31.05 attendees — defined by VSL funnel tags in GHL
    const webinar3105 = all.filter(c => hasTag(c, 'vsl-1', 'vsl-2', 'vsl-3'));
    const leadMagnet      = all.filter(c => hasTag(c, 'lead-magnet'));

    res.status(200).json({ qualified, disqualified, webinarLead, webinarAttended, webinar3105, leadMagnet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
