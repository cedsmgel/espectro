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
  saved?: number | boolean;
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
  type?: CommunityType;
  welcome_message?: string | null;
  require_tag?: boolean;
  rules?: Array<{ title: string; description: string | null }>;
  tags?: string[];
  my_role?: 'owner' | 'moderator' | 'member' | null;
  my_status?: 'active' | 'pending' | 'banned' | null;
  i_am_mod?: boolean;
  can_post_here?: boolean;
  locked?: boolean;
  ban_reason?: string | null;
  banned_until?: string | null;
}

export type CommunityType = 'public' | 'restricted' | 'private';

export interface CreateCommunityData {
  name: string;
  description?: string;
  icon_color?: string;
  type?: CommunityType;
  tags?: string[];
  rules?: Array<{ title: string; description?: string }>;
  welcome_message?: string;
  require_tag?: boolean;
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
  message_type: 'text' | 'image' | 'video' | 'file' | 'location' | 'gif' | 'sticker' | 'audio';
  media_url: string | null;
  reply_to_id: number | null;
  client_id: string | null;
  reactions?: Array<{ user_id: number; emoji: string }>;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  edited_at?: string | null;
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
  pinned: boolean;
  manual_unread: boolean;
  archived: boolean;
  peer_last_seen_at: string | null;
  muted: boolean;
  theme: string;
  wallpaper: string;
  nickname: string | null;
}

export interface ConversationSettings {
  friend_id: number;
  pinned: boolean;
  manual_unread: boolean;
  archived: boolean;
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

import { currentPath, notifyAuthChanged, requestAuth } from './authEvents';

export type LoginResult =
  | { mfa_required: true; mfa_token: string }
  | { token: string; user: User; deletion_canceled?: boolean };

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
    notifyAuthChanged();
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
    try {
      (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google?.accounts?.id?.disableAutoSelect?.();
    } catch {}
    notifyAuthChanged();
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
    const isAuthEndpoint = url.startsWith('/api/login') || url.startsWith('/api/register');
    if (response.status === 401 && !isAuthEndpoint) {
      if (token) {
        // Sessão expirada ou encerrada em outro aparelho: limpa e pede o login de novo, voltando para esta página
        authStorage.clear();
        requestAuth({ mode: 'login', reason: 'Sua sessão expirou. Entre novamente para continuar.', redirectTo: currentPath() });
      } else if ((options.method || 'GET').toUpperCase() !== 'GET') {
        // Visitante tentou uma ação que exige conta
        requestAuth({ mode: 'login', reason: 'Entre ou crie uma conta para continuar.' });
      }
    }
    // Conta suspensa: encerra a sessão e leva ao login com o aviso
    if (response.status === 403 && data?.suspended && token) {
      try {
        sessionStorage.setItem('espectro_login_notice', data.error || 'Sua conta foi suspensa.');
      } catch {}
      authStorage.clear();
      window.location.href = '/login';
    }
    const failure = new Error(data?.error || `Erro ${response.status}: falha na operação`) as Error & { mfaRequired?: boolean };
    // 403 com mfa_required: a ação exige uma verificação recente do segundo fator
    failure.mfaRequired = Boolean(data?.mfa_required);
    throw failure;
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

  // Com verificação em duas etapas, a senha só abre o segundo passo (mfa_required) e nenhuma sessão é criada
  async login(params: { username: string; password: string }): Promise<LoginResult> {
    const res = await apiRequest<LoginResult>('/api/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if ('mfa_required' in res) return res;
    if (res.deletion_canceled) {
      try {
        sessionStorage.setItem('espectro_notice', 'Que bom ter você de volta! A exclusão da sua conta foi cancelada.');
      } catch {}
    }
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  async loginMfa(mfaToken: string, factor: { code?: string; recovery_code?: string }) {
    const res = await apiRequest<{ token: string; user: User; deletion_canceled?: boolean }>('/api/login/mfa', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, ...factor }),
    });
    if (res.deletion_canceled) {
      try {
        sessionStorage.setItem('espectro_notice', 'Que bom ter você de volta! A exclusão da sua conta foi cancelada.');
      } catch {}
    }
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  logout() {
    authStorage.clear();
  },

  async getPosts(filters?: {
    community_id?: number;
    community_slug?: string;
    post_type?: string;
    feed?: string;
    saved?: boolean;
    tag?: string;
    author_name?: string;
    media?: 'video' | 'any';
    before_id?: number;
    limit?: number;
  }): Promise<Post[]> {
    const params = new URLSearchParams();
    if (filters?.media) params.set('media', filters.media);
    if (filters?.before_id) params.set('before_id', String(filters.before_id));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.community_id) params.set('community_id', String(filters.community_id));
    if (filters?.community_slug) params.set('community_slug', filters.community_slug);
    if (filters?.post_type) params.set('post_type', filters.post_type);
    if (filters?.feed) params.set('feed', filters.feed);
    if (filters?.saved) params.set('saved', '1');
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.author_name) params.set('author_name', filters.author_name);
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

