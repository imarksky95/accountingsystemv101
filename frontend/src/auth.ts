import axios from 'axios';

const API_URL = 'accountingsystemv101-ehejf4b9bbhredbd.canadacentral-01.azurewebsites.net/api/auth';

export async function register(username: string, password: string, role_id: number) {
  return axios.post(`${API_URL}/register`, { username, password, role_id });
}

export async function login(username: string, password: string) {
  return axios.post(`${API_URL}/login`, { username, password });
}

export async function getMe(token: string) {
  return axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
