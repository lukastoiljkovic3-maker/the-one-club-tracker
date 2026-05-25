export default async function handler(req, res) {
  const GHL_TOKEN = process.env.GHL_TOKEN;
  const GHL_LOC   = process.env.GHL_LOCATION_ID;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!GHL_TOKEN || !GHL_LOC) {
    return res.status(500).json({ error: 'Missing GHL_TOKEN or GHL_LOCATION_ID env var' });
  }

  // Optional ?today=1 — only return leads added today (UTC date match)
  const onlyToday = req.query?.today === '1' || req.query?.today === 'true';
  // Optional ?source=webinar — require the webinar-lead tag
  const requireWebinar = req.query?.source === 'webinar';

  try {
    let allContacts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOC}&limit=100&page=${page}`;
      const r = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${GHL_TOKEN}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        }
      });

      if (!r.ok) {
        const err = await r.text();
        return res.status(r.status).json({ error: err });
      }

      const json = await r.json();
      const contacts = json.contacts || [];
      allContacts = allContacts.concat(contacts);

      hasMore = contacts.length === 100;
      page++;
      if (page > 50) break; // safety cap at 5000 contacts
    }

    const hasTag = (c, ...tags) =>
      Array.isArray(c.tags) && c.tags.some(t => tags.includes(String(t).toLowerCase()));

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = (c) => (c.dateAdded || '').slice(0, 10) === todayStr;

    // Priority: qualified > dq > lead-magnet > webinar-only
    const categorized = allContacts
      .filter(c => hasTag(c, 'qualified', 'dq', 'lead-magnet', 'lead magnet', 'leadmagnet', 'webinar-lead', 'webinar lead'))
      .filter(c => !requireWebinar || hasTag(c, 'webinar-lead', 'webinar lead'))
      .filter(c => !onlyToday || isToday(c))
      .map(c => {
        let lead_type;
        if (hasTag(c, 'qualified'))                               lead_type = 'qualified';
        else if (hasTag(c, 'dq'))                                 lead_type = 'dq';
        else if (hasTag(c, 'lead-magnet', 'lead magnet', 'leadmagnet')) lead_type = 'lead_magnet';
        else                                                      lead_type = 'webinar_only';
        return { ...c, lead_type };
      });

    const qualified   = categorized.filter(c => c.lead_type === 'qualified');
    const dq          = categorized.filter(c => c.lead_type === 'dq');
    const leadMagnet  = categorized.filter(c => c.lead_type === 'lead_magnet');
    const webinarOnly = categorized.filter(c => c.lead_type === 'webinar_only');

    res.status(200).json({
      qualified,
      dq,
      leadMagnet,
      webinarOnly,
      total: categorized.length,
      filters: { onlyToday, requireWebinar }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