  async createCommunity(params: CreateCommunityData): Promise<Community> {
    return apiRequest<Community>('/api/communities', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async joinCommunity(params: { community_id?: number; community_slug?: string }): Promise<{ message: string; members_count?: number; is_member?: boolean; status?: 'active' | 'pending' | null }> {
    return apiRequest<{ message: string; members_count?: number; is_member?: boolean; status?: 'active' | 'pending' | null }>('/api/community_members', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async leaveCommunity(communityId: number): Promise<{ message: string; members_count?: number; is_member?: boolean; status?: 'active' | 'pending' | null }> {
    return apiRequest<{ message: string; members_count?: number; is_member?: boolean; status?: 'active' | 'pending' | null }>(`/api/community_members?community_id=${communityId}`, {
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
  list: (filters?: Parameters<typeof api.getPosts>[0]) => api.getPosts(filters),
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
  create: (data: CreateCommunityData) => api.createCommunity(data),
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
  edit: (messageId: number, content: string) =>
    apiRequest<{ message: DirectMessage }>('/api/direct_messages', {
      method: 'PATCH',
      body: JSON.stringify({ id: messageId, content }),
    }),
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
    patch: Partial<Pick<ConversationSettings, 'muted' | 'theme' | 'wallpaper' | 'nickname' | 'pinned' | 'manual_unread' | 'archived'>> & { clear?: boolean }
  ) =>
    apiRequest<ConversationSettings>('/api/conversation_settings', {
      method: 'PUT',
      body: JSON.stringify({ friend_id: friendId, ...patch }),
    }),
};

export type AppNotificationType = 'friend_accepted' | 'post_comment' | 'comment_reply' | 'post_upvote' | 'security_login';

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
  interactions?: number;
}

export interface CommunitySuggestion {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  icon_color?: string | null;
  members_count: number;
  friends_in: number;
  recent_posts: number;
}

export const communitySuggestionsApi = {
  list: () => apiRequest<CommunitySuggestion[]>('/api/community_suggestions', { method: 'GET' }),
  dismiss: (communityId: number) =>
    apiRequest<{ dismissed: boolean }>('/api/community_suggestions', {
      method: 'POST',
      body: JSON.stringify({ dismiss_id: communityId }),
    }),
  join: (communityId: number) => api.joinCommunity({ community_id: communityId }),
};

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
  send: (params: { user_id: number; reason: string; details?: string; message_id?: number | null; post_id?: number | null; comment_id?: number | null }) =>
    apiRequest<{ reported: boolean }>('/api/reports', { method: 'POST', body: JSON.stringify(params) }),
};

export interface AdminReport {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  resolution_note: string | null;
  message_id: number | null;
  post_id: number | null;
  comment_id: number | null;
  created_at: string;
  resolved_at: string | null;
  reporter_id: number;
  reporter_username: string;
  reported_id: number;
  reported_username: string;
  reported_suspended: boolean;
  reported_is_admin: boolean;
  message_content: string | null;
  post_title: string | null;
  post_content: string | null;
  comment_content: string | null;
  reported_total: number;
}

export interface AdminUser {
  id: number;
  username: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  reports_total: number;
  reports_open: number;
}

export interface AdminVitalsMetric {
  name: string;
  device: 'phone' | 'desktop';
  count: number;
  p75: number;
  good: number;
  needs: number;
  poor: number;
}

export interface AdminVitals {
  days: number;
  total: number;
  metrics: AdminVitalsMetric[];
  pages: Array<{ path: string; count: number; p75: number }>;
}

export const adminApi = {
  me: () => apiRequest<{ is_admin: boolean }>('/api/admin/me'),
  reports: (status: 'open' | 'closed', beforeId?: number) =>
    apiRequest<{ reports: AdminReport[]; has_more: boolean; open_count: number }>(
      `/api/admin/reports?status=${status}${beforeId ? `&before_id=${beforeId}` : ''}`
    ),
  resolveReport: (body: { id: number; resolution: 'dismissed' | 'actioned'; note?: string; suspend?: boolean; remove_content?: boolean }) =>
    apiRequest<{ resolved: boolean; done: string[] }>('/api/admin/reports', { method: 'POST', body: JSON.stringify(body) }),
  users: (q: string) => apiRequest<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
  setSuspended: (userId: number, suspend: boolean, reason?: string) =>
    apiRequest<{ suspended: boolean }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, action: suspend ? 'suspend' : 'unsuspend', reason }),
    }),
  vitals: (days: number) => apiRequest<AdminVitals>(`/api/admin/vitals?days=${days}`),
  removeContent: (type: 'post' | 'comment', id: number, note?: string) =>
    apiRequest<{ removed: boolean }>(
      `/api/admin/content?type=${type}&id=${id}${note ? `&note=${encodeURIComponent(note)}` : ''}`,
      { method: 'DELETE' }
    ),
};

