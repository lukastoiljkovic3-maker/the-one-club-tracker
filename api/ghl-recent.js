// Lightweight endpoint: fetches only the latest 20 GHL contacts.
// Used by the frontend for speed-to-lead notification polling.
const GHL_TOKEN = 'pit-336276cf-3229-4e01-b00d-484fa69c1bf0';
const GHL_LOC   = 'mjc2N2JeJS4XWoGGgd8j';
const BASE      = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const url = `${BASE}/contacts/?locationId=${GHL_LOC}&limit=20`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: '2021-07-28',
      },
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `GHL ${r.status}: ${t.slice(0, 200)}` });
    }
    const json = await r.json();
    const contacts = (json.contacts || []).map(c => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Nepoznat',
      phone: c.phone || null,
      email: c.email || null,
      tags: c.tags || [],
      dateAdded: c.dateAdded || null,
    }));
    // Sort newest first by dateAdded just in case GHL doesn't.
    contacts.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
    res.status(200).json({ contacts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
