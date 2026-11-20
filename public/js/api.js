// Pulse API Client
const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('pulse_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('pulse_token', token);
    } else {
      localStorage.removeItem('pulse_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  auth: {
    login(usernameOrEmail, password) {
      return api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, password })
      });
    },
    register(payload) {
      return api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    me() {
      return api.request('/auth/me');
    },
    getDemoUsers() {
      return api.request('/auth/demo-users');
    }
  },

  posts: {
    getFeed(feed = 'all', search = '', tag = '') {
      const params = new URLSearchParams();
      if (feed) params.append('feed', feed);
      if (search) params.append('search', search);
      if (tag) params.append('tag', tag);
      return api.request(`/posts?${params.toString()}`);
    },
    getPost(id) {
      return api.request(`/posts/${id}`);
    },
    create(data) {
      return api.request('/posts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    delete(id) {
      return api.request(`/posts/${id}`, {
        method: 'DELETE'
      });
    },
    toggleLike(id) {
      return api.request(`/posts/${id}/like`, {
        method: 'POST'
      });
    },
    getLikes(id) {
      return api.request(`/posts/${id}/likes`);
    }
  },

  comments: {
    getForPost(postId) {
      return api.request(`/posts/${postId}/comments`);
    },
    create(postId, content) {
      return api.request(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
    },
    delete(commentId) {
      return api.request(`/comments/${commentId}`, {
        method: 'DELETE'
      });
    }
  },

  users: {
    getProfile(username) {
      return api.request(`/users/${encodeURIComponent(username)}`);
    },
    updateProfile(data) {
      return api.request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    toggleFollow(userId) {
      return api.request(`/users/${userId}/follow`, {
        method: 'POST'
      });
    },
    getFollowers(userId) {
      return api.request(`/users/${userId}/followers`);
    },
    getFollowing(userId) {
      return api.request(`/users/${userId}/following`);
    },
    getPosts(username) {
      return api.request(`/users/${encodeURIComponent(username)}/posts`);
    },
    getLikes(username) {
      return api.request(`/users/${encodeURIComponent(username)}/likes`);
    },
    getSuggestions() {
      return api.request('/users/suggestions');
    },
    search(q) {
      return api.request(`/users/search?q=${encodeURIComponent(q)}`);
    }
  },

  upload: {
    image(file) {
      const formData = new FormData();
      formData.append('image', file);
      return api.request('/upload', {
        method: 'POST',
        body: formData
      });
    }
  }
};
