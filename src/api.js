const base = (import.meta.env.VITE_API_BASE_URL || '/api/mailings').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, errors = {}) { super(message); this.status = status; this.errors = errors; }
}

export function apiUrl(path) { return `${base}/${path.replace(/^\//, '')}`; }

export async function request(path, { method = 'GET', data, signal } = {}) {
  const form = data instanceof FormData;
  const response = await fetch(apiUrl(path), {
    method, credentials: 'include', signal,
    headers: { Accept: 'application/json', ...(!form && data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: data === undefined ? undefined : form ? data : JSON.stringify(data),
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const message = response.status === 401 ? 'Сессия ERP завершилась. Войдите в ERP и обновите страницу.'
      : response.status === 403 ? 'У вас нет прав на это действие для выбранной компании.'
      : response.status === 409 ? 'Данные изменились. Обновите рассылку перед продолжением.'
      : response.status === 429 ? 'Слишком много запросов. Повторите действие немного позже.'
      : Object.values(body?.errors || {}).flat().join(' ') || body?.message || `Ошибка сервера (${response.status}).`;
    throw new ApiError(message, response.status, body?.errors);
  }
  if (text && !body) throw new ApiError('Сервер вернул неожиданный ответ. Проверьте адрес API и авторизацию.', response.status);
  return body;
}

export const get = (path, params = {}, signal) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return request(`${path}${query.size ? `?${query}` : ''}`, { signal });
};
export const post = (path, data) => request(path, { method: 'POST', data });
export const put = (path, data) => request(path, { method: 'PUT', data });
export const patch = (path, data) => request(path, { method: 'PATCH', data });
export const remove = (path, data) => request(path, { method: 'DELETE', data });

export async function allPages(path, params = {}, signal) {
  const rows = [];
  let page = 1;
  while (true) {
    const result = await get(path, { ...params, page, per_page: 100 }, signal);
    rows.push(...result.data);
    if (page >= result.last_page) return rows;
    page++;
  }
}

export const jsonValue = (value, fallback = {}) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
};
