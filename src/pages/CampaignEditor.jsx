import { useSearchParams } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Collapse, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Spin, Statistic, Table, Tabs, Tag, Tooltip, Upload } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { allPages, apiUrl, get, jsonValue, patch, post } from '../api';
import { useLoad } from '../hooks';
import { canLaunch, date, moscowSchedule, number, reasons, variables } from '../domain';
import { Failure, pager, Preview, Status } from '../components/Common';
import Results from './Results';

import TemplateEditor from '../components/TemplateEditor';

const tabKeys = ['letter', 'recipients', 'launch', 'results'];

export default function CampaignEditor({ id, company, permissions, session, navigate, onDirty }) {
  const { message, modal } = App.useApp();
  const state = useLoad(signal => get(`campaigns/${id}`, {}, signal), [id], 4000);
  const resources = useLoad(async signal => {
    const [lists, senders, templates, assets] = await Promise.all(['lists', 'senders', 'templates', 'assets'].map(path => allPages(path, { company_id: company.id }, signal)));
    return { lists, senders, templates, assets };
  }, [company.id]);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useSearchParams();
  const requestedTab = query.get('tab');
  const activeTab = tabKeys.includes(requestedTab) ? requestedTab
    : (state.data?.campaign?.status || draft?.status || 'draft') === 'draft' ? 'letter' : 'results';

  function openTab(tab) {
    if (query.get('tab') === tab) return;
    const next = new URLSearchParams(query);
    next.set('tab', tab);
    setQuery(next, { preventScrollReset: true });
  }
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateChanged, setTemplateChanged] = useState(false);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientFilter, setRecipientFilter] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendMode, setSendMode] = useState('scheduled');
  const [schedule, setSchedule] = useState('');
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchVersion, setLaunchVersion] = useState(null);
  const [confirmedAudience, setConfirmedAudience] = useState(false);
  const campaign = state.data?.campaign;
  const version = state.data?.version;
  const editable = permissions.edit && campaign?.status === 'draft';
  const recipients = useLoad(signal => version ? get(`campaigns/${id}/recipients`, { page: recipientPage, ...(recipientFilter === 'conflict' ? { conflict: 1 } : { status: recipientFilter }) }, signal) : Promise.resolve(null), [id, version?.id, version?.status, recipientPage, recipientFilter], version?.status === 'pending' ? 4000 : 0);
  const tests = useLoad(signal => version ? get(`campaigns/${id}/tests`, {}, signal) : Promise.resolve(null), [id, version?.id], 5000);
  const currentDraft = useRef(draft); currentDraft.current = draft;
  useEffect(() => {
    if (campaign && !draft) { setDraft({ ...campaign, defaults: campaign.defaults || {}, resolutions: campaign.resolutions || {}, list_ids: campaign.list_ids || [], asset_ids: campaign.asset_ids || [] }); }
  }, [campaign, draft]);
  useEffect(() => { onDirty(dirty); const handler = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  useEffect(() => { setSelectedRecipient(null); setPreview(null); }, [version?.id]);
  useEffect(() => { if (!selectedRecipient) { const row = recipients.data?.data.find(r => r.status === 'pending' && !r.conflict); if (row) setSelectedRecipient(row.id); } }, [recipients.data, selectedRecipient]);

  function change(values) { setDraft(d => ({ ...d, ...values })); setDirty(true); }
  async function save() {
    if (!editable) return null;
    setBusy(true);
    try {
      const value = currentDraft.current;
      const fields = ['revision', 'name', 'category', 'sender_id', 'defaults', 'list_ids', 'asset_ids', 'resolutions'];
      if (templateChanged) fields.push('template_id');
      const next = await patch(`campaigns/${id}`, Object.fromEntries(fields.map(key => [key, value[key] ?? (key === 'html' || key === 'subject' ? '' : null)])));
      setDraft({ ...next, defaults: next.defaults || {}, resolutions: next.resolutions || {}, list_ids: next.list_ids || [], asset_ids: next.asset_ids || [] });
      currentDraft.current = next;
      setTemplateChanged(false);
      setDirty(false); state.refresh(); message.success('Черновик сохранён'); return next;
    } catch (e) { message.error(e.message); return null; }
    finally { setBusy(false); }
  }
  const [startingPreparation, setStartingPreparation] = useState(false);
  const preparing = startingPreparation || ['pending', 'building'].includes(version?.status);

  async function prepare() {
    if (preparing || busy) return;
    setStartingPreparation(true);
    let saved = draft;
    if (dirty) { saved = await save(); if (!saved) { setStartingPreparation(false); return; } }
    setBusy(true);
    try { await post(`campaigns/${id}/prepare`, { revision: saved.revision }); openTab('recipients'); state.refresh(); recipients.refresh(); message.success('Подготовка аудитории запущена'); }
    catch (e) { message.error(e.message); } finally { setStartingPreparation(false); setBusy(false); }
  }
  async function action(name) {
    setBusy(true);
    try { await post(`campaigns/${id}/${name}`, {}); state.refresh(); message.success('Состояние обновлено'); if (name === 'draft') { setDraft(null); setDirty(false); openTab('letter'); } }
    catch (e) { message.error(e.message); } finally { setBusy(false); }
  }
  async function upload(file, kind = 'attachment') {
    try {
      const form = new FormData(); form.append('company_id', company.id); form.append('kind', kind); form.append('file', file);
      const asset = await post('assets', form);
      if (kind === 'attachment') setDraft(d => ({ ...d, asset_ids: [...new Set([...(d.asset_ids || []), asset.id])] }));
      else if (asset.url?.startsWith('https://')) setDraft(d => ({ ...d, html: `${d.html || ''}\n<img src="${asset.url}" alt="" style="max-width:100%">` }));
      else throw new Error('Для изображений требуется публичный HTTPS-адрес, настроенный администратором.');
      setDirty(true); resources.refresh(); message.success('Файл загружен');
    } catch (e) { message.error(e.message); }
    return false;
  }
  function applyTemplate(template) {
    change({ template_id: template.id, subject: template.subject, html: template.html });
    setTemplateChanged(true);
  }
  async function test() {
    setBusy(true);
    try { await post(`campaigns/${id}/test`, { version_id: version.id, recipient_id: selectedRecipient, email: testEmail }); tests.refresh(); message.success('Тест поставлен в очередь'); }
    catch (e) { message.error(e.message); } finally { setBusy(false); }
  }
  async function loadPreview() {
    try { setPreview(await post(`campaigns/${id}/preview`, { recipient_id: selectedRecipient })); } catch (e) { message.error(e.message); }
  }
  async function launch() {
    if (launchVersion !== version?.id || !confirmedAudience || !canLaunch({ campaign, version, tests: tests.data?.data, dirty, canSend: permissions.send })) return;
    setBusy(true);
    try { await post(`campaigns/${id}/confirm`, { version_id: version.id, scheduled_at: sendMode === 'scheduled' ? moscowSchedule(schedule) : null }); setLaunchOpen(false); openTab('results'); state.refresh(); message.success(sendMode === 'now' ? 'Рассылка запущена' : 'Отправка запланирована'); }
    catch (e) { message.error(e.message); } finally { setBusy(false); }
  }
  const opened = useRef(false);
  useEffect(() => {
    if (draft && resources.data) opened.current = true;
  }, [draft, resources.data]);

  if (!draft || (!opened.current && !resources.data)) {
    if (state.error || resources.error) return <>
      <Failure error={state.error} retry={state.refresh}/>
      <Failure error={resources.error} retry={resources.refresh}/>
    </>;
    return <div className="loading-screen" role="status">
      <Spin size="large" />
      <p>Загружаем рассылку…</p>
    </div>;
  }
  const sender = resources.data?.senders.find(s => s.id === draft.sender_id);
  const selectedTemplate = resources.data?.templates.find(t => t.id === draft.template_id);
  const mayLaunch = canLaunch({ campaign, version, tests: tests.data?.data, dirty, canSend: permissions.send }) && session.sending_enabled;
  return <>
    <header className="campaign-heading">
      <Button icon={<ArrowLeftOutlined/>} aria-label="К списку рассылок" title="К списку рассылок" onClick={() => navigate('campaigns')} />
      <span className="campaign-number">Рассылка<strong>№ {id}</strong></span>
      <div className="campaign-identity">
        <h1>{campaign?.name || draft.name}</h1>
        <span aria-hidden="true" className="campaign-separator">/</span>
        <span className="campaign-company">{company.name}</span>
      </div>
      <Space wrap size={6} className="campaign-actions">
      {dirty && <Tag color="orange">Не сохранено</Tag>}
      <span className="campaign-heading-status"><Status value={campaign?.status || draft.status}/></span>
      {editable && <Button type="primary" icon={<SaveOutlined/>} loading={busy} disabled={!dirty} onClick={save}>Сохранить</Button>}
      {permissions.send && campaign?.status === 'running' && <Button onClick={() => action('pause')} loading={busy}>Приостановить</Button>}
      {permissions.send && campaign?.status === 'paused' && <Button onClick={() => action('resume')} loading={busy}>Возобновить</Button>}
      {permissions.send && campaign?.status === 'scheduled' && <Button onClick={() => action('draft')}>Вернуть в черновик</Button>}
      {permissions.send && ['running', 'scheduled', 'paused'].includes(campaign?.status) && <Popconfirm title="Отменить рассылку?" description="Уже переданные письма отозвать нельзя." onConfirm={() => action('cancel')}><Button danger>Отменить</Button></Popconfirm>}
      </Space>
    </header>
    <Failure error={state.error} retry={state.refresh}/><Failure error={resources.error} retry={resources.refresh}/>
    {campaign?.pause_reason && <Alert type="warning" showIcon message={`Причина паузы: ${campaign.pause_reason === 'manual' ? 'Остановлена пользователем' : campaign.pause_reason === 'connection_disabled' ? 'SMTP-подключение отключено' : 'Ошибка почтового подключения'}`}/>}
    <Tabs activeKey={activeTab} onChange={openTab} destroyInactiveTabPane items={[
      { key: 'letter', label: 'Письмо', children: <>
      <Card title="Параметры письма"><Form layout="vertical" className="field-grid">
        <Form.Item label="Название рассылки"><Input value={draft.name} onChange={e => change({ name: e.target.value })} disabled={!editable} maxLength={255}/></Form.Item>
        <Form.Item label="Категория"><Select value={draft.category} disabled={!editable} onChange={category => change({ category })} options={[{ value: 'general', label: 'Новости и предложения' }, { value: 'seminar', label: 'Семинары' }]}/></Form.Item>

        <Form.Item label="Отправитель"><Select value={draft.sender_id} placeholder="Выберите отправителя" disabled={!editable} onChange={sender_id => change({ sender_id })} options={resources.data?.senders.filter(s => s.enabled).map(s => ({ value: s.id, label: `${s.name} <${s.email}> · ${s.mode === 'company' ? 'от компании' : 'от менеджера'}` })) || []}/></Form.Item>
        <Form.Item label="Шаблон письма">
        <Space wrap>
          <Select aria-label="Шаблон письма" placeholder="Выберите шаблон" style={{ minWidth: 220 }}
            value={draft.template_id || undefined} disabled={!editable} loading={resources.loading}
            options={(resources.data?.templates || []).map(t => ({ value: t.id, label: t.name }))}
            onChange={id => applyTemplate(resources.data.templates.find(t => t.id === id))} />
          <Button disabled={!draft.html} onClick={() => setPreview({ subject: draft.subject, html: draft.html })}>Предпросмотр шаблона</Button>
          {editable && selectedTemplate && (selectedTemplate.company_id || session.user.super) &&
            <Button onClick={() => setEditingTemplate(selectedTemplate)}>Редактировать шаблон</Button>}
          {editable && <Button onClick={() => setEditingTemplate({ company_id: company.id, name: '', subject: '', html: '', editor_mode: 'visual' })}>Создать шаблон</Button>}
        </Space>
        </Form.Item>
      </Form>
      {sender && <p className="muted">Ответы придут на {sender.reply_to}</p>}
        {draft.subject && <p><strong>Тема письма</strong> {draft.subject}</p>}

      {editingTemplate && <TemplateEditor initial={editingTemplate} company={company} session={session}
        onClose={() => setEditingTemplate(null)}
        onSaved={template => { applyTemplate(template); setEditingTemplate(null); resources.refresh(); }} />}
      <div className="attachment-heading"><strong>Вложения</strong><Upload multiple showUploadList={false} beforeUpload={file => upload(file)} disabled={!editable}><Button icon={<UploadOutlined/>} disabled={!editable}>Добавить файл</Button></Upload></div>
        <Select aria-label="Вложения рассылки" mode="multiple" style={{ width: '100%' }} value={draft.asset_ids || []} disabled={!editable} placeholder="Одинаковые файлы для всех получателей" onChange={asset_ids => change({ asset_ids })} options={resources.data?.assets.map(a => ({ value: a.id, label: `${a.name} · ${number(Math.ceil(a.size / 1024))} КБ` })) || []}/>
        <p className="muted">До {number(session.attachment_limit_bytes / 1024 / 1024)} МБ суммарно. В тестовое письмо войдут те же файлы.</p>
      <Collapse ghost items={[{ key: 'defaults', label: 'Значения персонализации, если данные отсутствуют', children: <Form layout="vertical" className="field-grid">{Object.entries(variables).map(([key, label]) => <Form.Item label={label} key={key}><Input value={draft.defaults?.[key] || ''} disabled={!editable} onChange={e => change({ defaults: { ...draft.defaults, [key]: e.target.value } })}/></Form.Item>)}</Form> }]}/>
      </Card>
      <div className="page-actions"><Button type="primary" onClick={() => openTab('recipients')}>К получателям</Button></div>
      </> },
      { key: 'recipients', label: 'Получатели', children: <>
      <Card title="Списки получателей"><Select aria-label="Списки получателей" mode="multiple" style={{ width: '100%' }} disabled={!editable} value={draft.list_ids || []} onChange={list_ids => change({ list_ids })} placeholder="Выберите один или несколько списков" options={resources.data?.lists.map(l => ({ value: l.id, label: `${l.name} · ${l.type === 'fixed' ? 'фиксированный' : 'по фильтрам'}` })) || []}/><p className="muted">Повторяющиеся адреса объединяются. Исключения и отписки учитываются автоматически.</p><Space wrap>{editable && <Tooltip title="Подготовка идёт на сервере. Браузер можно закрыть и вернуться позже. Если оставить вкладку открытой, список обновится автоматически.">
        <span tabIndex={preparing ? 0 : undefined} style={{ display: 'inline-flex' }}>
          <Button type="primary" loading={preparing} disabled={preparing || !draft.list_ids?.length || busy} onClick={prepare}>
            {preparing ? 'Подготовка…' : 'Сохранить и подготовить аудиторию'}
          </Button>
        </span>
      </Tooltip>}<Button onClick={() => navigate('lists')}>Управлять списками</Button></Space></Card>
      {version?.status === 'failed' && <Alert type="error" message="Не удалось подготовить аудиторию" description="Проверьте журнал сервера и повторите подготовку."/>}
      {dirty && <Alert type="warning" message="Есть изменения: подготовьте новую версию перед тестированием."/>}
      {version && <Card title={<Space>Аудитория <Status value={version.status}/><span className="muted">К отправке: {number(version.recipient_count)} · исключено: {number(version.excluded_count)}</span></Space>} extra={<Select aria-label="Фильтр получателей" value={recipientFilter} style={{ width: 180 }} options={[{ value: '', label: 'Все адресаты' }, { value: 'pending', label: 'К отправке' }, { value: 'skipped', label: 'Исключённые' }, { value: 'conflict', label: 'Конфликты' }]} onChange={value => { setRecipientFilter(value); setRecipientPage(1); }}/>}>
        <Failure error={recipients.error} retry={recipients.refresh}/><Table rowKey="id" loading={recipients.loading} dataSource={recipients.data?.data || []} pagination={pager(recipients.data, setRecipientPage)} scroll={{ x: 760 }} columns={[
          { title: 'Email', dataIndex: 'email' }, { title: 'Контакт', render: (_, r) => `${r.variables?.last_name || ''} ${r.variables?.first_name || ''}` }, { title: 'Организация', render: (_, r) => r.variables?.organization || '—' },
          { title: 'Состояние', render: (_, r) => r.conflict ? <Tag color="orange">Нужен выбор контакта</Tag> : <><Status value={r.status}/>{r.reason && <small>{reasons[r.reason] || r.reason}</small>}</> },
          { title: 'Данные для персонализации', render: (_, r) => r.conflict ? <Select aria-label={`Контакт для ${r.email}`} style={{ minWidth: 210 }} value={draft.resolutions?.[r.email]} disabled={!editable} placeholder="Выберите контакт" onChange={key => change({ resolutions: { ...draft.resolutions, [r.email]: key } })} options={Object.entries(r.sources || {}).map(([key, v]) => ({ value: key, label: [v.last_name, v.first_name, v.organization, key].filter(Boolean).join(' · ') }))}/> : '—' },
        ]}/></Card>}
      <div className="page-actions"><Button onClick={() => openTab('letter')}>К письму</Button><Button type="primary" disabled={!version || version.status !== 'ready' || dirty} onClick={() => openTab('launch')}>К проверке</Button></div>
      </> },
      { key: 'launch', label: 'Проверка и запуск', children: <>
      {!version || dirty || version.status !== 'ready' ? <Alert type="warning" showIcon message="Сначала сохраните письмо и подготовьте актуальную аудиторию." action={<Button onClick={() => openTab('recipients')}>К получателям</Button>}/> : <>
        <Card title="1. Предпросмотр и тест"><Form layout="vertical" className="field-grid"><Form.Item label="Персонализация на примере получателя"><Select aria-label="Пример получателя" value={selectedRecipient} onChange={setSelectedRecipient} options={recipients.data?.data.filter(r => r.status === 'pending' && !r.conflict).map(r => ({ value: r.id, label: r.email })) || []}/><small className="muted">Выбор из текущей страницы аудитории.</small></Form.Item><Form.Item label="Куда отправить тест"><Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Ваш рабочий email"/></Form.Item></Form><Space><Button onClick={loadPreview} disabled={!selectedRecipient}>Предпросмотр</Button>{permissions.edit && <Button type="primary" loading={busy} disabled={!selectedRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)} onClick={test}>Отправить тест</Button>}</Space><p className="muted">Открытия и переходы в тесте не учитываются. Отписка не изменяет подписку контакта.</p></Card>
        <Card title="2. Подтвердите проверку тестового письма"><Failure error={tests.error} retry={tests.refresh}/><Table rowKey="id" dataSource={tests.data?.data || []} pagination={false} columns={[{ title: 'Адрес', dataIndex: 'email' }, { title: 'Состояние', dataIndex: 'status', render: value => <Status value={value}/> }, { title: 'Проверка', render: (_, t) => t.checked_at ? <Tag color="success">Проверено {date(t.checked_at)}</Tag> : <Popconfirm title="Вы получили и проверили тестовое письмо?" description="Проверьте тему, вёрстку, ссылки и вложения." onConfirm={async () => { try { await post(`campaigns/${id}/tests/${t.id}/check`, {}); tests.refresh(); } catch (e) { message.error(e.message); } }}><Button disabled={!permissions.send || t.status !== 'submitted'}>Письмо проверено</Button></Popconfirm> }]}/></Card>
        <Card title="3. Время отправки"><Space wrap><Select aria-label="Время запуска" style={{ width: 240 }} value={sendMode} onChange={setSendMode} options={[{ value: 'now', label: 'Сразу после подтверждения' }, { value: 'scheduled', label: 'В указанное время' }]}/>{sendMode === 'scheduled' && <Input aria-label="Дата и время по Москве" type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} style={{ width: 230 }}/>}<span className="muted">Московское время (UTC+3)</span></Space><p className="muted">В указанное время отправка начнётся. Завершение зависит от объёма и лимита SMTP.</p><Button type="primary" icon={<SendOutlined/>} disabled={!mayLaunch} onClick={() => { setConfirmedAudience(false); setLaunchVersion(version.id); setLaunchOpen(true); }}>Проверить и подтвердить запуск</Button></Card>
      </>}
      </> },
      { key: 'results', label: 'Результаты', children: (permissions.statistics ? <Results id={id} version={version}/> : <Alert type="info" message="Для просмотра результатов необходимо право статистики."/>)}
    ]} />
    <Modal open={preview !== null} title={preview?.subject || 'Предпросмотр письма'} width={850} footer={null} onCancel={() => setPreview(null)} destroyOnClose><Preview html={preview?.html}/></Modal>
    <Modal open={launchOpen} title="Подтверждение массовой отправки" okText={sendMode === 'now' ? 'Запустить рассылку' : 'Запланировать'} okButtonProps={{ disabled: !confirmedAudience || !mayLaunch || launchVersion !== version?.id }} confirmLoading={busy} onOk={launch} onCancel={() => setLaunchOpen(false)}>
      <Descriptions column={1} bordered size="small" items={[{ key: 'company', label: 'Компания', children: company.name }, { key: 'sender', label: 'Отправитель', children: sender ? `${sender.name} <${sender.email}>` : '—' }, { key: 'subject', label: 'Тема', children: campaign?.subject }, { key: 'audience', label: 'Получателей', children: number(version?.recipient_count) }, { key: 'assets', label: 'Вложения', children: (resources.data?.assets || []).filter(a => (campaign?.asset_ids || []).includes(a.id)).map(a => a.name).join(', ') || 'Нет' }, { key: 'time', label: 'Начало', children: sendMode === 'now' ? 'Сразу' : `${schedule.replace('T', ' ')} МСК` }]}/><p><Checkbox checked={confirmedAudience} onChange={e => setConfirmedAudience(e.target.checked)}>Проверены письмо, компания, вложения и итоговая аудитория.</Checkbox></p><Alert type="info" message="Уже переданные письма нельзя отозвать. Новые отписки будут проверены перед отправкой."/>
    </Modal>
  </>;
}
