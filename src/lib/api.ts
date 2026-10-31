import axios from 'axios';

export interface User {
  id: number;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface Post {
  id: number;
  author_id: number;
  community_id: number | null;
  title?: string | null;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'gif' | null;
  upvotes: number;
  downvotes: number;
  post_type: 'discussion' | 'scrap';
  created_at: string;
  author_name: string;
  author_avatar?: string | null;
  community_name: string | null;
  community_slug?: string | null;
  community_icon_color?: string | null;
  comments_count: number;
}

export interface Community {
  id: number;
  name: string;
  slug?: string;
  description: string | null;
  icon_color?: string | null;
  owner_id: number;
  owner_name?: string;
  created_at: string;
  members_count: number;
  is_member?: boolean;
}

export interface Comment {
  id: number;
  post_id: number;
  author_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar?: string | null;
}

export interface Friend {
  friendship_id?: number;
  friend_id: number;
  username: string;
  avatar_url?: string | null;
  status: string;
  online?: boolean;
  mood?: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_username: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'file' | 'location' | 'gif' | 'sticker';
  media_url: string | null;
  reply_to_id: number | null;
  client_id: string | null;
  reactions?: Array<{ user_id: number; emoji: string }>;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
}

export interface Conversation {
  friend_id: number;
  username: string;
  avatar_url?: string | null;
  last_message_id: number;
  last_sender_id: number;
  last_content: string;
  last_message_type: DirectMessage['message_type'];
  last_created_at: string;
  unread_count: number;
  muted: boolean;
  theme: string;
  wallpaper: string;
  nickname: string | null;
}

export interface ConversationSettings {
  friend_id: number;
  muted: boolean;
  theme: string;
  wallpaper: string;
  nickname: string | null;
  cleared_before_id: number;
}

export interface FriendRequest {
  friendship_id: number;
  friend_id: number;
  username: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface CreatePostData {
  title?: string;
  content: string;
  post_type?: 'discussion' | 'scrap';
  community_id?: number | null;
  community_slug?: string | null;
  media_url?: string;
  media_type?: 'image' | 'video' | 'gif' | null;
}

const TOKEN_KEY = 'espectro_token';
const USER_KEY = 'espectro_user';

function decodeJwtPayload(token: string): User | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    if (payload.id && payload.username) {
      return { id: payload.id, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      this.setUser(decoded);
    }
  },
  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    const token = this.getToken();
    if (token) {
      const decoded = decodeJwtPayload(token);
      if (decoded) {
        this.setUser(decoded);
        return decoded;
      }
    }
    return null;
  },
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Falha de conexão com o servidor. Verifique sua rede.');
  }

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { error: await response.text() };
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erro ${response.status}: falha na operação`);
  }

  return data as T;
}

export const api = {
  async register(params: { username: string; email: string; password: string }) {
    return apiRequest<{ id: number; username: string }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async login(params: { username: string; password: string }) {
    const res = await apiRequest<{ token: string; user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  logout() {
    authStorage.clear();
  },

  async getPosts(filters?: { community_id?: number; community_slug?: string; post_type?: string; feed?: string }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (filters?.community_id) params.set('community_id', String(filters.community_id));
    if (filters?.community_slug) params.set('community_slug', filters.community_slug);
    if (filters?.post_type) params.set('post_type', filters.post_type);
    if (filters?.feed) params.set('feed', filters.feed);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Post[]>(`/api/posts${qs}`, { method: 'GET' });
  },

  async createPost(params: CreatePostData): Promise<Post> {
    return apiRequest<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async votePost(postId: number, voteType: 'up' | 'down'): Promise<{ upvotes: number; downvotes: number }> {
    return apiRequest<{ upvotes: number; downvotes: number }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        action: 'vote',
        post_id: postId,
        vote_type: voteType,
      }),
    });
  },

  async getCommunities(): Promise<Community[]> {
    return apiRequest<Community[]>('/api/communities', { method: 'GET' });
  },

  async getCommunityBySlug(slug: string): Promise<Community> {
    return apiRequest<Community>(`/api/communities?slug=${encodeURIComponent(slug)}`, { method: 'GET' });
  },

  async createCommunity(params: { name: string; slug?: string; description?: string; icon_color?: string }): Promise<Community> {
    return apiRequest<Community>('/api/communities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async joinCommunity(params: { community_id?: number; community_slug?: string }): Promise<{ message: string; members_count?: number; is_member?: boolean }> {
    return apiRequest<{ message: string; members_count?: number; is_member?: boolean }>('/api/community_members', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async leaveCommunity(communityId: number): Promise<{ message: string; members_count?: number; is_member?: boolean }> {
    return apiRequest<{ message: string; members_count?: number; is_member?: boolean }>(`/api/community_members?community_id=${communityId}`, {
      method: 'DELETE',
    });
  },

  async getComments(postId: number): Promise<Comment[]> {
    return apiRequest<Comment[]>(`/api/comments?post_id=${postId}`, { method: 'GET' });
  },

  async createComment(params: { post_id: number; content: string; parent_id?: number | null }): Promise<Comment> {
    return apiRequest<Comment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

export const authApi = api;

export const postsApi = {
  list: (filters?: { community_id?: number; community_slug?: string; post_type?: string; feed?: string }) =>
    api.getPosts(filters),
  getById: (id: number) => apiRequest<Post>(`/api/posts/${id}`, { method: 'GET' }),
  create: (data: CreatePostData) => api.createPost(data),
  vote: (postId: number, voteType: 'up' | 'down') => api.votePost(postId, voteType),
  update: (postId: number, data: { title?: string | null; content: string }) =>
    apiRequest<{ success: boolean; message: string; post: Post }>(`/api/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (postId: number) =>
    apiRequest<{ success: boolean; message: string; deleted_id: number }>(`/api/posts/${postId}`, {
      method: 'DELETE',
    }),
};

