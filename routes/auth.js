const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth, generateToken } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Validate format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check uniqueness
    const existing = db.prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      if (existing.username.toLowerCase() === cleanUsername) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    const displayName = (display_name && display_name.trim()) || username.trim();

    // Default colorful avatar generator using UI-Avatars or Dicebear
    const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(cleanUsername, cleanEmail, password_hash, displayName, avatar_url);

    const newUser = db.prepare('SELECT id, username, email, display_name, bio, avatar_url, banner_url, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred during registration.' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Please enter your username/email and password.' });
    }

    const identifier = usernameOrEmail.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier, identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    res.json({
      message: 'Login successful!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// Get current user profile
router.get('/me', requireAuth, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE user_id = ?) as posts_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count
    `).get(req.user.id, req.user.id, req.user.id);

    res.json({
      user: {
        ...req.user,
        stats
      }
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to retrieve current user.' });
  }
});

// List demo users for quick 1-click testing
router.get('/demo-users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, display_name, bio, avatar_url
      FROM users
      ORDER BY id ASC
      LIMIT 6
    `).all();
    res.json({ users, defaultPassword: 'password123' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demo users.' });
  }
});

module.exports = router;
