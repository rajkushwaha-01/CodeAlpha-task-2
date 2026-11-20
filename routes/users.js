const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Search users
router.get('/search', optionalAuth, (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q) {
      return res.json({ users: [] });
    }
    const currentUserId = req.user ? req.user.id : -1;
    const users = db.prepare(`
      SELECT
        u.id, u.username, u.display_name, u.bio, u.avatar_url,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM users u
      WHERE u.username LIKE ? OR u.display_name LIKE ?
      ORDER BY followers_count DESC
      LIMIT 15
    `).all(currentUserId, `%${q}%`, `%${q}%`);

    res.json({
      users: users.map(u => ({ ...u, is_following: Boolean(u.is_following) }))
    });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Failed to search users.' });
  }
});

// Suggestions for "Who to follow"
router.get('/suggestions', optionalAuth, (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : -1;
    const suggestions = db.prepare(`
      SELECT
        u.id, u.username, u.display_name, u.bio, u.avatar_url,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM users u
      WHERE u.id != ? AND u.id NOT IN (
        SELECT following_id FROM follows WHERE follower_id = ?
      )
      ORDER BY followers_count DESC, u.id ASC
      LIMIT 5
    `).all(currentUserId, currentUserId, currentUserId);

    res.json({
      suggestions: suggestions.map(u => ({ ...u, is_following: Boolean(u.is_following) }))
    });
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json({ error: 'Failed to load suggestions.' });
  }
});

// Update Profile
router.put('/profile', requireAuth, (req, res) => {
  try {
    const { display_name, bio, avatar_url, banner_url } = req.body;
    const displayName = display_name && display_name.trim() ? display_name.trim() : req.user.display_name;
    const userBio = bio !== undefined ? bio.trim() : req.user.bio;
    const userAvatar = avatar_url !== undefined ? avatar_url.trim() : req.user.avatar_url;
    const userBanner = banner_url !== undefined ? banner_url.trim() : req.user.banner_url;

    db.prepare(`
      UPDATE users
      SET display_name = ?, bio = ?, avatar_url = ?, banner_url = ?
      WHERE id = ?
    `).run(displayName, userBio, userAvatar, userBanner, req.user.id);

    const updated = db.prepare(`
      SELECT id, username, email, display_name, bio, avatar_url, banner_url, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({
      message: 'Profile updated successfully!',
      user: updated
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Follow / Unfollow Toggle
router.post('/:id/follow', requireAuth, (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const targetUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingFollow = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, targetUserId);

    let isFollowing = false;
    if (existingFollow) {
      // Unfollow
      db.prepare('DELETE FROM follows WHERE id = ?').run(existingFollow.id);
      isFollowing = false;
    } else {
      // Follow
      db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(currentUserId, targetUserId);
      isFollowing = true;
    }

    const followersCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUserId).count;

    res.json({
      following: isFollowing,
      followersCount,
      message: isFollowing ? `You are now following @${targetUser.username}` : `Unfollowed @${targetUser.username}`
    });
  } catch (err) {
    console.error('Follow toggle error:', err);
    res.status(500).json({ error: 'Failed to update follow status.' });
  }
});

// Get User Profile by username
router.get('/:username', optionalAuth, (req, res) => {
  try {
    const username = req.params.username.trim();
    const user = db.prepare(`
      SELECT id, username, display_name, bio, avatar_url, banner_url, created_at
      FROM users
      WHERE username = ? COLLATE NOCASE
    `).get(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : -1;

    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE user_id = ?) as posts_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count
    `).get(user.id, user.id, user.id);

    const isFollowing = currentUserId > 0
      ? Boolean(db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, user.id))
      : false;

    const isSelf = currentUserId === user.id;

    res.json({
      user: {
        ...user,
        stats,
        is_following: isFollowing,
        is_self: isSelf
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

// Get user's followers
router.get('/:id/followers', optionalAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : -1;

    const followers = db.prepare(`
      SELECT
        u.id, u.username, u.display_name, u.bio, u.avatar_url,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
    `).all(currentUserId, userId);

    res.json({
      followers: followers.map(f => ({ ...f, is_following: Boolean(f.is_following) }))
    });
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({ error: 'Failed to load followers.' });
  }
});

// Get user's following
router.get('/:id/following', optionalAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : -1;

    const following = db.prepare(`
      SELECT
        u.id, u.username, u.display_name, u.bio, u.avatar_url,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `).all(currentUserId, userId);

    res.json({
      following: following.map(f => ({ ...f, is_following: Boolean(f.is_following) }))
    });
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({ error: 'Failed to load following list.' });
  }
});

// Get posts created by a specific user
router.get('/:username/posts', optionalAuth, (req, res) => {
  try {
    const username = req.params.username.trim();
    const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : -1;
    const posts = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(currentUserId, user.id);

    res.json({
      posts: posts.map(p => ({ ...p, is_liked: Boolean(p.is_liked) }))
    });
  } catch (err) {
    console.error('Get user posts error:', err);
    res.status(500).json({ error: 'Failed to load posts for user.' });
  }
});

// Get posts liked by a specific user
router.get('/:username/likes', optionalAuth, (req, res) => {
  try {
    const username = req.params.username.trim();
    const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : -1;
    const posts = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
    `).all(currentUserId, user.id);

    res.json({
      posts: posts.map(p => ({ ...p, is_liked: Boolean(p.is_liked) }))
    });
  } catch (err) {
    console.error('Get user likes error:', err);
    res.status(500).json({ error: 'Failed to load liked posts.' });
  }
});

module.exports = router;