export interface MessageSearchResponse {
  messages: Array<{ id: number; content: string; sender_id: number; created_at: string; friend_id: number; friend_username: string }>;
  groups: Array<{ id: number; content: string; group_id: number; group_name: string; sender_username: string | null; created_at: string }>;
}

export const messageSearchApi = {
  messages: (q: string) => apiRequest<MessageSearchResponse>(`/api/message_search?q=${encodeURIComponent(q)}`),
};

export interface GroupSummary {
  id: number;
  name: string;
  description: string | null;
  role: "admin" | "member";
  only_admins_send: number;
  members_count: number;
  unread_count: number;
  last_content: string | null;
  last_sender: string | null;
  last_created_at: string | null;
}

export interface GroupMember {
  id: number;
  username: string;
  avatar_url?: string | null;
  role: "admin" | "member";
  joined_at: string;
}

export interface GroupMessage {
  edited_at?: string | null;
  reply_to_id?: number | null;
  reply_content?: string | null;
  reply_sender?: string | null;
  reply_deleted?: boolean;
  deleted?: boolean;
  id: number;
  content: string;
  message_type: 'text' | 'gif' | 'sticker' | 'system' | 'image' | 'video' | 'audio' | 'file';
  media_url: string | null;
  sender_id: number | null;
  sender_username: string | null;
  created_at: string;
}

