import { afterEach, describe, expect, it, vi } from 'vitest';
import { allPages, post, request } from '../src/api';

afterEach(() => vi.unstubAllGlobals());
describe('API ERP', () => {
  it('отправляет cookie и JSON, не подставляет пользовательский токен', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{"id":4}' });
    vi.stubGlobal('fetch', fetch);
    expect(await post('campaigns', { company_id: 1 })).toEqual({ id: 4 });
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
    expect(fetch.mock.calls[0][1].body).toBe('{"company_id":1}');
  });
  it('не задаёт JSON content-type для загрузки файла', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{"id":5}' });
    vi.stubGlobal('fetch', fetch); const form = new FormData(); form.append('company_id', '1'); await post('assets', form);
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });
  it('показывает сообщения валидации сервера', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => JSON.stringify({ errors: { campaign: ['Версия устарела.'] } }) }));
    await expect(post('campaigns/1/confirm', {})).rejects.toThrow('Версия устарела.');
  });
  it('не принимает HTML-страницу входа за успешный ответ API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '<html>Login</html>' }));
    await expect(request('session')).rejects.toThrow('неожиданный ответ');
  });
  it('дочитывает справочники за пределами первой страницы', async () => {
    const fetch = vi.fn().mockImplementation(async url => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: url.includes('page=2') ? 2 : 1 }], last_page: 2 }) }));
    vi.stubGlobal('fetch', fetch);
    expect(await allPages('lists', { company_id: 1 })).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
