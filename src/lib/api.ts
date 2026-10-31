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
  sender_name: string;
  content: string;
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
  search: (query: string) => apiRequest<Array<{ id: number; username: string; friendship_status: string | null }>>(`/api/friendships?search=${encodeURIComponent(query)}`, { method: 'GET' }),
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
  list: (friendId: number) =>
    apiRequest<DirectMessage[]>(`/api/direct_messages?friend_id=${friendId}`, { method: 'GET' }),
  getUnreadCount: () =>
    apiRequest<{ unread_count: number }>('/api/direct_messages?unread=count', { method: 'GET' }),
  send: (params: { receiver_id: number; content: string }) =>
    apiRequest<DirectMessage>('/api/direct_messages', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
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
}

export const uploadApi = {
  upload: async (file: File, options?: UploadOptions): Promise<UploadResponse> => {
    const token = authStorage.getToken();
    const formData = new FormData();
    formData.append('file', file);

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
  is_private?: boolean;
  allow_scraps?: boolean;
  is_friend?: boolean;
  is_self?: boolean;
  created_at?: string;
}

export interface AccountSettings {
  is_private: boolean;
  allow_scraps: boolean;
}

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
