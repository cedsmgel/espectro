export interface User {
  id: number;
  username: string;
}

export interface Post {
  id: number;
  author_id: number;
  community_id: number | null;
  title?: string | null;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'gif' | null;
  upvotes?: number;
  downvotes?: number;
  post_type?: 'discussion' | 'scrap';
  created_at: string;
  author_name: string;
  author_avatar?: string | null;
  community_name: string | null;
  community_slug?: string | null;
  comments_count?: number;
}

export interface Community {
  id: number;
  name: string;
  slug?: string;
  description: string | null;
  owner_id: number;
  owner_name?: string;
  created_at: string;
  members_count: number;
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
  }
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

  async getPosts(filters?: { community_id?: number; community_slug?: string; post_type?: string }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (filters?.community_id) params.set('community_id', String(filters.community_id));
    if (filters?.community_slug) params.set('community_slug', filters.community_slug);
    if (filters?.post_type) params.set('post_type', filters.post_type);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<Post[]>(`/api/posts${qs}`, { method: 'GET' });
  },

  async createPost(params: {
    content: string;
    title?: string;
    community_id?: number | null;
    community_slug?: string | null;
    media_url?: string;
    media_type?: 'image' | 'video' | 'gif' | null;
    post_type?: 'discussion' | 'scrap';
  }): Promise<Post> {
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

  async createCommunity(params: { name: string; slug?: string; description?: string }): Promise<Community> {
    return apiRequest<Community>('/api/communities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async joinCommunity(params: { community_id?: number; community_slug?: string }): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/api/communities', {
      method: 'POST',
      body: JSON.stringify({
        action: 'join',
        ...params,
      }),
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
  }
};
