# Pulse — Mini Social Media Platform

A full-stack, responsive mini social media web application built with **HTML5, CSS3, JavaScript (Vanilla ES6+)**, **Node.js with Express.js**, and a persistent relational database powered by **SQLite (`node:sqlite`)**.

---

## 🌟 Key Features

### 👤 1. User Profiles & Authentication
- **Secure Authentication**: User registration and login with `bcryptjs` password hashing and `jsonwebtoken` (JWT) authorization.
- **Rich Profiles**: Displays user avatar, display name, handle, bio, banner, and real-time statistics (**Posts count**, **Followers count**, **Following count**).
- **Edit Profile**: Modal to update display name, bio, banner image, and upload a new profile picture.
- **Profile Tabs**: Seamlessly switch between user posts and posts liked by the user.
- **Followers & Following Modals**: View lists of followers and followed accounts with interactive follow/unfollow buttons.

### 📝 2. Posts & Comments
- **Feed Views**:
  - **For You**: Chronological feed of public community posts.
  - **Following**: Filtered feed showing only posts from creators you follow + your own posts.
- **Composer**: Write posts up to 1,000 characters with live character counter.
- **Image Attachments**: Attach photos via file upload (stored safely on the server via `multer` in `/uploads/`) or via direct image URLs.
- **Hashtag Highlighting**: Clickable hashtags (`#webdev`, `#frontend`, `#nature`, `#indiedev`) that automatically filter the feed.
- **Post Deletion**: Authors can delete their own posts with instant cascade removal.
- **Comments System**:
  - Expandable inline comment accordion on every post.
  - Post replies with real-time comment counter updates.
  - Delete permissions: Comment authors and original post owners can delete comments.

### ❤️ 3. Like & Follow System
- **Heart Pop Interaction**: Instant like/unlike toggle with animated CSS keyframe heart pop and optimistic counter updates.
- **Dynamic Follow / Unfollow**: Follow creators across feeds, search, modals, and profile pages with immediate button state flips ("Follow" ↔ "Following" ↔ "Unfollow").
- **Smart Suggestions ("Who to follow")**: Dynamically suggests active community members you aren't currently following.

### 🎨 4. Frontend & User Experience
- **Responsive 3-Column Layout**: Left navigation sidebar, Center feed/content, Right sidebar widgets (search, demo accounts, who to follow, trending topics).
- **Mobile Responsive**: Transitions into a clean single-column feed with a fixed bottom navigation bar on mobile devices.
- **Dark & Light Mode**: Theme switcher with persistent `localStorage` preference.
- **Real-Time Search**: Search users and posts with debounce and highlighted results.
- **1-Click Demo Accounts Switcher**: Easily test different user perspectives in 1 click (Sarah, Alex, Tech Insider, Charlie).

---

## 🗄️ Database Architecture (SQLite)

The relational schema is defined in [database.js](file:///c:/Users/rajku/Desktop/CodeAlpha-task-2/database.js) with foreign keys and cascade deletion:

```sql
-- Users
CREATE TABLE users (
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

-- Posts
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comments
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Likes
CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

-- Follows
CREATE TABLE follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);
```

---

## 🚀 Getting Started

### 1. Requirements
- Node.js v18+ (tested on Node.js v24.x)
- npm

### 2. Installation
```bash
npm install
```

### 3. Run the Server
```bash
npm start
```
The server will start at `http://localhost:3000`.

### 4. Run the Test Suite
```bash
npm test
```
Runs 21 automated integration tests covering authentication, follow/unfollow, like/unlike, comments, and search.

---

## 👥 Demo Accounts (Seeded)

All demo accounts share the password: `password123`

| Username | Display Name | Role |
| :--- | :--- | :--- |
| `sarah_codes` | Sarah Jenkins | Senior Frontend Engineer & UI/UX |
| `alex_rivera` | Alex Rivera | Landscape Photographer |
| `tech_insider` | Tech Insider | Software & Open Source News |
| `charlie_k` | Charlie Kim | Indie Game Dev & Audio Synth Producer |

You can switch between any of these accounts with a single click using the **"Demo Accounts"** widget in the right sidebar.

---

## 📡 REST API Endpoints Summary

### Auth (`/api/auth`)
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and receive JWT
- `GET /api/auth/me` - Get current user profile and stats
- `GET /api/auth/demo-users` - List demo accounts

### Users (`/api/users`)
- `GET /api/users/search?q=:query` - Search users
- `GET /api/users/suggestions` - Who to follow suggestions
- `GET /api/users/:username` - Get user profile + follow status
- `PUT /api/users/profile` - Update profile bio/avatar/banner
- `POST /api/users/:id/follow` - Toggle follow/unfollow
- `GET /api/users/:id/followers` - List followers
- `GET /api/users/:id/following` - List following
- `GET /api/users/:username/posts` - User's created posts
- `GET /api/users/:username/likes` - Posts liked by user

### Posts (`/api/posts`)
- `GET /api/posts` - Get posts (`feed=all|following`, `search=...`, `tag=...`)
- `GET /api/posts/:id` - Get single post detail
- `POST /api/posts` - Create post (with optional image)
- `DELETE /api/posts/:id` - Delete post (author only)
- `POST /api/posts/:id/like` - Toggle like/unlike
- `GET /api/posts/:id/likes` - List users who liked post

### Comments (`/api/posts/:id/comments` & `/api/comments`)
- `GET /api/posts/:id/comments` - List comments for post
- `POST /api/posts/:id/comments` - Add comment
- `DELETE /api/comments/:id` - Delete comment

### Uploads (`/api/upload`)
- `POST /api/upload` - Upload image file via `multipart/form-data`
