const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://cdn.vercel-insights.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "https://vitals.vercel-insights.com"]
        }
    }
}));

// Gzip compression
app.use(compression());

// CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://quininecybersecurity.com', 'https://www.quininecybersecurity.com']
    : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            concern TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

// Blocklist for free email providers
const freeEmailProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
];

// Rate limiter for contact form
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many submissions. Please try again later.' }
});

// Email confirmation sender
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
                            If your matter is urgent, please don't hesitate to reach us directly at
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
    }
}

// API Endpoint to handle contact form submission
app.post('/api/contact', contactLimiter, (req, res) => {
    const { email, concern } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    // Basic email format validation
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

    // Insert into database
    const sql = 'INSERT INTO leads (email, concern) VALUES (?, ?)';
    db.run(sql, [email, concern], function(err) {
        if (err) {
            console.error('Error inserting into database:', err.message);
            return res.status(500).json({ error: 'Internal server error. Please try again later.' });
        }

        // Send confirmation email (non-blocking)
        sendConfirmationEmail(email, concern);

        res.status(201).json({
            message: 'Successfully submitted. We will contact you shortly.',
            id: this.lastID
        });
    });
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        db.close();
        process.exit(0);
    });
});
