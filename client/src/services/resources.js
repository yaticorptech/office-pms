import { api } from './api.js';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.put('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export const projectsApi = {
  list: (params, options) => api.get('/projects', { params, ...options }),
  options: (options) => api.get('/projects/options', options),
  get: (id, options) => api.get(`/projects/${id}`, options),
  tasks: (id, options) => api.get(`/projects/${id}/tasks`, options),
  create: (payload) => api.post('/projects', payload),
  update: (id, payload) => api.put(`/projects/${id}`, payload),
  archive: (id) => api.delete(`/projects/${id}`),
};

export const tasksApi = {
  list: (params, options) => api.get('/tasks', { params, ...options }),
  get: (id, options) => api.get(`/tasks/${id}`, options),
  create: (payload) => api.post('/tasks', payload),
  update: (id, payload) => api.put(`/tasks/${id}`, payload),
  setStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  remove: (id) => api.delete(`/tasks/${id}`),
};

export const employeesApi = {
  list: (params, options) => api.get('/employees', { params, ...options }),
  assignable: (options) => api.get('/employees/assignable', options),
  get: (id, options) => api.get(`/employees/${id}`, options),
  create: (payload) => api.post('/employees', payload),
  update: (id, payload) => api.put(`/employees/${id}`, payload),
  setStatus: (id, status) => api.patch(`/employees/${id}/status`, { status }),
};

export const notificationsApi = {
  list: (params, options) => api.get('/notifications', { params, ...options }),
  unreadCount: (options) => api.get('/notifications/unread-count', options),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const dashboardApi = {
  admin: (options) => api.get('/dashboard/admin', options),
  employee: (options) => api.get('/dashboard/employee', options),
};

export const metaApi = {
  options: (options) => api.get('/meta/options', options),
};