export const communitiesApi = {
  list: () => api.getCommunities(),
  getBySlug: (slug: string) => api.getCommunityBySlug(slug),
  create: (data: { name: string; slug?: string; description?: string; icon_color?: string }) =>
    api.createCommunity(data),
  join: (communityId: number) => api.joinCommunity({ community_id: communityId }),
  leave: (communityId: number) => api.leaveCommunity(communityId),
};

export const commentsApi = {
  list: (postId: number) => api.getComments(postId),
  create: (postId: number, content: string, parentId?: number | null) =>
    api.createComment({ post_id: postId, content, parent_id: parentId }),
};

export const friendsApi = {
  list: () => apiRequest<Friend[]>('/api/friendships', { method: 'GET' }),
  search: (query: string) =>
    apiRequest<
      Array<{
        id: number;
        username: string;
        avatar_url?: string | null;
        friendship_status: string | null;
        friendship_from: number | null;
      }>
    >(`/api/friendships?search=${encodeURIComponent(query)}`, { method: 'GET' }),
  pending: () => apiRequest<FriendRequest[]>('/api/friendships?pending=1', { method: 'GET' }),
  add: (friendId: number, username?: string) =>
    apiRequest<{ message: string; friend: any }>('/api/friendships', {
      method: 'POST',
      body: JSON.stringify({ friend_id: friendId, friend_username: username }),
    }),
  remove: (friendId: number) =>
    apiRequest<{ message: string }>(`/api/friendships?friend_id=${friendId}`, {
      method: 'DELETE',
    }),
};

export const directMessagesApi = {
  list: (friendId: number, options?: { beforeId?: number; limit?: number }) => {
    const params = new URLSearchParams({ friend_id: String(friendId) });
    if (options?.beforeId) params.set('before_id', String(options.beforeId));
    if (options?.limit) params.set('limit', String(options.limit));
    return apiRequest<{ messages: DirectMessage[]; has_more: boolean }>(
      `/api/direct_messages?${params.toString()}`,
      { method: 'GET' }
    );
  },
  getUnreadCount: () =>
    apiRequest<{ unread_count: number }>('/api/direct_messages?unread=count', { method: 'GET' }),
  send: (params: {
    receiver_id: number;
    content: string;
    message_type?: DirectMessage['message_type'];
    media_url?: string | null;
    reply_to_id?: number | null;
    client_id?: string;
  }) =>
    apiRequest<{ message: DirectMessage; duplicate?: boolean }>('/api/direct_messages', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  remove: (messageId: number) =>
    apiRequest<{ success: boolean }>(`/api/direct_messages?id=${messageId}`, { method: 'DELETE' }),
  react: (messageId: number, emoji: string | null) =>
    apiRequest<{ message_id: number; user_id: number; emoji: string | null }>('/api/direct_messages/reaction', {
      method: 'PUT',
      body: JSON.stringify({ message_id: messageId, emoji }),
    }),
  markAllRead: () =>
    apiRequest<{ marked: number }>('/api/direct_messages/read', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    }),
  markRead: (friendId: number) =>
    apiRequest<{ marked: number }>('/api/direct_messages/read', {
      method: 'POST',
      body: JSON.stringify({ friend_id: friendId }),
    }),
};

