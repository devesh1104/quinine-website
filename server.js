const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
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
