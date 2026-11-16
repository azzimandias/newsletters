import { useTableFilters } from '../components/useTableFilters';
import { useState } from 'react';
import { App, Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { allPages, get, jsonValue, post, put, remove } from '../api';
import { useLoad } from '../hooks';
import { date } from '../domain';
import { Failure, PageHead, pager } from '../components/Common';

const encryptionOptions = [{ value: 'tls', label: 'STARTTLS' }, { value: 'ssl', label: 'TLS (SMTPS)' }, { value: 'none', label: 'Без шифрования' }];

export default function Settings({ company, session }) {
  const [tab, setTab] = useState('senders');
  return <><PageHead title="Настройки"/>
    {!session.public_url_configured && <Alert type="warning" showIcon message="Публичный HTTPS-адрес ещё не настроен" description="Он нужен для изображений, отписок и отслеживания. Администратору необходимо задать MAILINGS_PUBLIC_URL."/>}

    <SettingsPanel key={company.id + ':' + tab} company={company} tab={tab} setTab={setTab} />
  </>;
}

function SettingsPanel({ company, tab, setTab }) {
  const { message } = App.useApp();
  const { setPage, page, filters, heading } = useTableFilters();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [unblock, setUnblock] = useState(null);
  const [reason, setReason] = useState('');
  const [form] = Form.useForm();
  const mode = Form.useWatch('mode', form);
  const list = useLoad(signal => ['senders', 'connections'].includes(tab) ? get(tab, { company_id: company.id, page, ...filters }, signal) : get('suppressions', { company_id: company.id, type: tab, page, ...filters }, signal), [company.id, tab, page, filters]);
  const connections = useLoad(signal => allPages('connections', { company_id: company.id }, signal), [company.id, editing]);
  function edit(row = {}) {
    setEditing(row); form.resetFields(); form.setFieldsValue({ port: 587, encryption: 'tls', per_minute: 30, enabled: false, mode: 'company', ...row, variables: jsonValue(row.variables), password: undefined });
  }
  async function save() {
    try {
      const values = await form.validateFields(); setBusy(true);
      if (!values.password) delete values.password;
      if (values.mode === 'company') values.manager_id = null;
      if (editing.id) await put(`${tab}/${editing.id}`, values); else await post(tab, { ...values, company_id: company.id });
      setEditing(null); list.refresh(); message.success('Настройки сохранены');
    } catch (e) { if (!e.errorFields) message.error(e.message); } finally { setBusy(false); }
  }
  const stateOptions = [
    { value: '1', label: tab === 'connections' ? 'Включено' : 'Включён' },
    { value: '0', label: tab === 'connections' ? 'Выключено' : 'Выключен' },
  ];
  const columns = tab === 'connections' ? [
    { title: heading('Подключение', 'name'), dataIndex: 'name' },
    { title: heading('SMTP', 'smtp'), render: (_, r) => `${r.host}:${r.port}` },
    { title: heading('Шифрование', 'encryption', encryptionOptions), dataIndex: 'encryption', render: value => encryptionOptions.find(option => option.value === value)?.label ?? (value || 'Не указано') },
    { title: heading('Писем / мин.', 'per_minute'), dataIndex: 'per_minute' },
    { title: heading('Состояние', 'enabled', stateOptions), dataIndex: 'enabled', render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Включено' : 'Выключено'}</Tag> },
    { title: 'Действия', render: (_, row) => <Button onClick={() => edit(row)}>Настроить</Button> },
  ] : tab === 'senders' ? [
    { title: heading('Имя отправителя', 'name'), dataIndex: 'name' },
    { title: heading('Email', 'email'), dataIndex: 'email' },
    { title: heading('Режим', 'mode', [{ value: 'company', label: 'От компании' }, { value: 'manager', label: 'От менеджера' }]), dataIndex: 'mode', render: value => value === 'company' ? 'От компании' : 'От менеджера' },
    { title: heading('Ответы на', 'reply_to'), dataIndex: 'reply_to' },
    { title: heading('Состояние', 'enabled', stateOptions), dataIndex: 'enabled', render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Включён' : 'Выключен'}</Tag> },
    { title: 'Действия', render: (_, row) => <Button onClick={() => edit(row)}>Настроить</Button> },
  ] : [{ title: heading('Email', 'email'), dataIndex: 'email' },
    { title: heading('Дата · МСК', 'day', null, 'date'), dataIndex: 'created_at', render: date }, ...(tab === 'blocks' ? [{ title: heading('Причина', 'reason'), dataIndex: 'reason', render: value => value === 'mailbox_not_found' ? 'Ящик не существует' : value },
    { title: heading('Подтверждение', 'evidence'), dataIndex: 'evidence' },
    { title: 'Действия', render: (_, row) => <Button onClick={() => { setUnblock(row); setReason(''); }}>Снять блокировку</Button> }] : [{ title: heading('Рассылка', 'campaign_id'), dataIndex: 'campaign_id' }])];
  return <>
    <Tabs activeKey={tab} onChange={setTab} tabBarExtraContent={['senders', 'connections'].includes(tab) && <Button type="primary" icon={<PlusOutlined/>} onClick={() => edit()}>Добавить</Button>} items={[{ key: 'senders', label: 'Отправители' }, { key: 'connections', label: 'SMTP-подключения' }, { key: 'unsubscribes', label: 'Отписки компании' }, { key: 'blocks', label: 'Блокировки адресов' }]}/>
    <Failure error={list.error} retry={list.refresh}/><Card className="table-card"><Table className="campaigns-table" rowKey="id" dataSource={list.data?.data || []} loading={list.loading} columns={columns} pagination={pager(list.data, setPage)} scroll={{ x: 800 }}/></Card>
    <Modal open={editing !== null} title={tab === 'connections' ? 'SMTP-подключение' : 'Отправитель'} width={720} onCancel={() => setEditing(null)} onOk={save} okText="Сохранить" confirmLoading={busy} destroyOnClose>
      <Form layout="vertical" form={form}><Form.Item label={tab === 'connections' ? 'Название подключения' : 'Отображаемое имя отправителя'} name="name" rules={[{ required: true, message: 'Укажите название' }]}><Input maxLength={255}/></Form.Item>
        {tab === 'connections' ? <><div className="field-grid"><Form.Item label="SMTP-сервер" name="host" rules={[{ required: true, message: 'Укажите сервер' }]}><Input placeholder="smtp.example.org"/></Form.Item><Form.Item label="Порт" name="port" rules={[{ required: true }]}><InputNumber min={1} max={65535}/></Form.Item><Form.Item label="Шифрование" name="encryption"><Select options={encryptionOptions}/></Form.Item><Form.Item label="Лимит писем в минуту" name="per_minute" rules={[{ required: true }]}><InputNumber min={1} max={60}/></Form.Item><Form.Item label="Логин" name="username"><Input autoComplete="off"/></Form.Item><Form.Item label="Пароль" name="password" extra={editing?.id ? 'Оставьте пустым, чтобы сохранить текущий пароль.' : ''}><Input.Password autoComplete="new-password"/></Form.Item></div><Alert type="info" message="Пароль хранится зашифрованно. Лимит подключения общий для рассылок и тестов."/></> : <>
          <Form.Item label="Почтовое подключение" name="connection_id" rules={[{ required: true, message: 'Выберите подключение' }]}><Select options={connections.data?.map(c => ({ value: c.id, label: `${c.name}${c.enabled ? '' : ' (выключено)'}` })) || []}/></Form.Item><Failure error={connections.error} retry={connections.refresh}/>
          <div className="field-grid"><Form.Item label="От чьего имени" name="mode"><Select options={[{ value: 'company', label: 'От компании' }, { value: 'manager', label: 'От менеджера' }]}/></Form.Item>{mode === 'manager' && <Form.Item label="Сотрудник ERP" name="manager_id" rules={[{ required: true, message: 'Выберите сотрудника' }]}><ManagerSelect companyId={company.id}/></Form.Item>}<Form.Item label="Адрес отправителя (From)" name="email" rules={[{ required: true, type: 'email', message: 'Введите email' }]}><Input/></Form.Item><Form.Item label="Адрес для ответов (Reply-To)" name="reply_to" rules={[{ required: true, type: 'email', message: 'Введите email' }]}><Input/></Form.Item>
          {[['company_name', 'Название компании'], ['company_email', 'Общий email компании'], ['company_phone', 'Телефон компании']].map(([key, label]) => <Form.Item key={key} name={['variables', key]} label={label}><Input/></Form.Item>)}</div><Form.Item name={['variables', 'company_signature']} label="Подпись компании"><Input.TextArea rows={3}/></Form.Item>
        </>}
        <Form.Item name="enabled" label="Доступно для отправки" valuePropName="checked"><Switch/></Form.Item>
      </Form>
    </Modal>
    <Modal open={Boolean(unblock)} title={`Снять запрет для ${unblock?.email || ''}?`} okText="Снять блокировку" okButtonProps={{ disabled: !reason.trim() }} onCancel={() => setUnblock(null)} onOk={async () => { try { await remove(`blocks/${unblock.id}`, { company_id: company.id, reason }); setUnblock(null); list.refresh(); } catch (e) { message.error(e.message); } }}><Alert type="warning" message="Изменение действует для всей ERP. Снимайте запрет только после проверки адреса."/><Input.TextArea aria-label="Причина снятия блокировки" value={reason} onChange={e => setReason(e.target.value)} placeholder="Результат проверки и причина снятия" rows={3}/></Modal>
  </>;
}

function ManagerSelect({ companyId, value, onChange }) {
  const [query, setQuery] = useState('');
  const list = useLoad(signal => get('options', { company_id: companyId, field: 'manager_ids', search: query, selected: value ? String(value) : '' }, signal), [companyId, query, value]);
  return <><Select showSearch filterOption={false} value={value} onChange={onChange} onSearch={setQuery} loading={list.loading} options={list.data?.data || []} placeholder="Найти сотрудника"/><Failure error={list.error}/></>;
}
