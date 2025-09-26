import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
const API_URL = `${API_BASE.replace(/\/$/, '')}/api/auth`;

export async function register(
  username: string,
  password: string,
  role_id: number,
  profile?: { full_name?: string; email?: string; mobile?: string }
) {
  const payload: any = { username, password, role_id };
  if (profile) {
    if (profile.full_name) payload.full_name = profile.full_name;
    if (profile.email) payload.email = profile.email;
    if (profile.mobile) payload.mobile = profile.mobile;
  }
  return axios.post(`${API_URL}/register`, payload);
}

export async function login(username: string, password: string) {
  return axios.post(`${API_URL}/login`, { username, password });
}

export async function getMe(token: string) {
  return axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