export const groupsApi = {
  list: () => apiRequest<GroupSummary[]>("/api/groups", { method: "GET" }),
  create: (data: { name: string; description?: string; member_ids: number[] }) =>
    apiRequest<{ id: number; name: string }>("/api/groups", { method: "POST", body: JSON.stringify(data) }),
  detail: (id: number) =>
    apiRequest<{ group: { id: number; name: string; description: string | null; only_admins_send: boolean }; members: GroupMember[]; my_role: "admin" | "member" }>(
      `/api/groups/${id}`,
      { method: "GET" }
    ),
  messages: (id: number, beforeId?: number) =>
    apiRequest<{ messages: GroupMessage[]; has_more: boolean }>(
      `/api/groups/${id}/messages${beforeId ? `?before_id=${beforeId}` : ""}`,
      { method: "GET" }
    ),
  send: (id: number, payload: { content?: string; message_type?: 'gif' | 'sticker' | 'image' | 'video' | 'audio' | 'file'; media_url?: string; reply_to_id?: number | null }) =>
    apiRequest<{ message: GroupMessage }>(`/api/groups/${id}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  remove: (id: number, messageId: number) =>
    apiRequest<{ ok: boolean }>(`/api/groups/${id}/messages/${messageId}`, { method: "DELETE" }),
  edit: (id: number, messageId: number, content: string) =>
    apiRequest<{ edited: boolean; content: string; edited_at?: string | null }>(`/api/groups/${id}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  manage: (id: number, body: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`/api/groups/${id}/manage`, { method: "POST", body: JSON.stringify(body) }),
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

// Momentum: conteúdo de 24 horas visível para amigos
export interface MomentOverlay {
  filter?: string;
  brightness?: number;
  contrast?: number;
  text_pos?: 'top' | 'center' | 'bottom';
}

export interface Moment {
  id: number;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text';
  text: string | null;
  bg: string | null;
  overlay: string | null;
  created_at: string;
  expires_at: string;
  viewed: boolean;
  views_count: number;
}

export interface MomentGroup {
  user_id: number;
  username: string;
  avatar_url: string | null;
  items: Moment[];
  all_viewed: boolean;
  latest_at: string;
}

export interface MomentViewer {
  id: number;
  username: string;
  avatar_url: string | null;
  viewed_at: string;
}

export const momentsApi = {
  list: () => apiRequest<MomentGroup[]>('/api/moments', { method: 'GET' }),
  create: (data: { media_url?: string; media_type: 'image' | 'video' | 'text'; text?: string; bg?: string; overlay?: MomentOverlay }) =>
    apiRequest<{ id: number }>('/api/moments', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: number) => apiRequest<{ deleted: boolean }>(`/api/moments/${id}`, { method: 'DELETE' }),
  markViewed: (id: number) => apiRequest<{ ok: boolean }>(`/api/moments/${id}/view`, { method: 'POST' }),
  viewers: (id: number) => apiRequest<MomentViewer[]>(`/api/moments/${id}/view`, { method: 'GET' }),
};

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
  cover_url?: string | null;
  music?: string | null;
  is_private?: boolean;
  allow_scraps?: boolean;
  email_verified?: boolean;
  has_password?: boolean;
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

export const hashtagsApi = {
  trending: (limit = 10) => apiRequest<Array<{ tag: string; posts: number }>>(`/api/hashtags?trending=1&limit=${limit}`, { method: 'GET' }),
  suggest: (prefix: string) => apiRequest<Array<{ tag: string; posts: number }>>(`/api/hashtags?q=${encodeURIComponent(prefix)}`, { method: 'GET' }),
  info: (tag: string) => apiRequest<{ tag: string; posts: number }>(`/api/hashtags?tag=${encodeURIComponent(tag)}`, { method: 'GET' }),
};

export const savedApi = {
  add: (postId: number) => apiRequest<{ saved: boolean }>('/api/saved', { method: 'POST', body: JSON.stringify({ post_id: postId }) }),
  remove: (postId: number) => apiRequest<{ saved: boolean }>(`/api/saved?post_id=${postId}`, { method: 'DELETE' }),
};

export interface ProfileFriend {
  id: number;
  username: string;
  name: string | null;
  avatar_url: string | null;
  mutual: number;
}

export interface MyActivity {
  comments: Array<{ id: number; post_id: number; content: string; created_at: string; post_title: string | null; post_content: string }>;
  votes: Array<{ post_id: number; vote: number; post_title: string | null; post_content: string }>;
}

export const profileSectionsApi = {
  friends: (username: string, q?: string) =>
    apiRequest<{ locked: boolean; friends: ProfileFriend[] }>(
      `/api/profile_friends?username=${encodeURIComponent(username)}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      { method: 'GET' }
    ),
  activity: () => apiRequest<MyActivity>('/api/activity', { method: 'GET' }),
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

export const DELETION_REASON_OPTIONS: { id: string; label: string }[] = [
  { id: 'privacidade', label: 'Preocupação com privacidade ou meus dados' },
  { id: 'nao_uso_mais', label: 'Não uso mais o Espectro' },
  { id: 'muito_tempo', label: 'Estou gastando tempo demais em redes sociais' },
  { id: 'outra_plataforma', label: 'Encontrei outra plataforma' },
  { id: 'problemas_tecnicos', label: 'Problemas técnicos ou lentidão' },
  { id: 'moderacao', label: 'Discordo de regras ou da moderação' },
  { id: 'assedio', label: 'Sofri assédio ou me senti inseguro(a)' },
  { id: 'faltam_recursos', label: 'Faltam recursos que eu queria' },
  { id: 'outro', label: 'Outro motivo' },
];

export interface ThisDevice {
  browser: string;
  os: string;
  device: 'mobile' | 'tablet' | 'desktop';
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

export interface AccountSession {
  id: string;
  ip: string | null;
  current: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: 'mobile' | 'tablet' | 'desktop' | null;
  created_at: string;
  last_seen_at: string;
}

// Recuperação de senha e confirmação de e-mail
let emailEnabledCache: Promise<boolean> | null = null;
export const authFlowApi = {
  // O Espectro só mostra "Esqueci minha senha" quando o servidor consegue enviar e-mails
  googleEnabled: (): Promise<boolean> =>
    fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<{ google_enabled?: boolean }>) : { google_enabled: false }))
      .then((c) => Boolean(c.google_enabled))
      .catch(() => false),
  mfaEnabled: (): Promise<boolean> =>
    fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<{ mfa_enabled?: boolean }>) : { mfa_enabled: false }))
      .then((c) => Boolean(c.mfa_enabled))
      .catch(() => false),
  emailEnabled: (): Promise<boolean> => {
    if (!emailEnabledCache) {
      emailEnabledCache = fetch('/api/config')
        .then((r) => (r.ok ? (r.json() as Promise<{ email_enabled?: boolean }>) : { email_enabled: false }))
        .then((c: { email_enabled?: boolean }) => Boolean(c.email_enabled))
        .catch(() => false);
    }
    return emailEnabledCache;
  },
  forgotPassword: (email: string) =>
    apiRequest<{ ok: boolean }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    apiRequest<{ changed: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail: (token: string) =>
    apiRequest<{ verified: boolean }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: () =>
    apiRequest<{ sent?: boolean; already_verified?: boolean }>('/api/auth/resend-verification', { method: 'POST' }),
};

export const googleApi = {
  // Devolve o endereço do Google para onde o navegador deve ir
  start: async (mode: 'login' | 'link') => (await apiRequest<{ url: string }>('/api/auth/google/start', { method: 'POST', body: JSON.stringify({ mode }) })).url,
  exchange: (code: string) =>
    apiRequest<LoginResult>('/api/auth/google/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
  // One Tap: nonce de uso único que o Google grava na credencial, e a credencial que volta para validação no servidor
  oneTapNonce: () => apiRequest<{ nonce: string }>('/api/auth/google/onetap-nonce', { method: 'POST' }),
  oneTap: (credential: string) =>
    apiRequest<LoginResult | { link_required: true; link_token: string; email: string }>('/api/auth/google/onetap', { method: 'POST', body: JSON.stringify({ credential }) }),
  linkCredential: (linkToken: string) =>
    apiRequest<{ linked: boolean }>('/api/account/google-link', { method: 'POST', body: JSON.stringify({ link_token: linkToken }) }),
  status: () => apiRequest<{ available: boolean; linked: boolean; email: string | null; has_password: boolean }>('/api/account/google', { method: 'GET' }),
  unlink: () => apiRequest<{ linked: boolean }>('/api/account/google', { method: 'DELETE' }),
};

export interface MfaStatus {
  available: boolean;
  enabled: boolean;
  recovery_codes_left: number;
}

export const mfaApi = {
  status: () => apiRequest<MfaStatus>('/api/account/mfa/status', { method: 'GET' }),
  setup: (password: string) =>
    apiRequest<{ secret: string; otpauth_uri: string }>('/api/account/mfa/setup', { method: 'POST', body: JSON.stringify({ password }) }),
  enable: async (code: string) => {
    const res = await apiRequest<{ enabled: boolean; recovery_codes: string[]; token: string }>('/api/account/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    authStorage.setToken(res.token);
    return res.recovery_codes;
  },
  disable: (password: string, factor: { code?: string; recovery_code?: string }) =>
    apiRequest<{ enabled: boolean }>('/api/account/mfa/disable', { method: 'POST', body: JSON.stringify({ password, ...factor }) }),
  regenerateCodes: async (password: string, code: string) =>
    (await apiRequest<{ recovery_codes: string[] }>('/api/account/mfa/recovery-codes', { method: 'POST', body: JSON.stringify({ password, code }) })).recovery_codes,
  // Prova o segundo fator de novo (ações sensíveis); o token novo guarda a verificação recente
  reauth: async (factor: { code?: string; recovery_code?: string }) => {
    const res = await apiRequest<{ token: string }>('/api/account/mfa/reauth', { method: 'POST', body: JSON.stringify(factor) });
    authStorage.setToken(res.token);
  },
};

export const accountSecurityApi = {
  listSessions: async () => {
    const res = await apiRequest<{ sessions: AccountSession[]; this_device: ThisDevice; token?: string }>('/api/account/sessions', { method: 'GET' });
    // Login antigo: o servidor registra este aparelho e devolve um token com a sessão
    if (res.token) authStorage.setToken(res.token);
    return { sessions: res.sessions, thisDevice: res.this_device };
  },
  revokeSession: (id: string) => apiRequest<{ revoked: boolean }>(`/api/account/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  changePassword: async (current: string, next: string) => {
    const res = await apiRequest<{ changed: boolean; token: string }>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    });
    authStorage.setToken(res.token);
    return res;
  },
  signOutEverywhere: async () => {
    // Encerra todas as sessões, inclusive esta: a pessoa precisa entrar de novo
    const res = await apiRequest<{ signed_out_everywhere: boolean }>('/api/account/sessions', { method: 'DELETE' });
    authStorage.clear();
    return res;
  },
  requestDeletion: (data: { password: string; reasons: string[]; details?: string; would_return?: string }) =>
    apiRequest<{ scheduled: boolean; grace_days: number }>('/api/account/delete', { method: 'POST', body: JSON.stringify(data) }),
  downloadMyData: async () => {
    const token = authStorage.getToken();
    const response = await fetch('/api/account/export', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      let message = 'Não foi possível gerar seus dados.';
      try {
        message = ((await response.json()) as { error?: string }).error || message;
      } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `espectro-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export type ProfileDetailsMap = Record<string, { value: string; visibility: 'public' | 'friends' | 'private' }>;

export const profileDetailsApi = {
  getMine: async (): Promise<ProfileDetailsMap> =>
    (await apiRequest<{ details: ProfileDetailsMap }>('/api/profile_details', { method: 'GET' })).details,
  getFor: async (username: string): Promise<ProfileDetailsMap> =>
    (await apiRequest<{ details: ProfileDetailsMap }>(`/api/profile_details?username=${encodeURIComponent(username)}`, { method: 'GET' })).details,
  save: (details: Record<string, { value: unknown; visibility: 'public' | 'friends' | 'private' }>) =>
    apiRequest<{ saved: boolean }>('/api/profile_details', { method: 'PUT', body: JSON.stringify({ details }) }),
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
    cover_url?: string | null;
  }): Promise<{ user: UserProfile; token?: string; message: string }> => {
    return apiRequest<{ user: UserProfile; token?: string; message: string }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
