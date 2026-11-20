const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'social.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      banner_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  `);

  // Seed sample data if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  console.log('🌱 Seeding initial demo data...');
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('password123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, bio, avatar_url, banner_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const u1 = insertUser.run(
    'sarah_codes',
    'sarah@example.com',
    defaultPasswordHash,
    'Sarah Jenkins',
    'Senior Frontend Engineer & UI/UX enthusiast. Building fast, accessible web experiences ⚡✨',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&h=400&fit=crop'
  ).lastInsertRowid;

  const u2 = insertUser.run(
    'alex_rivera',
    'alex@example.com',
    defaultPasswordHash,
    'Alex Rivera',
    'Landscape photographer 🏔️ Coffee fanatic ☕ Exploring national parks and starry skies.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=400&fit=crop'
  ).lastInsertRowid;

  const u3 = insertUser.run(
    'tech_insider',
    'tech@example.com',
    defaultPasswordHash,
    'Tech Insider',
    'Your daily radar for software engineering, open source projects, and cutting-edge tech news 🚀',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=400&fit=crop'
  ).lastInsertRowid;

  const u4 = insertUser.run(
    'charlie_k',
    'charlie@example.com',
    defaultPasswordHash,
    'Charlie Kim',
    'Indie game developer & electronic music producer 🎧🎮 Tweeting devlogs and sound design.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=400&fit=crop'
  ).lastInsertRowid;

  // Follow relationships:
  // Sarah follows Alex & Tech Insider
  // Alex follows Sarah & Charlie
  // Tech Insider follows Sarah
  // Charlie follows Sarah & Alex
  const insertFollow = db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)');
  insertFollow.run(u1, u2);
  insertFollow.run(u1, u3);
  insertFollow.run(u2, u1);
  insertFollow.run(u2, u4);
  insertFollow.run(u3, u1);
  insertFollow.run(u4, u1);
  insertFollow.run(u4, u2);

  // Seed sample posts
  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, image_url, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);

  const p1 = insertPost.run(
    u1,
    'Just deployed the new reactive state management system! Reduced client bundle size by 35% and bundle parse time dropped by half. Always measure before optimizing! 🚀💻 #webdev #frontend',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&h=600&fit=crop',
    '-3 hours'
  ).lastInsertRowid;

  const p2 = insertPost.run(
    u2,
    'Sunrise over Mount Rainier this morning was purely magical. The temperature was 28°F, but capturing that golden light reflecting on the snow made every frozen finger worth it 🏔️☕',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&h=600&fit=crop',
    '-5 hours'
  ).lastInsertRowid;

  const p3 = insertPost.run(
    u3,
    'Express.js remains one of the simplest and most robust foundations for building web APIs in Node. Combined with lightweight databases and clean REST architecture, development velocity is unmatched. What is your go-to backend stack in 2026? 🛠️',
    '',
    '-1 days'
  ).lastInsertRowid;

  const p4 = insertPost.run(
    u4,
    'Spent the evening tweaking ambient synthesizer patches for level 3 of my cyberpunk platformer. Analog warmth hits different at 2 AM 🎹✨',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1000&h=600&fit=crop',
    '-2 days'
  ).lastInsertRowid;

  const p5 = insertPost.run(
    u1,
    'Design tip: whitespace is an active visual element, not empty space. Giving your components room to breathe drastically improves readability and cognitive load. 📐🎨',
    '',
    '-2 days'
  ).lastInsertRowid;

  // Seed likes
  const insertLike = db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)');
  insertLike.run(p1, u2);
  insertLike.run(p1, u3);
  insertLike.run(p1, u4);
  insertLike.run(p2, u1);
  insertLike.run(p2, u4);
  insertLike.run(p3, u1);
  insertLike.run(p3, u2);
  insertLike.run(p4, u1);

  // Seed comments
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, user_id, content, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);

  insertComment.run(p1, u2, 'Incredible work Sarah! Did you write a custom solution or migrate to signals?', '-2 hours');
  insertComment.run(p1, u1, 'Thanks Alex! Migrated our reactive core to fine-grained signals — completely eliminated unnecessary component re-renders.', '-1 hours');
  insertComment.run(p2, u1, 'Stunning shot! The gradient in the sky is unreal Alex 🌄', '-4 hours');
  insertComment.run(p2, u4, 'Need to get out into nature more often. Adding Rainier to my travel list!', '-3 hours');
  insertComment.run(p3, u1, 'Express + SQLite is shockingly fast and super easy to reason about!', '-20 hours');
  insertComment.run(p4, u2, 'Can’t wait to play the full demo. The soundtrack preview you shared earlier was hypnotic.', '-1 days');

  console.log('✅ Demo database seeded successfully!');
}

initDatabase();

module.exports = db;
