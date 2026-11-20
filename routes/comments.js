const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get comments for a post
router.get('/', optionalAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    const currentUserId = req.user ? req.user.id : -1;

    const comments = db.prepare(`
      SELECT
        c.id, c.content, c.created_at, c.post_id,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        (c.user_id = ? OR (SELECT user_id FROM posts WHERE id = c.post_id) = ?) as can_delete
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(currentUserId, currentUserId, postId);

    res.json({
      comments: comments.map(c => ({
        ...c,
        can_delete: Boolean(c.can_delete)
      }))
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
});

// Add comment to a post
router.post('/', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const { content } = req.body;

    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 500) {
      return res.status(400).json({ error: 'Comment cannot exceed 500 characters.' });
    }

    // Verify post exists
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const insert = db.prepare(`
      INSERT INTO comments (post_id, user_id, content)
      VALUES (?, ?, ?)
    `);
    const result = insert.run(postId, req.user.id, cleanContent);

    const newComment = db.prepare(`
      SELECT
        c.id, c.content, c.created_at, c.post_id,
        u.id as author_id, u.username, u.display_name, u.avatar_url,
        1 as can_delete
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    const commentsCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(postId).count;

    res.status(201).json({
      message: 'Comment posted successfully!',
      comment: {
        ...newComment,
        can_delete: true
      },
      commentsCount
    });
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// Delete comment (standalone endpoint mounted at /api/comments/:id)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const comment = db.prepare(`
      SELECT c.id, c.user_id, c.post_id, p.user_id as post_owner_id
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = ?
    `).get(commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Allowed if current user is comment author OR post owner
    if (comment.user_id !== req.user.id && comment.post_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    const commentsCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(comment.post_id).count;

    res.json({
      message: 'Comment deleted successfully.',
      commentId,
      postId: comment.post_id,
      commentsCount
    });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

module.exports = router;
