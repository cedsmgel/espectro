export interface User {
  id: number;
  username: string;
}

export interface Post {
  id: number;
  author_id: number;
  community_id: number | null;
  content: string;
  created_at: string;
  author_name: string;
  community_name: string | null;
}

export interface Community {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
  member_count: number;
}

const TOKEN_KEY = 'espectro_token';
const USER_KEY = 'espectro_user';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
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

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Erro na requisição');
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

  async getPosts(): Promise<Post[]> {
    return apiRequest<Post[]>('/api/posts', { method: 'GET' });
  },

  async createPost(params: { content: string; community_id?: number | null }): Promise<Post> {
    return apiRequest<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getCommunities(): Promise<Community[]> {
    return apiRequest<Community[]>('/api/communities', { method: 'GET' });
  },

  async createCommunity(params: { name: string; description?: string }): Promise<Community> {
    return apiRequest<Community>('/api/communities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
};
