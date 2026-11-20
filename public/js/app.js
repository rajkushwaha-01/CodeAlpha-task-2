// Pulse Social Platform Application Controller
let currentFeedTab = 'all';
let currentSearchQuery = '';
let currentTagFilter = '';
let composerMediaUrl = '';
let selectedMediaFile = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await auth.init();
  loadDemoUsersList();
  loadSuggestions();
  handleRouting();

  // Listen to hash changes for SPA navigation
  window.addEventListener('hashchange', handleRouting);
});

// Refresh view when auth changes
window.refreshCurrentView = () => {
  handleRouting();
  loadSuggestions();
};

/* ==========================================================================
   THEME MANAGEMENT
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('pulse_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('pulse_theme', newTheme);
}

/* ==========================================================================
   ROUTING
   ========================================================================== */
function navigateTo(route) {
  window.location.hash = `#${route}`;
}

async function handleRouting() {
  const hash = window.location.hash.replace(/^#/, '') || 'feed';
  const [route, param, subParam] = hash.split('/');

  // Update active sidebar nav item
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
    el.classList.remove('active');
    const navTarget = el.getAttribute('data-nav');
    if (navTarget === route) {
      el.classList.add('active');
    }
  });

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));

  // Reset top bar
  const pageTitle = document.getElementById('page-title');
  const feedTabs = document.getElementById('feed-tabs');
  const composerCard = document.getElementById('composer-card');

  if (route === 'feed') {
    pageTitle.textContent = 'Home';
    feedTabs.classList.remove('hidden');
    composerCard.classList.remove('hidden');
    document.getElementById('view-feed').classList.add('active');
    loadFeed();
  } else if (route === 'explore') {
    pageTitle.textContent = 'Explore';
    feedTabs.classList.add('hidden');
    composerCard.classList.add('hidden');
    document.getElementById('view-explore').classList.add('active');
    renderExploreView();
  } else if (route === 'profile') {
    feedTabs.classList.add('hidden');
    composerCard.classList.add('hidden');
    document.getElementById('view-profile').classList.add('active');
    const targetUser = param || (auth.currentUser ? auth.currentUser.username : null);
    if (!targetUser) {
      openAuthModal('login');
      navigateTo('feed');
      return;
    }
    pageTitle.textContent = `@${targetUser}`;
    renderProfileView(targetUser, subParam || 'posts');
  } else if (route === 'post') {
    feedTabs.classList.add('hidden');
    composerCard.classList.add('hidden');
    document.getElementById('view-post-detail').classList.add('active');
    pageTitle.textContent = 'Post';
    renderPostDetailView(param);
  } else if (route === 'login') {
    openAuthModal('login');
    navigateTo('feed');
  } else if (route === 'register') {
    openAuthModal('register');
    navigateTo('feed');
  } else {
    navigateTo('feed');
  }
}

/* ==========================================================================
   FEED & POSTS
   ========================================================================== */
function switchFeedTab(tab) {
  currentFeedTab = tab;
  currentTagFilter = '';
  document.querySelectorAll('.feed-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-feed') === tab);
  });
  loadFeed();
}

function filterByTag(tag) {
  currentTagFilter = tag;
  navigateTo('feed');
  document.getElementById('page-title').textContent = `#${tag}`;
  loadFeed();
}