export const conversationSettingsApi = {
  get: (friendId: number) =>
    apiRequest<ConversationSettings>(`/api/conversation_settings?friend_id=${friendId}`, { method: 'GET' }),
  update: (
    friendId: number,
    patch: Partial<Pick<ConversationSettings, 'muted' | 'theme' | 'wallpaper' | 'nickname'>> & { clear?: boolean }
  ) =>
    apiRequest<ConversationSettings>('/api/conversation_settings', {
      method: 'PUT',
      body: JSON.stringify({ friend_id: friendId, ...patch }),
    }),
};

export type AppNotificationType = 'friend_accepted' | 'post_comment' | 'comment_reply' | 'post_upvote';

export interface AppNotification {
  id: number;
  type: AppNotificationType;
  post_id: number | null;
  comment_id: number | null;
  content: string | null;
  read: boolean;
  created_at: string;
  actor_id: number | null;
  actor_username: string | null;
  actor_avatar?: string | null;
}

export interface NotificationSummary {
  unread: number;
  pending_requests: number;
  unread_messages: number;
  total_badge: number;
}

export interface FriendSuggestion {
  id: number;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  mutual_friends: number;
  shared_communities: number;
}

export const notificationsApi = {
  list: (beforeId?: number) =>
    apiRequest<{ notifications: AppNotification[]; has_more: boolean; summary: NotificationSummary }>(
      `/api/notifications${beforeId ? `?before_id=${beforeId}` : ''}`,
      { method: 'GET' }
    ),
  counts: () => apiRequest<NotificationSummary>('/api/notifications?count=1', { method: 'GET' }),
  markRead: (ids: number[]) =>
    apiRequest<{ summary: NotificationSummary }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'read', ids }),
    }),
  markUnread: (ids: number[]) =>
    apiRequest<{ summary: NotificationSummary }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'unread', ids }),
    }),
  markAllRead: () =>
    apiRequest<{ summary: NotificationSummary }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'read_all' }),
    }),
  remove: (id: number) =>
    apiRequest<{ summary: NotificationSummary }>(`/api/notifications?id=${id}`, { method: 'DELETE' }),
};

export const suggestionsApi = {
  list: () => apiRequest<FriendSuggestion[]>('/api/friend_suggestions', { method: 'GET' }),
  dismiss: (id: number) =>
    apiRequest<{ dismissed: boolean }>('/api/friend_suggestions', {
      method: 'POST',
      body: JSON.stringify({ dismiss_id: id }),
    }),
};

export interface BlockedUser {
  id: number;
  username: string;
  avatar_url?: string | null;
  created_at: string;
}

export const blocksApi = {
  list: () => apiRequest<BlockedUser[]>('/api/blocks', { method: 'GET' }),
  block: (userId: number) =>
    apiRequest<{ blocked: boolean }>('/api/blocks', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  unblock: (userId: number) =>
    apiRequest<{ blocked: boolean }>(`/api/blocks?user_id=${userId}`, { method: 'DELETE' }),
};

export const reportsApi = {
  send: (params: { user_id: number; reason: string; details?: string; message_id?: number | null }) =>
    apiRequest<{ reported: boolean }>('/api/reports', { method: 'POST', body: JSON.stringify(params) }),
};

export const conversationsApi = {
  list: () => apiRequest<Conversation[]>('/api/conversations', { method: 'GET' }),
};

export interface UploadResponse {
  url: string;
  key: string;
  media_type: 'video' | 'image';
  filename: string;
  size: number;
  content_type: string;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  context?: string;
}

export const uploadApi = {
  upload: async (file: File, options?: UploadOptions): Promise<UploadResponse> => {
    const token = authStorage.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (options?.context) {
      formData.append('context', options.context);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await axios.post<UploadResponse>('/api/upload', formData, {
        headers,
        signal: options?.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && options?.onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            options.onProgress(percent);
          }
        },
      });
      return response.data;
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError') {
        throw new Error('Upload cancelado pelo usuário.');
      }
      const msg = err.response?.data?.error || err.message || 'Falha no upload do arquivo';
      throw new Error(msg);
    }
  },
};

