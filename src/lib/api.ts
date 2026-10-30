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
  } catch (err) {
    throw new Error('Falha de conexão com o servidor. Verifique sua internet.');
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
