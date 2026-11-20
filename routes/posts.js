const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get feed / posts list
router.get('/', optionalAuth, (req, res) => {
  try {
    const { feed, search, tag } = req.query;
    const currentUserId = req.user ? req.user.id : -1;

    let query = `
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
    `;
    const params = [currentUserId];

    const conditions = [];

    if (feed === 'following') {
      if (currentUserId <= 0) {
        return res.json({ posts: [] });
      }
      conditions.push(`(p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?)`);
      params.push(currentUserId, currentUserId);
    }

    if (search && search.trim()) {
      conditions.push(`p.content LIKE ?`);
      params.push(`%${search.trim()}%`);
    }

    if (tag && tag.trim()) {
      const cleanTag = tag.trim().replace(/^#/, '');
      conditions.push(`p.content LIKE ?`);
      params.push(`%#${cleanTag}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY p.created_at DESC LIMIT 50`;

    const posts = db.prepare(query).all(...params);

    res.json({
      posts: posts.map(p => ({
        ...p,
        is_liked: Boolean(p.is_liked)
      }))
    });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to retrieve posts.' });
  }
});

// Get single post
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : -1;

    const post = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(currentUserId, postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    res.json({
      post: {
        ...post,
        is_liked: Boolean(post.is_liked)
      }
    });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to retrieve post.' });
  }
});

// Create new post
router.post('/', requireAuth, (req, res) => {
  try {
    const { content, image_url } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 1000) {
      return res.status(400).json({ error: 'Post exceeds maximum length of 1000 characters.' });
    }

    const cleanImageUrl = image_url ? image_url.trim() : '';

    const insert = db.prepare(`
      INSERT INTO posts (user_id, content, image_url)
      VALUES (?, ?, ?)
    `);
    const result = insert.run(req.user.id, cleanContent, cleanImageUrl);

    const newPost = db.prepare(`
      SELECT
        p.id, p.content, p.image_url, p.created_at,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        0 as likes_count,
        0 as comments_count,
        0 as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Post created successfully!',
      post: {
        ...newPost,
        is_liked: false
      }
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// Delete post (only author)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
    res.json({ message: 'Post deleted successfully.', postId });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// Toggle Like
router.post('/:id/like', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existingLike = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(postId, currentUserId);

    let isLiked = false;
    if (existingLike) {
      // Unlike
      db.prepare('DELETE FROM likes WHERE id = ?').run(existingLike.id);
      isLiked = false;
    } else {
      // Like
      db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(postId, currentUserId);
      isLiked = true;
    }

    const likesCount = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count;

    res.json({
      liked: isLiked,
      likesCount,
      postId
    });
  } catch (err) {
    console.error('Like toggle error:', err);
    res.status(500).json({ error: 'Failed to update like status.' });
  }
});

// List users who liked this post
router.get('/:id/likes', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : -1;

    const users = db.prepare(`
      SELECT
        u.id, u.username, u.display_name, u.avatar_url, u.bio,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = ?
      ORDER BY l.created_at DESC
    `).all(currentUserId, postId);

    res.json({
      likes: users.map(u => ({ ...u, is_following: Boolean(u.is_following) }))
    });
  } catch (err) {
    console.error('Get post likes error:', err);
    res.status(500).json({ error: 'Failed to load likes list.' });
  }
});

module.exports = router;
