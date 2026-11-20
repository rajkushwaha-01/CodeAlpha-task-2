// Auth State Manager
const auth = {
  currentUser: null,
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify() {
    this.listeners.forEach(fn => fn(this.currentUser));
  },

  async init() {
    const token = api.getToken();
    if (token) {
      try {
        const data = await api.auth.me();
        this.currentUser = data.user;
      } catch (err) {
        console.warn('Stored session invalid or expired:', err);
        api.setToken(null);
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
    }
    this.updateUI();
    this.notify();
  },

  async login(usernameOrEmail, password) {
    const data = await api.auth.login(usernameOrEmail, password);
    api.setToken(data.token);
    this.currentUser = data.user;
    this.updateUI();
    this.notify();
    return data;
  },

  async register(details) {
    const data = await api.auth.register(details);
    api.setToken(data.token);
    this.currentUser = data.user;
    this.updateUI();
    this.notify();
    return data;
  },

  logout() {
    api.setToken(null);
    this.currentUser = null;
    this.updateUI();
    this.notify();
    showToast('Logged out successfully');
    navigateTo('feed');
  },

  async demoLogin(username) {
    try {
      showToast(`Signing in as @${username}...`);
      await this.login(username, 'password123');
      showToast(`Signed in as @${username}!`);
      // Refresh current view if needed
      if (window.refreshCurrentView) {
        window.refreshCurrentView();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  updateUI() {
    const sidebarSection = document.getElementById('sidebar-user-section');
    const composerCard = document.getElementById('composer-card');
    const composerAvatar = document.getElementById('composer-avatar');
    const profileNavLink = document.getElementById('nav-profile-link');
    const authOnlyElements = document.querySelectorAll('.auth-only');

    if (this.currentUser) {
      // Authenticated view
      if (composerAvatar) {
        composerAvatar.src = this.currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + this.currentUser.username;
      }
      if (composerCard) {
        composerCard.classList.remove('hidden');
      }

      if (profileNavLink) {
        profileNavLink.href = `#profile/${this.currentUser.username}`;
      }

      authOnlyElements.forEach(el => el.classList.remove('hidden'));

      if (sidebarSection) {
        sidebarSection.innerHTML = `
          <div class="user-profile-badge" onclick="navigateTo('profile/${this.currentUser.username}')">
            <img src="${this.currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + this.currentUser.username}" alt="${this.currentUser.display_name}" class="avatar avatar-sm">
            <div class="badge-info">
              <div class="badge-name">${escapeHTML(this.currentUser.display_name)}</div>
              <div class="badge-handle">@${escapeHTML(this.currentUser.username)}</div>
            </div>
            <button class="badge-logout-btn" onclick="event.stopPropagation(); auth.logout()" title="Log out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        `;
      }
    } else {
      // Guest view
      if (composerAvatar) {
        composerAvatar.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=guest';
      }
      if (profileNavLink) {
        profileNavLink.href = '#login';
      }

      if (sidebarSection) {
        sidebarSection.innerHTML = `
          <div class="guest-card">
            <p>Join the conversation today on Pulse.</p>
            <div class="guest-btn-group">
              <button class="btn btn-secondary btn-sm btn-block" onclick="openAuthModal('login')">Sign In</button>
              <button class="btn btn-primary btn-sm btn-block" onclick="openAuthModal('register')">Sign Up</button>
            </div>
          </div>
        `;
      }
    }
  }
};
