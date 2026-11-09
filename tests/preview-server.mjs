// Explicit, local-only UI fixture server. Never proxies requests to ERP or SMTP.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const company = { id: 1, name: 'Арстел · демонстрация', permissions: { view: true, edit: true, send: true, statistics: true, settings: true } };
const html = '<table width="100%" style="background:#eef1f4;padding:24px"><tr><td><table width="600" align="center" style="background:#fff;padding:32px;font-family:Arial"><tr><td><p style="color:#1f4f82;font-weight:bold">АРСТЕЛ</p><h1>Новые решения для ваших проектов</h1><p>Здравствуйте, {{first_name}}!</p><p>Подготовили обзор оборудования и ближайших семинаров для наших партнёров.</p><p><a href="https://example.com">Посмотреть обзор</a></p><p>С уважением,<br>{{company_name}}</p></td></tr></table></td></tr></table>';
const campaigns = [
  { id: 1, name: 'Новинки оборудования · ноябрь', subject: 'Новые решения для ваших проектов', status: 'draft', category: 'general' },
  { id: 2, name: 'Приглашение на семинар', subject: 'Практический семинар для интеграторов', status: 'scheduled', category: 'seminar', scheduled_at: '2026-11-10T09:00:00Z' },
  { id: 3, name: 'Обзор решений · октябрь', subject: 'Главное за октябрь', status: 'completed', category: 'general', started_at: '2026-10-28T08:00:00Z' },
].map(c => ({ company_id: 1, sender_id: 1, html, editor_mode: 'visual', editor_data: null, list_ids: [1], asset_ids: [], defaults: { first_name: 'коллеги' }, resolutions: {}, revision: 1, created_at: '2026-11-03T08:30:00Z', ...c }));
let lists = [{ id: 1, company_id: 1, name: 'Все партнёры', type: 'dynamic', filters: { sources: ['contact', 'organization', 'legacy'] } }, { id: 2, company_id: 1, name: 'Участники семинаров', type: 'fixed', filters: {} }];
let templates = [{ id: 1, company_id: 1, name: 'Новости компании', subject: 'Новости Арстел', html, editor_mode: 'visual', editor_data: null }];
const senders = [{ id: 1, company_id: 1, connection_id: 1, mode: 'company', name: 'Арстел', email: 'news@example.test', reply_to: 'info@example.test', enabled: true, variables: {} }];
const connections = [{ id: 1, company_id: 1, name: 'Тестовое подключение', host: 'smtp.example.test', port: 587, encryption: 'tls', per_minute: 30, enabled: false }];
const rows = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, version_id: 1, email: `partner${index + 1}@example.test`, variables: { first_name: index % 2 ? 'Анна' : 'Александр', organization: `Демо-партнёр ${index + 1}` }, sources: {}, conflict: false, status: 'pending', delivery_status: 'unknown', attempt_count: 0 }));
const versions = {};
const tests = {};
const entries = {};
const page = data => ({ data, total: data.length, current_page: 1, last_page: 1, per_page: 25 });
const respond = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/mailings/')) {
      const target = path.resolve(root, `.${url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)}`);
      if (!target.startsWith(root)) return respond(res, 403, {});
      const data = await readFile(target);
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(target)] || 'application/octet-stream' }); res.end(data); return;
    }
    const route = url.pathname.replace('/api/mailings/', '');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw && req.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : {};
    if (route === 'session') return respond(res, 200, { user: { id: 1, name: 'Демо-пользователь', super: true }, companies: [company], sending_enabled: false, public_url_configured: false, attachment_limit_bytes: 15728640, preview: true });
    if (route === 'options') return respond(res, 200, { data: [{ value: 1, label: 'Демонстрационная запись' }] });
    if (route === 'assets') return respond(res, req.method === 'GET' ? 200 : 422, req.method === 'GET' ? page([]) : { message: 'В демонстрации загрузка файлов отключена.' });
    if (route === 'contacts') return respond(res, 200, page(rows.map(r => ({ id: r.id, email: r.email, ...r.variables }))));
    if (route === 'suppressions') return respond(res, 200, page([]));
    if (route === 'campaigns') {
      if (req.method === 'POST') { const c = { ...campaigns[0], ...body, id: campaigns.length + 1, html: '', subject: '', revision: 1, status: 'draft', list_ids: [] }; campaigns.push(c); return respond(res, 201, c); }
      return respond(res, 200, page(campaigns.filter(c => !url.searchParams.get('status') || c.status === url.searchParams.get('status'))));
    }
    const resource = /^(lists|templates|senders|connections)(?:\/(\d+))?$/.exec(route);
    if (resource) {
      const collection = { lists, templates, senders, connections }[resource[1]];
      if (req.method === 'POST') { const row = { ...body, id: collection.length + 1 }; collection.push(row); return respond(res, 201, row); }
      if (resource[2] && req.method === 'PUT') { Object.assign(collection.find(r => r.id === +resource[2]), body); return respond(res, 200, { id: +resource[2] }); }
      if (resource[2] && req.method === 'DELETE') { collection.splice(collection.findIndex(r => r.id === +resource[2]), 1); return respond(res, 200, {}); }
      return respond(res, 200, page(collection));
    }
    const listEntries = /^lists\/(\d+)\/entries(?:\/(\d+))?$/.exec(route);
    if (listEntries) {
      const list = entries[listEntries[1]] ||= [];
      if (req.method === 'POST') list.push(...body.entries.map((row, i) => ({ id: list.length + i + 1, ...row })));
      if (req.method === 'DELETE') list.splice(list.findIndex(r => r.id === +listEntries[2]), 1);
      return respond(res, 200, req.method === 'GET' ? page(list) : {});
    }
    const match = /^campaigns\/(\d+)(?:\/(.*))?$/.exec(route);
    if (match) {
      const id = Number(match[1]), action = match[2]; const campaign = campaigns.find(c => c.id === id);
      if (!campaign) return respond(res, 404, { message: 'Не найдена' });
      if (!action) {
        if (req.method === 'PATCH') { if (body.revision !== campaign.revision) return respond(res, 422, { message: 'Устаревшая версия' });
          if (body.template_id) {
            const template = templates.find(t => t.id === body.template_id && (t.company_id == null || t.company_id === campaign.company_id));
            if (!template) return respond(res, 422, { message: 'Шаблон недоступен' });
            for (const key of ['subject', 'html', 'editor_mode', 'editor_data']) body[key] = template[key];
          }
          Object.assign(campaign, body, { revision: campaign.revision + 1 }); delete versions[id]; return respond(res, 200, campaign); }
        return respond(res, 200, { campaign, version: versions[id] || (id > 1 ? { id, status: 'ready', recipient_count: 1200, excluded_count: 24, conflict_count: 0 } : null) });
      }
      if (action === 'prepare') { versions[id] = { id: Date.now(), revision: campaign.revision, status: 'ready', recipient_count: 12, excluded_count: 0, conflict_count: 0 }; return respond(res, 202, versions[id]); }
      if (action === 'recipients') return respond(res, 200, page(rows.filter(r => url.searchParams.get('conflict') !== '1').map(r => ({ ...r, version_id: versions[id]?.id || id, status: id === 3 ? 'submitted' : r.status }))));
      if (action === 'preview') return respond(res, 200, { html: campaign.html.replaceAll('{{first_name}}', 'Александр').replaceAll('{{company_name}}', 'Арстел'), subject: campaign.subject });
      if (action === 'test') { (tests[id] ||= []).push({ id: Date.now(), version_id: body.version_id, email: body.email, status: 'submitted', checked_at: null }); return respond(res, 202, {}); }
      if (action === 'tests') return respond(res, 200, page(tests[id] || []));
      if (/^tests\/.+\/check$/.test(action)) { const row = tests[id]?.find(t => t.id === +action.split('/')[1]); if (row) row.checked_at = new Date().toISOString(); return respond(res, 200, {}); }
      if (action === 'confirm') return respond(res, 422, { message: 'В демонстрации массовая отправка отключена.' });
      if (action === 'statistics') return respond(res, 200, { sending: { submitted: 1180, failed: 8, unknown: 12 }, delivery: { delivered: 1100, bounced: 8 }, unsubscribes: 3, tracking: [{ type: 'open', total: 680, unique_recipients: 410 }, { type: 'click', total: 122, unique_recipients: 97 }], links: [] });
      if (action === 'journal') return respond(res, 200, page([{ id: 1, created_at: '2026-11-03T09:00:00Z', action: 'campaign.created', actor_id: 1, details: {} }]));
      if (action.includes('attempts')) return respond(res, 200, page([]));
      if (action === 'copy') { const copy = { ...campaign, id: campaigns.length + 1, name: campaign.name + ' — копия', status: 'draft', revision: 1 }; campaigns.push(copy); return respond(res, 201, copy); }
      if (['pause', 'resume', 'cancel', 'draft'].includes(action)) { campaign.status = { pause: 'paused', resume: 'running', cancel: 'cancelled', draft: 'draft' }[action]; return respond(res, 200, campaign); }
    }
    respond(res, 404, { message: 'Этот маршрут не входит в демонстрацию.' });
  } catch { respond(res, 500, { message: 'Ошибка локальной демонстрации.' }); }
});
server.listen(4175, '127.0.0.1', () => console.log('DEMO ONLY: http://127.0.0.1:4175 — no ERP access, no email sending'));
