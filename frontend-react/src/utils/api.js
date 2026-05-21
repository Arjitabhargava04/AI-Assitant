// // src/utils/api.js
// // Central API configuration and authenticated fetch helper
// // for the local we have this
// export const API = 'http://localhost:8000';
// // and for the port forward
// // export const API = 'https://0rb9hf09-8000.inc1.devtunnels.ms';

// API URL — uses environment variable, falls back to localhost for local dev
export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export function getToken() {
  return localStorage.getItem('vk_token');
}

export function getUser() {
  return {
    token:    localStorage.getItem('vk_token'),
    userId:   localStorage.getItem('vk_user_id'),
    email:    localStorage.getItem('vk_email'),
    name:     localStorage.getItem('vk_name'),
    isAdmin:  localStorage.getItem('vk_is_admin') === '1',
  };
}

export function saveUser(data) {
  localStorage.setItem('vk_token',    data.token);
  localStorage.setItem('vk_user_id',  data.user_id);
  localStorage.setItem('vk_email',    data.email);
  localStorage.setItem('vk_name',     data.display_name || '');
  localStorage.setItem('vk_is_admin', data.is_admin ? '1' : '0');
}

export function clearUser() {
  localStorage.removeItem('vk_token');
  localStorage.removeItem('vk_user_id');
  localStorage.removeItem('vk_email');
  localStorage.removeItem('vk_name');
  localStorage.removeItem('vk_is_admin');
}

export async function authFetch(url, opts = {}) {
  const token = getToken();
  return fetch(API + url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });
}

export function renderMarkdown(md) {
  if (!md) return '';
  let h = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  h = h.replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>');
  h = h.replace(/## (.*?)(\n|$)/g,  '<h3>$1</h3>');
  h = h.replace(/\*\*(.*?)\*\*/g,   '<strong>$1</strong>');
  h = h.replace(/\*(.*?)\*/g,       '<em>$1</em>');
  h = h.replace(/`(.*?)`/g,         '<code>$1</code>');
  h = h.replace(/^- (.*?)$/gm,      '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  h = h.replace(/\n\n/g, '</p><p>');
  h = h.replace(/\n/g, '<br>');
  h = '<p>' + h + '</p>';
  h = h.replace(/<p><\/p>/g, '');
  return h;
}

export function formatDate(d) {
  if (!d) return '';
  const dt   = new Date(d);
  const now  = new Date();
  const diff = Math.floor((now - dt) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff}d ago`;
  return dt.toLocaleDateString();
}
