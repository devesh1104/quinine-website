const fs = require('fs');

const LEADS_FILE = '/tmp/leads.json';

const freeEmailProviders = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
];

function getLeads() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, concern } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  // Corporate email validation
  const domain = email.split('@')[1].toLowerCase();
  if (freeEmailProviders.includes(domain)) {
    return res.status(400).json({ error: 'Please use a corporate email address.' });
  }

  // Input length validation
  if (concern && concern.length > 500) {
    return res.status(400).json({ error: 'Concern text is too long.' });
  }

  // Check for duplicate submission
  const leads = getLeads();
  const existing = leads.find(l => l.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(200).json({
      message: 'You have already submitted. Our team will be in touch shortly.',
      duplicate: true
    });
  }

  // Save lead
  const lead = {
    email,
    concern,
    timestamp: new Date().toISOString()
  };
  leads.push(lead);
  saveLeads(leads);

  // Log to Vercel runtime logs (visible in Vercel dashboard → Functions)
  console.log('NEW LEAD:', JSON.stringify(lead));

  return res.status(201).json({
    message: 'Successfully submitted. We will contact you shortly.'
  });
};
