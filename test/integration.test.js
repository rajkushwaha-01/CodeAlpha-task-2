const app = require('../server');

async function runTests() {
  console.log('🧪 Starting Mini Social Media Platform API Test Suite...\n');

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function apiCall(endpoint, options = {}, token = null) {
    const headers = options.headers || {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('1. Health Check:');
    const health = await apiCall('/health');
    assert(health.status === 200 && health.data.status === 'ok', 'Health endpoint returns 200 OK');

    // 2. Demo Users & Login
    console.log('\n2. Authentication & Demo Users:');
    const demo = await apiCall('/auth/demo-users');
    assert(demo.data.users && demo.data.users.length >= 4, 'Demo users list returns seeded accounts');

    // Login as Sarah
    const sarahLogin = await apiCall('/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: 'sarah_codes', password: 'password123' }
    });
    assert(sarahLogin.ok && sarahLogin.data.token, 'Login as sarah_codes returns JWT token');
    const sarahToken = sarahLogin.data.token;

    // Register a new user (keep username under 20 chars)
    const testUsername = 'usr_' + Math.floor(Math.random() * 1000000);
    const registerRes = await apiCall('/auth/register', {
      method: 'POST',
      body: {
        username: testUsername,
        email: `${testUsername}@example.com`,
        password: 'password123',
        display_name: 'Test Explorer'
      }
    });
    assert(registerRes.status === 201 && registerRes.data.token, `Registered new user @${testUsername}`);
    const testToken = registerRes.data.token;
    const testUserId = registerRes.data.user.id;

    // 3. User Profiles & Follow System
    console.log('\n3. Profiles & Follow/Unfollow:');
    const sarahProfile = await apiCall('/users/sarah_codes', {}, testToken);
    assert(sarahProfile.ok && sarahProfile.data.user.username === 'sarah_codes', 'Get Sarah profile by username');
    const initialFollowers = sarahProfile.data.user.stats.followers_count;

    // TestUser follows Sarah
    const followRes = await apiCall(`/users/${sarahProfile.data.user.id}/follow`, { method: 'POST' }, testToken);
    assert(followRes.data.following === true, 'TestUser follows Sarah');

    // Check Sarah profile again
    const sarahProfileAfter = await apiCall('/users/sarah_codes', {}, testToken);
    assert(sarahProfileAfter.data.user.stats.followers_count === initialFollowers + 1, 'Sarah followers count increased by 1');
    assert(sarahProfileAfter.data.user.is_following === true, 'TestUser is reported as following Sarah');

    // TestUser unfollows Sarah
    const unfollowRes = await apiCall(`/users/${sarahProfile.data.user.id}/follow`, { method: 'POST' }, testToken);
    assert(unfollowRes.data.following === false, 'TestUser unfollows Sarah');

    // Update Profile
    const updateRes = await apiCall('/users/profile', {
      method: 'PUT',
      body: {
        display_name: 'Explorer Pro',
        bio: 'Updated bio for testing purposes 🚀',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'
      }
    }, testToken);
    assert(updateRes.ok && updateRes.data.user.display_name === 'Explorer Pro', 'Profile update persisted successfully');

    // 4. Posts & Likes
    console.log('\n4. Posts & Like System:');
    const createPostRes = await apiCall('/posts', {
      method: 'POST',
      body: {
        content: 'Excited to test the mini social platform! Hello world! #testing #codealpha',
        image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&fit=crop'
      }
    }, testToken);
    assert(createPostRes.status === 201 && createPostRes.data.post.id, 'Created new post with hashtags & image');
    const newPostId = createPostRes.data.post.id;

    // Sarah likes the new post
    const likeRes = await apiCall(`/posts/${newPostId}/like`, { method: 'POST' }, sarahToken);
    assert(likeRes.data.liked === true && likeRes.data.likesCount === 1, 'Sarah liked the post; likesCount is 1');

    // Get post detail
    const postDetail = await apiCall(`/posts/${newPostId}`, {}, sarahToken);
    assert(postDetail.data.post.is_liked === true, 'Post detail reflects Sarah has liked it');

    // 5. Comments
    console.log('\n5. Comments System:');
    const addCommentRes = await apiCall(`/posts/${newPostId}/comments`, {
      method: 'POST',
      body: { content: 'Welcome to the platform! Great first post 🎉' }
    }, sarahToken);
    assert(addCommentRes.status === 201 && addCommentRes.data.comment.id, 'Sarah commented on the post');
    const commentId = addCommentRes.data.comment.id;

    // Get comments list
    const commentsList = await apiCall(`/posts/${newPostId}/comments`, {}, testToken);
    assert(commentsList.data.comments.length === 1, 'Comments list returns 1 comment');
    assert(commentsList.data.comments[0].can_delete === true, 'Post owner can delete comments on their post');

    // Delete comment
    const delCommentRes = await apiCall(`/comments/${commentId}`, { method: 'DELETE' }, testToken);
    assert(delCommentRes.ok, 'Comment deleted successfully');

    // 6. Feeds & Search
    console.log('\n6. Feeds & Search:');
    const feedAll = await apiCall('/posts?feed=all');
    assert(feedAll.data.posts.length > 0, 'Feed "all" returns posts');

    const searchTag = await apiCall('/posts?tag=testing');
    assert(searchTag.data.posts.length >= 1, 'Filter by tag #testing found created post');

    const searchUser = await apiCall(`/users/search?q=${testUsername}`);
    assert(searchUser.data.users.length >= 1, `Search query found @${testUsername}`);

    // Clean up created post
    const delPostRes = await apiCall(`/posts/${newPostId}`, { method: 'DELETE' }, testToken);
    assert(delPostRes.ok, 'Post deleted successfully by author');

    console.log(`\n===============================================`);
    console.log(`🎉 TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`===============================================`);
  } catch (err) {
    console.error('Test execution failed with error:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