async function loadFeed() {
  const container = document.getElementById('posts-feed');
  container.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await api.posts.getFeed(currentFeedTab, currentSearchQuery, currentTagFilter);
    if (!data.posts || data.posts.length === 0) {
      if (currentFeedTab === 'following' && !auth.currentUser) {
        container.innerHTML = `
          <div class="empty-state">
            <h4>Sign in to see posts from accounts you follow</h4>
            <p>Follow your favorite creators, engineers, and photographers.</p>
            <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="openAuthModal('login')">Sign In</button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <h4>No posts found</h4>
            <p>${currentTagFilter ? `No posts matching #${currentTagFilter} yet.` : 'Be the first to share something amazing with the community!'}</p>
          </div>
        `;
      }
      return;
    }

    container.innerHTML = data.posts.map(renderPostCardHtml).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>Error loading posts</h4>
        <p>${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

function renderPostCardHtml(post) {
  const isAuthor = auth.currentUser && auth.currentUser.id === post.author_id;
  const avatarUrl = post.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.username}`;
  const relativeTime = formatRelativeTime(post.created_at);
  const formattedContent = formatPostText(post.content);

  return `
    <article class="post-card" id="post-${post.id}" onclick="handlePostCardClick(event, ${post.id})">
      <div class="post-avatar-col" onclick="event.stopPropagation(); navigateTo('profile/${escapeHTML(post.username)}')">
        <img src="${avatarUrl}" alt="${escapeHTML(post.display_name)}" class="avatar avatar-md">
      </div>
      <div class="post-main-col">
        <div class="post-header">
          <div class="post-author-info">
            <span class="author-display-name" onclick="event.stopPropagation(); navigateTo('profile/${escapeHTML(post.username)}')">${escapeHTML(post.display_name)}</span>
            <span class="author-username" onclick="event.stopPropagation(); navigateTo('profile/${escapeHTML(post.username)}')">@${escapeHTML(post.username)}</span>
            <span class="post-timestamp" title="${new Date(post.created_at).toLocaleString()}">${relativeTime}</span>
          </div>
          ${isAuthor ? `
            <button class="post-menu-btn" onclick="event.stopPropagation(); deletePost(${post.id})" title="Delete post">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
        </div>

        <div class="post-content">${formattedContent}</div>

        ${post.image_url ? `
          <div class="post-media-container" onclick="event.stopPropagation(); window.open('${escapeHTML(post.image_url)}', '_blank')">
            <img src="${escapeHTML(post.image_url)}" alt="Post attachment" loading="lazy">
          </div>
        ` : ''}

        <div class="post-actions">
          <!-- Comments toggle button -->
          <button class="action-btn comment-btn" onclick="event.stopPropagation(); togglePostComments(${post.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span id="post-comments-count-${post.id}">${post.comments_count || 0}</span>
          </button>

          <!-- Like button -->
          <button class="action-btn like-btn ${post.is_liked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="event.stopPropagation(); toggleLikePost(${post.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span id="post-likes-count-${post.id}">${post.likes_count || 0}</span>
          </button>

          <!-- Share / copy link button -->
          <button class="action-btn share-btn" onclick="event.stopPropagation(); copyPostLink(${post.id})" title="Copy link to post">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>

        <!-- Inline Comments Accordion -->
        <div class="post-comments-container hidden" id="comments-box-${post.id}" onclick="event.stopPropagation()">
          <div class="comment-input-row">
            <img src="${auth.currentUser ? (auth.currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + auth.currentUser.username) : 'https://api.dicebear.com/7.x/bottts/svg?seed=guest'}" class="avatar avatar-xs" alt="User">
            <input type="text" id="comment-input-${post.id}" placeholder="Post your reply..." maxlength="500" onkeydown="handleCommentKey(event, ${post.id})">
            <button class="btn btn-primary btn-sm" onclick="submitComment(${post.id})">Reply</button>
          </div>
          <div class="comments-list" id="comments-list-${post.id}">
            <!-- Loaded dynamically -->
          </div>
        </div>
      </div>
    </article>
  `;
}

function handlePostCardClick(event, postId) {
  // If not clicking interactive items, navigate to post detail
  if (['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'IMG'].includes(event.target.tagName)) return;
  navigateTo(`post/${postId}`);
}

/* ==========================================================================
   POST ACTIONS (LIKE, DELETE, COPY)
   ========================================================================== */
async function toggleLikePost(postId) {
  if (!auth.currentUser) {
    openAuthModal('login');
    return;
  }

  const btn = document.getElementById(`like-btn-${postId}`);
  const countEl = document.getElementById(`post-likes-count-${postId}`);
  const wasLiked = btn.classList.contains('liked');
  let count = parseInt(countEl.textContent, 10) || 0;

  // Optimistic UI update
  btn.classList.toggle('liked', !wasLiked);
  countEl.textContent = wasLiked ? Math.max(0, count - 1) : count + 1;

  try {
    const res = await api.posts.toggleLike(postId);
    btn.classList.toggle('liked', res.liked);
    countEl.textContent = res.likesCount;
  } catch (err) {
    // Revert optimistic update on failure
    btn.classList.toggle('liked', wasLiked);
    countEl.textContent = count;
    showToast(err.message, 'error');
  }
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  try {
    await api.posts.delete(postId);
    showToast('Post deleted');
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyPostLink(postId) {
  const url = `${window.location.origin}/#post/${postId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard! 📋');
  }).catch(() => {
    showToast(url);
  });
}

/* ==========================================================================
   COMMENTS
   ========================================================================== */
async function togglePostComments(postId) {
  const box = document.getElementById(`comments-box-${postId}`);
  if (!box) return;

  const isHidden = box.classList.contains('hidden');
  if (isHidden) {
    box.classList.remove('hidden');
    loadPostComments(postId);
    setTimeout(() => {
      const input = document.getElementById(`comment-input-${postId}`);
      if (input) input.focus();
    }, 100);
  } else {
    box.classList.add('hidden');
  }
}

async function loadPostComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;

  list.innerHTML = `<div class="loading-spinner-container" style="padding:1rem"><div class="spinner" style="width:20px;height:20px"></div></div>`;
  try {
    const data = await api.comments.getForPost(postId);
    if (!data.comments || data.comments.length === 0) {
      list.innerHTML = `<p style="font-size:0.85rem;color:var(--text-muted);padding:0.4rem 0">No replies yet. Be the first to comment!</p>`;
      return;
    }

    list.innerHTML = data.comments.map(c => `
      <div class="comment-item" id="comment-${c.id}">
        <img src="${c.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + c.username}" class="avatar avatar-xs" alt="${escapeHTML(c.display_name)}" onclick="navigateTo('profile/${escapeHTML(c.username)}')">
        <div class="comment-content-col">
          <div class="comment-header">
            <span class="comment-author" onclick="navigateTo('profile/${escapeHTML(c.username)}')">${escapeHTML(c.display_name)}</span>
            <span class="comment-time">${formatRelativeTime(c.created_at)}</span>
          </div>
          <div class="comment-text">${formatPostText(c.content)}</div>
        </div>
        ${c.can_delete ? `
          <button class="comment-delete-btn" onclick="deleteComment(${c.id}, ${postId})" title="Delete reply">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:var(--danger-color);font-size:0.85rem">${escapeHTML(err.message)}</p>`;
  }
}

function handleCommentKey(event, postId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitComment(postId);
  }
}

async function submitComment(postId) {
  if (!auth.currentUser) {
    openAuthModal('login');
    return;
  }

  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await api.comments.create(postId, content);
    input.value = '';
    showToast('Reply posted!');

    // Update comment count
    const countEl = document.getElementById(`post-comments-count-${postId}`);
    if (countEl) countEl.textContent = res.commentsCount;

    loadPostComments(postId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteComment(commentId, postId) {
  try {
    const res = await api.comments.delete(commentId);
    showToast('Reply deleted');
    const commentEl = document.getElementById(`comment-${commentId}`);
    if (commentEl) commentEl.remove();

    const countEl = document.getElementById(`post-comments-count-${postId}`);
    if (countEl) countEl.textContent = res.commentsCount;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   COMPOSER
   ========================================================================== */
function focusComposer() {
  if (!auth.currentUser) {
    openAuthModal('login');
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const textarea = document.getElementById('composer-text');
  if (textarea) textarea.focus();
}

function toggleImageUrlRow() {
  const row = document.getElementById('image-url-row');
  row.classList.toggle('hidden');
  if (!row.classList.contains('hidden')) {
    document.getElementById('composer-image-url').focus();
  }
}

function applyImageUrl() {
  const input = document.getElementById('composer-image-url');
  const url = input.value.trim();
  if (!url) return;

  composerMediaUrl = url;
  selectedMediaFile = null;
  document.getElementById('media-preview-img').src = url;
  document.getElementById('composer-media-preview').classList.remove('hidden');
  document.getElementById('image-url-row').classList.add('hidden');
  input.value = '';
}

function removeComposerMedia() {
  composerMediaUrl = '';
  selectedMediaFile = null;
  document.getElementById('composer-file-input').value = '';
  document.getElementById('media-preview-img').src = '';
  document.getElementById('composer-media-preview').classList.add('hidden');
}

async function submitPost() {
  if (!auth.currentUser) {
    openAuthModal('login');
    return;
  }

  const textEl = document.getElementById('composer-text');
  const content = textEl.value.trim();
  if (!content) {
    showToast('Please write something before posting', 'error');
    return;
  }

  const submitBtn = document.getElementById('composer-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Posting...</span>`;

  try {
    let finalImageUrl = composerMediaUrl;

    // If a local image file was chosen, upload it first
    if (selectedMediaFile) {
      const uploadRes = await api.upload.image(selectedMediaFile);
      finalImageUrl = uploadRes.url;
    }

    await api.posts.create({
      content,
      image_url: finalImageUrl
    });

    // Reset composer
    textEl.value = '';
    removeComposerMedia();
    document.getElementById('char-counter').textContent = '1000';
    showToast('Post published! 🎉');

    // Reload feed
    if (window.location.hash === '#feed' || window.location.hash === '') {
      loadFeed();
    } else {
      navigateTo('feed');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Post</span>`;
  }
}

/* ==========================================================================
   USER PROFILE VIEW
   ========================================================================== */
async function renderProfileView(username, activeTab = 'posts') {
  const container = document.getElementById('view-profile');
  container.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await api.users.getProfile(username);
    const user = data.user;

    const bannerStyle = user.banner_url
      ? `style="background-image: url('${escapeHTML(user.banner_url)}');"`
      : '';

    const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;

    let actionButtonHtml = '';
    if (user.is_self) {
      actionButtonHtml = `
        <button class="btn btn-outline btn-sm" onclick="openEditProfileModal()">Edit Profile</button>
      `;
    } else {
      actionButtonHtml = `
        <button class="btn btn-sm btn-follow ${user.is_following ? 'btn-following' : 'btn-primary'}"
          id="profile-follow-btn"
          onclick="toggleFollowUser(${user.id}, this)">
          <span>${user.is_following ? 'Following' : 'Follow'}</span>
        </button>
      `;
    }

    container.innerHTML = `
      <div class="profile-container">
        <div class="profile-banner" ${bannerStyle}></div>
        <div class="profile-header-meta">
          <div class="profile-avatar-row">
            <img src="${avatarUrl}" alt="${escapeHTML(user.display_name)}" class="profile-avatar-img">
            ${actionButtonHtml}
          </div>
          <div class="profile-names">
            <h2 class="profile-display-name">${escapeHTML(user.display_name)}</h2>
            <div class="profile-username">@${escapeHTML(user.username)}</div>
          </div>
          ${user.bio ? `<p class="profile-bio">${formatPostText(user.bio)}</p>` : ''}
          <div class="profile-stats-row">
            <div class="stat-item" onclick="openUsersModal('following', ${user.id}, '@${escapeHTML(user.username)} Following')">
              <span class="stat-num" id="profile-following-count">${user.stats.following_count}</span> Following
            </div>
            <div class="stat-item" onclick="openUsersModal('followers', ${user.id}, '@${escapeHTML(user.username)} Followers')">
              <span class="stat-num" id="profile-followers-count">${user.stats.followers_count}</span> Followers
            </div>
            <div class="stat-item">
              <span class="stat-num">${user.stats.posts_count}</span> Posts
            </div>
          </div>
        </div>

        <div class="profile-tabs">
          <button class="tab-btn ${activeTab === 'posts' ? 'active' : ''}" onclick="switchProfileTab('${escapeHTML(user.username)}', 'posts')">Posts</button>
          <button class="tab-btn ${activeTab === 'likes' ? 'active' : ''}" onclick="switchProfileTab('${escapeHTML(user.username)}', 'likes')">Likes</button>
        </div>

        <div class="posts-feed" id="profile-posts-list">
          <div class="loading-spinner-container"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    loadProfilePosts(username, activeTab);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>User not found</h4>
        <p>${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

function switchProfileTab(username, tab) {
  renderProfileView(username, tab);
}

async function loadProfilePosts(username, tab) {
  const container = document.getElementById('profile-posts-list');
  try {
    const data = tab === 'likes'
      ? await api.users.getLikes(username)
      : await api.users.getPosts(username);

    if (!data.posts || data.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h4>No posts to display</h4>
          <p>${tab === 'likes' ? 'This user has not liked any posts yet.' : 'This user has not published any posts yet.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.posts.map(renderPostCardHtml).join('');
  } catch (err) {
    container.innerHTML = `<p style="padding:1rem;color:var(--danger-color)">${escapeHTML(err.message)}</p>`;
  }
}

/* ==========================================================================
   FOLLOW / UNFOLLOW SYSTEM
   ========================================================================== */
async function toggleFollowUser(userId, buttonElement) {
  if (!auth.currentUser) {
    openAuthModal('login');
    return;
  }

  try {
    const res = await api.users.toggleFollow(userId);
    const isFollowing = res.following;

    if (buttonElement) {
      buttonElement.classList.toggle('btn-primary', !isFollowing);
      buttonElement.classList.toggle('btn-following', isFollowing);
      const span = buttonElement.querySelector('span');
      if (span) span.textContent = isFollowing ? 'Following' : 'Follow';
    }

    // If on profile view, update followers count
    const followersCountEl = document.getElementById('profile-followers-count');
    if (followersCountEl && res.followersCount !== undefined) {
      followersCountEl.textContent = res.followersCount;
    }

    showToast(res.message);
    loadSuggestions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==========================================================================
   USERS MODAL (Followers / Following)
   ========================================================================== */
async function openUsersModal(type, userId, title) {
  const modal = document.getElementById('users-modal');
  const titleEl = document.getElementById('users-modal-title');
  const listEl = document.getElementById('users-modal-list');

  titleEl.textContent = title;
  listEl.innerHTML = `<div class="loading-spinner-container"><div class="spinner"></div></div>`;
  modal.classList.remove('hidden');

  try {
    const res = type === 'followers'
      ? await api.users.getFollowers(userId)
      : await api.users.getFollowing(userId);

    const users = type === 'followers' ? res.followers : res.following;

    if (!users || users.length === 0) {
      listEl.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:1.5rem">No users found.</p>`;
      return;
    }

    listEl.innerHTML = users.map(u => `
      <div class="user-row">
        <div class="user-row-meta" onclick="closeUsersModal(); navigateTo('profile/${escapeHTML(u.username)}')">
          <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}" class="avatar avatar-sm" alt="${escapeHTML(u.display_name)}">
          <div>
            <div class="author-display-name">${escapeHTML(u.display_name)}</div>
            <div class="author-username">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        ${(auth.currentUser && auth.currentUser.id === u.id) ? '' : `
          <button class="btn btn-sm btn-follow ${u.is_following ? 'btn-following' : 'btn-primary'}" onclick="toggleFollowUser(${u.id}, this)">
            <span>${u.is_following ? 'Following' : 'Follow'}</span>
          </button>
        `}
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--danger-color)">${escapeHTML(err.message)}</p>`;
  }
}

function closeUsersModal() {
  document.getElementById('users-modal').classList.add('hidden');
}

/* ==========================================================================
   EXPLORE & SEARCH VIEW
   ========================================================================== */
async function renderExploreView() {
  const container = document.getElementById('view-explore');
  const query = currentSearchQuery.trim();

  container.innerHTML = `
    <div style="padding: 1.25rem;">
      <h3 style="margin-bottom: 1rem; font-size:1.15rem; font-weight:800;">
        ${query ? `Search results for "${escapeHTML(query)}"` : 'Explore Pulse'}
      </h3>
      <div id="explore-users-section" style="margin-bottom: 2rem;"></div>
      <div id="explore-posts-section" class="posts-feed"></div>
    </div>
  `;

  const usersSection = document.getElementById('explore-users-section');
  const postsSection = document.getElementById('explore-posts-section');

  try {
    if (query) {
      // Fetch users matching query
      const usersRes = await api.users.search(query);
      if (usersRes.users && usersRes.users.length > 0) {
        usersSection.innerHTML = `
          <h4 style="font-size:0.95rem;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.5px">People</h4>
          <div class="suggestions-list">
            ${usersRes.users.map(u => `
              <div class="user-row" style="background:var(--bg-secondary);padding:0.75rem;border-radius:var(--radius-md);border:1px solid var(--border-color)">
                <div class="user-row-meta" onclick="navigateTo('profile/${escapeHTML(u.username)}')">
                  <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}" class="avatar avatar-sm" alt="${escapeHTML(u.display_name)}">
                  <div>
                    <div class="author-display-name">${escapeHTML(u.display_name)}</div>
                    <div class="author-username">@${escapeHTML(u.username)}</div>
                  </div>
                </div>
                ${(auth.currentUser && auth.currentUser.id === u.id) ? '' : `
                  <button class="btn btn-sm btn-follow ${u.is_following ? 'btn-following' : 'btn-primary'}" onclick="toggleFollowUser(${u.id}, this)">
                    <span>${u.is_following ? 'Following' : 'Follow'}</span>
                  </button>
                `}
              </div>
            `).join('')}
          </div>
        `;
      }

      // Fetch posts matching query
      const postsRes = await api.posts.getFeed('all', query, '');
      if (postsRes.posts && postsRes.posts.length > 0) {
        postsSection.innerHTML = `
          <h4 style="font-size:0.95rem;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.5px">Posts</h4>
          ${postsRes.posts.map(renderPostCardHtml).join('')}
        `;
      } else if (!usersRes.users || usersRes.users.length === 0) {
        postsSection.innerHTML = `
          <div class="empty-state">
            <h4>No results found</h4>
            <p>Try searching for a different keyword or username.</p>
          </div>
        `;
      }
    } else {
      // Default explore: show trending posts
      const postsRes = await api.posts.getFeed('all');
      postsSection.innerHTML = (postsRes.posts || []).map(renderPostCardHtml).join('');
    }
  } catch (err) {
    postsSection.innerHTML = `<p style="color:var(--danger-color)">${escapeHTML(err.message)}</p>`;
  }
}

/* ==========================================================================
   POST DETAIL VIEW
   ========================================================================== */
async function renderPostDetailView(postId) {
  const container = document.getElementById('view-post-detail');
  container.innerHTML = `<div class="loading-spinner-container"><div class="spinner"></div></div>`;

  try {
    const data = await api.posts.getPost(postId);
    container.innerHTML = `
      <div style="border-bottom: 1px solid var(--border-color); padding: 0.5rem 1rem">
        <button class="btn-link" onclick="history.back()" style="display:flex;align-items:center;gap:0.4rem;font-weight:700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back
        </button>
      </div>
      <div id="post-detail-card">
        ${renderPostCardHtml(data.post)}
      </div>
    `;

    // Automatically expand and load comments for single post view
    togglePostComments(postId);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <h4>Post not found</h4>
        <p>${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

/* ==========================================================================
   RIGHT SIDEBAR WIDGETS
   ========================================================================== */
async function loadDemoUsersList() {
  const list = document.getElementById('demo-user-list');
  try {
    const data = await api.auth.getDemoUsers();
    list.innerHTML = data.users.map(u => `
      <div class="demo-user-item">
        <div class="demo-user-meta" onclick="navigateTo('profile/${escapeHTML(u.username)}')">
          <img src="${u.avatar_url}" class="avatar avatar-xs" alt="${escapeHTML(u.display_name)}">
          <div class="demo-user-names">
            <div class="demo-user-name">${escapeHTML(u.display_name)}</div>
            <div class="demo-user-handle">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="auth.demoLogin('${escapeHTML(u.username)}')" title="Switch to @${escapeHTML(u.username)}">
          Switch
        </button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted)">Demo accounts ready.</p>`;
  }
}

async function loadSuggestions() {
  const list = document.getElementById('suggestions-list');
  try {
    const data = await api.users.getSuggestions();
    if (!data.suggestions || data.suggestions.length === 0) {
      list.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted)">You're following everyone suggested!</p>`;
      return;
    }

    list.innerHTML = data.suggestions.map(u => `
      <div class="user-row">
        <div class="user-row-meta" onclick="navigateTo('profile/${escapeHTML(u.username)}')">
          <img src="${u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username}" class="avatar avatar-sm" alt="${escapeHTML(u.display_name)}">
          <div>
            <div class="author-display-name">${escapeHTML(u.display_name)}</div>
            <div class="author-username">@${escapeHTML(u.username)}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-follow ${u.is_following ? 'btn-following' : 'btn-primary'}" onclick="toggleFollowUser(${u.id}, this)">
          <span>${u.is_following ? 'Following' : 'Follow'}</span>
        </button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted)">Unable to load suggestions.</p>`;
  }
}

/* ==========================================================================
   EDIT PROFILE MODAL
   ========================================================================== */
function openEditProfileModal() {
  if (!auth.currentUser) return;
  const user = auth.currentUser;

  document.getElementById('edit-display-name').value = user.display_name || '';
  document.getElementById('edit-bio').value = user.bio || '';
  document.getElementById('edit-avatar-url').value = user.avatar_url || '';
  document.getElementById('edit-banner-url').value = user.banner_url || '';
  document.getElementById('edit-avatar-preview').src = user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username;

  document.getElementById('edit-profile-modal').classList.remove('hidden');
}

function closeEditProfileModal() {
  document.getElementById('edit-profile-modal').classList.add('hidden');
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const saveBtn = document.getElementById('save-profile-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    let avatarUrl = document.getElementById('edit-avatar-url').value.trim();
    const avatarFileInput = document.getElementById('edit-avatar-file');

    // If a photo was selected, upload it first
    if (avatarFileInput.files && avatarFileInput.files[0]) {
      const uploadRes = await api.upload.image(avatarFileInput.files[0]);
      avatarUrl = uploadRes.url;
    }

    const payload = {
      display_name: document.getElementById('edit-display-name').value.trim(),
      bio: document.getElementById('edit-bio').value.trim(),
      avatar_url: avatarUrl,
      banner_url: document.getElementById('edit-banner-url').value.trim()
    };

    const res = await api.users.updateProfile(payload);
    auth.currentUser = { ...auth.currentUser, ...res.user };
    auth.updateUI();
    closeEditProfileModal();
    showToast('Profile updated successfully! ✨');

    // Re-render current profile view
    renderProfileView(auth.currentUser.username);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

/* ==========================================================================
   AUTH MODAL & SUBMISSIONS
   ========================================================================== */
function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (tab === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
  } else {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const idInput = document.getElementById('login-identifier');
  const passInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');

  errEl.classList.add('hidden');
  try {
    await auth.login(idInput.value.trim(), passInput.value);
    closeAuthModal();
    showToast('Welcome back! 👋');
    handleRouting();
    loadSuggestions();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');

  errEl.classList.add('hidden');
  try {
    await auth.register({ display_name: name, username, email, password });
    closeAuthModal();
    showToast(`Welcome to Pulse, @${username}! 🎉`);
    handleRouting();
    loadSuggestions();
    loadDemoUsersList();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

/* ==========================================================================
   SEARCH & EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {
  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Composer file input
  const fileInput = document.getElementById('composer-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedMediaFile = file;
        composerMediaUrl = '';
        const previewUrl = URL.createObjectURL(file);
        document.getElementById('media-preview-img').src = previewUrl;
        document.getElementById('composer-media-preview').classList.remove('hidden');
      }
    });
  }

  // Edit avatar file input
  const editAvatarFileInput = document.getElementById('edit-avatar-file');
  if (editAvatarFileInput) {
    editAvatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const previewUrl = URL.createObjectURL(file);
        document.getElementById('edit-avatar-preview').src = previewUrl;
      }
    });
  }

  // Composer character counter
  const composerText = document.getElementById('composer-text');
  const charCounter = document.getElementById('char-counter');
  if (composerText && charCounter) {
    composerText.addEventListener('input', () => {
      const remaining = 1000 - composerText.value.length;
      charCounter.textContent = remaining;
      charCounter.style.color = remaining < 50 ? 'var(--danger-color)' : 'var(--text-muted)';
    });
  }

  // Search input with debounce
  const searchInput = document.getElementById('global-search-input');
  const searchClear = document.getElementById('search-clear-btn');
  let searchDebounceTimer;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      if (searchClear) searchClear.classList.toggle('hidden', !q);

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearchQuery = q;
        if (q.trim()) {
          navigateTo('explore');
          renderExploreView();
        } else if (window.location.hash === '#explore') {
          renderExploreView();
        }
      }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentSearchQuery = searchInput.value;
        navigateTo('explore');
        renderExploreView();
      }
    });
  }

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.add('hidden');
    }
  });
}

function clearSearch() {
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.value = '';
    currentSearchQuery = '';
    document.getElementById('search-clear-btn').classList.add('hidden');
    if (window.location.hash === '#explore') {
      renderExploreView();
    }
  }
}

/* ==========================================================================
   HELPERS & TOASTS
   ========================================================================== */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPostText(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  // Convert #hashtags to clickable links
  return escaped.replace(/#([a-zA-Z0-9_]+)/g, (match, tag) => {
    return `<span class="hashtag" onclick="event.stopPropagation(); filterByTag('${tag}')">#${tag}</span>`;
  });
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
