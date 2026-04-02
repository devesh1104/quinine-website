const { neon } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');

const freeEmailProviders = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
];

// Initialise Postgres connection (uses DATABASE_URL env var set by Vercel/Neon)
function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

// Create the leads table if it doesn't exist yet
async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id        SERIAL PRIMARY KEY,
      email     TEXT NOT NULL UNIQUE,
      concern   TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// Send confirmation email to the person who submitted the form
async function sendConfirmationEmail(toEmail, concern) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP not configured — skipping confirmation email');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const concernLabels = {
    webapp: 'Web Application Security',
    mobile: 'Mobile Application Security',
    infra: 'Infrastructure & Network Security',
    ai: 'AI & LLM Security',
    cloud: 'Cloud Security',
    code: 'Secure Code Review'
  };

  const serviceText = concernLabels[concern] || 'our security services';

  try {
    await transporter.sendMail({
      from: { name: 'Quinine Cybersecurity', address: 'contact@quininecybersecurity.co.uk' },
      to: toEmail,
      subject: 'Thank you for contacting Quinine Cybersecurity',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #202834;">
          <div style="padding: 40px 32px; background: #0A2463; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin: 0;">
              QUININE<span style="color: #2E6FF2;">.</span>
            </h1>
          </div>
          <div style="padding: 40px 32px; background: #ffffff;">
            <h2 style="color: #0A2463; font-size: 20px; font-weight: 700; margin: 0 0 16px;">Thank you for reaching out</h2>
            <p style="font-size: 15px; line-height: 1.7; color: #202834; margin: 0 0 16px;">
              We have received your enquiry regarding <strong>${serviceText}</strong> and a member of our team will be in touch with you shortly.
            </p>
            <p style="font-size: 15px; line-height: 1.7; color: #202834; margin: 0 0 16px;">
              At Quinine Cybersecurity, we specialise in securing enterprise AI systems, applications, and infrastructure. We look forward to understanding your requirements and discussing how we can help protect your organisation.
            </p>
            <p style="font-size: 15px; line-height: 1.7; color: #202834; margin: 0 0 24px;">
              If your matter is urgent, please reach us directly at
              <a href="mailto:contact@quininecybersecurity.co.uk" style="color: #2E6FF2; text-decoration: none;">contact@quininecybersecurity.co.uk</a>.
            </p>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0;">
                <strong style="color: #0A2463;">Quinine Cybersecurity Ltd.</strong><br>
                Level39, One Canada Square<br>
                Canary Wharf, London E14 5AB<br>
                <a href="https://quininecybersecurity.com" style="color: #2E6FF2; text-decoration: none;">quininecybersecurity.com</a>
              </p>
            </div>
          </div>
          <div style="padding: 20px 32px; background: #F7F8FA; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">&copy; ${new Date().getFullYear()} Quinine Cybersecurity Ltd. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log('Confirmation email sent to:', toEmail);
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
    // Don't throw — form submission should still succeed even if email fails
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, concern } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const domain = email.split('@')[1].toLowerCase();
  if (freeEmailProviders.includes(domain)) {
    return res.status(400).json({ error: 'Please use a corporate email address.' });
  }

  if (concern && concern.length > 500) {
    return res.status(400).json({ error: 'Concern text is too long.' });
  }

  try {
    const sql = getDb();
    await ensureTable(sql);

    // Upsert — silently ignore duplicate emails
    const result = await sql`
      INSERT INTO leads (email, concern)
      VALUES (${email}, ${concern || null})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    if (result.length === 0) {
      // Email already existed
      return res.status(200).json({
        message: 'You have already submitted. Our team will be in touch shortly.',
        duplicate: true
      });
    }

    console.log('NEW LEAD:', JSON.stringify({ email, concern, id: result[0].id }));

    // Send confirmation email (non-blocking)
    await sendConfirmationEmail(email, concern);

    return res.status(201).json({
      message: 'Successfully submitted. We will contact you shortly.'
    });

  } catch (err) {
    console.error('Database error:', err.message);
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
};
