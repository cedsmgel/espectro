// Gerenciador de requisições e autenticação JWT da API do Espectro

export interface User {
  id: number;
  username: string;
}

export interface Post {
  id: number;
  author_id: number;
  author_name: string;
  author_avatar?: string;
  community_id?: number | null;
  community_name?: string | null;
  content: string;
  created_at: string;
}

export interface Community {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  owner_name: string;
  members_count: number;
  created_at: string;
}

const TOKEN_KEY = "espectro_jwt_token";
const USER_KEY = "espectro_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = (data as { error?: string })?.error || `Erro HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// 1. Autenticação
export async function register(username: string, email: string, password: string): Promise<User> {
  const result = await request<User>("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  return result;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const result = await request<{ token: string; user: User }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  setToken(result.token);
  setCurrentUser(result.user);
  return result;
}

// 2. Feed de Posts
export async function getPosts(): Promise<Post[]> {
  return request<Post[]>("/api/posts", { method: "GET" });
}

export async function createPost(content: string, community_id?: number | null): Promise<Post> {
  return request<Post>("/api/posts", {
    method: "POST",
    body: JSON.stringify({ content, community_id: community_id || null }),
  });
}

// 3. Comunidades
export async function getCommunities(): Promise<Community[]> {
  return request<Community[]>("/api/communities", { method: "GET" });
}

export async function createCommunity(name: string, description: string): Promise<Community> {
  return request<Community>("/api/communities", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function joinCommunity(community_id: number): Promise<{ message: string; community_id: number }> {
  return request<{ message: string; community_id: number }>("/api/communities", {
    method: "POST",
    body: JSON.stringify({ action: "join", community_id }),
  });
}