export interface UserProfile {
  id: number;
  username: string;
  email?: string;
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  music?: string | null;
  is_private?: boolean;
  allow_scraps?: boolean;
  is_friend?: boolean;
  is_self?: boolean;
  friendship_status?: string | null;
  friendship_direction?: 'outgoing' | 'incoming' | null;
  friends_count?: number;
  blocked_by_me?: boolean;
  created_at?: string;
}

export interface SearchResults {
  users: Array<{
    id: number;
    username: string;
    name?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
  }>;
  communities: Array<{
    id: number;
    name: string;
    slug?: string | null;
    description?: string | null;
    icon_color?: string | null;
    members_count?: number;
  }>;
  posts: Array<{
    id: number;
    title?: string | null;
    content: string;
    media_url?: string | null;
    media_type?: string | null;
    post_type: 'discussion' | 'scrap';
    author_name: string;
    author_avatar?: string | null;
    community_name?: string | null;
    community_slug?: string | null;
    created_at: string;
  }>;
}

export const searchApi = {
  search: async (query: string): Promise<SearchResults> => {
    return apiRequest<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`);
  },
};

export const usersApi = {
  getByUsername: async (
    username: string
  ): Promise<{ user: UserProfile; communities: Community[] }> => {
    return apiRequest<{ user: UserProfile; communities: Community[] }>(
      `/api/users/${encodeURIComponent(username)}`
    );
  },
};

export const friendshipsApi = {
  addFriend: async (
    friendUsernameOrId: string | number
  ): Promise<{ success: boolean; message: string }> => {
    const payload =
      typeof friendUsernameOrId === 'number'
        ? { friend_id: friendUsernameOrId }
        : { friend_username: friendUsernameOrId };
    return apiRequest<{ success: boolean; message: string }>('/api/friendships', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  list: async (): Promise<any[]> => {
    return apiRequest<any[]>('/api/friendships');
  },
};

export interface AccountSettings {
  is_private: boolean;
  allow_scraps: boolean;
  show_last_seen: boolean;
}

export interface FriendPresence {
  visible: boolean;
  online: boolean;
  last_seen_at: string | null;
}

export const presenceApi = {
  ping: () => apiRequest<{ ok: boolean }>('/api/presence', { method: 'POST' }),
  get: (friendId: number) => apiRequest<FriendPresence>(`/api/presence?friend_id=${friendId}`, { method: 'GET' }),
};

export const accountApi = {
  getSettings: async (): Promise<AccountSettings> => {
    const res = await apiRequest<{ settings: AccountSettings }>('/api/users/settings', { method: 'GET' });
    return res.settings;
  },
  updateSettings: async (settings: Partial<AccountSettings>): Promise<{ success: boolean; message: string; settings: AccountSettings }> => {
    return apiRequest<{ success: boolean; message: string; settings: AccountSettings }>('/api/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

export const profileApi = {
  get: async (username?: string): Promise<UserProfile> => {
    const url = username ? `/api/profile?username=${encodeURIComponent(username)}` : '/api/profile';
    const res = await apiRequest<{ user: UserProfile }>(url, { method: 'GET' });
    return res.user;
  },
  update: async (data: {
    name?: string | null;
    username?: string;
    bio?: string | null;
    avatar_url?: string | null;
  }): Promise<{ user: UserProfile; token?: string; message: string }> => {
    return apiRequest<{ user: UserProfile; token?: string; message: string }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
