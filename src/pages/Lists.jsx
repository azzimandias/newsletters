import { useState } from 'react';
import { App, Alert, Button, Card, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { get, jsonValue, post, put, remove } from '../api';
import { useLoad } from '../hooks';
import { filters, parseAddresses, sources } from '../domain';
import { Blank, Failure, PageHead, pager } from '../components/Common';

export default function Lists({ company, permissions }) {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const type = Form.useWatch('type', form);
  const list = useLoad(signal => get('lists', { company_id: company.id, page }, signal), [company.id, page]);
  function edit(row = {}) {
    setEditing(row); form.resetFields(); const rules = jsonValue(row.filters, {});
    form.setFieldsValue({ name: row.name || '', type: row.type || 'fixed', sources: rules.sources || sources.map(s => s.value), ...Object.fromEntries(Object.keys(filters).map(key => [key, (rules[key] || []).map(String)])) });
  }
  async function save() {
    try {
      const values = await form.validateFields(); setBusy(true);
      const conditions = { sources: values.sources };
      const previous = jsonValue(editing.filters, {});
      if (previous.legacy_manager_ids?.length) conditions.legacy_manager_ids = previous.legacy_manager_ids;
      for (const key of Object.keys(filters)) {
        if (values[key]?.length) {
          if (values[key].some(id => !/^\d+$/.test(String(id)) || Number(id) < 1)) throw new Error(`Проверьте поле «${filters[key]}».`);
          conditions[key] = values[key].map(Number);
        }
      }
      const data = { company_id: company.id, name: values.name, type: values.type, filters: values.type === 'dynamic' ? conditions : {} };
      if (editing.id) await put(`lists/${editing.id}`, data); else await post('lists', data);
      setEditing(null); list.refresh(); message.success('Список сохранён');
    } catch (e) { if (!e.errorFields) message.error(e.message); } finally { setBusy(false); }
  }
  return <>
    <PageHead title="Получатели">{permissions.edit && <Button type="primary" icon={<PlusOutlined/>} onClick={() => edit()}>Создать список</Button>}</PageHead>
    <Failure error={list.error} retry={list.refresh}/><Card className="table-card"><Table rowKey="id" dataSource={list.data?.data || []} loading={list.loading} pagination={pager(list.data, setPage)} locale={{ emptyText: <Blank title="Списки ещё не созданы" description="Выберите фиксированный состав или подбор по фильтрам ERP."/> }} columns={[
      { title: 'Название', dataIndex: 'name', render: (name, row) => <button className="text-button" onClick={() => setSelected(row)}>{name}</button> },
      { title: 'Тип', dataIndex: 'type', render: value => <Tag>{value === 'dynamic' ? 'По фильтрам' : 'Фиксированный'}</Tag> },
      { title: 'Правила', render: (_, row) => row.type === 'fixed' ? 'Состав задаётся вручную' : Object.entries(jsonValue(row.filters)).filter(([key]) => key !== 'sources').map(([key, ids]) => `${filters[key] || key}: ${ids.join(', ')}`).join(' · ') || 'Все контакты выбранных источников' },
      { title: '', render: (_, row) => <Space><Button onClick={() => setSelected(row)}>Участники и исключения</Button>{permissions.edit && <><Button aria-label={`Редактировать ${row.name}`} icon={<EditOutlined/>} onClick={() => edit(row)}/><Popconfirm title="Удалить список?" description="Снимки запущенных рассылок сохранятся." onConfirm={async () => { try { await remove(`lists/${row.id}`); list.refresh(); } catch (e) { message.error(e.message); } }}><Button aria-label={`Удалить ${row.name}`} danger icon={<DeleteOutlined/>}/></Popconfirm></>}</Space> },
    ]}/></Card>
    <Modal open={editing !== null} title={editing?.id ? 'Редактировать список' : 'Новый список'} width={750} okText="Сохранить" confirmLoading={busy} onOk={save} onCancel={() => setEditing(null)} destroyOnClose>
      <Form form={form} layout="vertical"><Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}><Input maxLength={255}/></Form.Item><Form.Item name="type" label="Тип списка"><Select options={[{ value: 'fixed', label: 'Фиксированный — конкретные адреса' }, { value: 'dynamic', label: 'По фильтрам — актуальный состав при подготовке' }]}/></Form.Item>
      {type === 'dynamic' && <><Form.Item name="sources" label="Источники" rules={[{ required: true, type: 'array', min: 1, message: 'Выберите источник' }]}><Select mode="multiple" options={sources}/></Form.Item><Alert type="info" message="Фильтры основного и старого справочников задаются отдельно. Пустое поле не ограничивает подбор."/><div className="field-grid">{Object.entries(filters).filter(([key]) => key !== 'legacy_manager_ids').map(([key, label]) => <Form.Item key={key} name={key} label={label}><FilterSelect field={key} companyId={company.id}/></Form.Item>)}</div></>}
      </Form>
    </Modal>
    <Drawer open={Boolean(selected)} title={selected?.name} width={1000} onClose={() => setSelected(null)} destroyOnClose>{selected && <Members key={selected.id} list={selected} company={company} editable={permissions.edit}/>}</Drawer>
  </>;
}

function FilterSelect({ companyId, field, value, onChange }) {
  const [search, setSearch] = useState('');
  const options = useLoad(signal => get('options', { company_id: companyId, field, search, selected: (value || []).join(',') }, signal), [companyId, field, search, (value || []).join(',')]);
  return <><Select mode="multiple" showSearch filterOption={false} loading={options.loading} value={(value || []).map(Number)} onChange={onChange} onSearch={setSearch} options={options.data?.data || []} placeholder="Все · начните вводить название"/><Failure error={options.error}/></>;
}

function Members({ list, company, editable }) {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('contact');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [manual, setManual] = useState('');
  const [action, setAction] = useState('include');
  const [busy, setBusy] = useState(false);
  const entries = useLoad(signal => get(`lists/${list.id}/entries`, { page }, signal), [list.id, page]);
  const contacts = useLoad(signal => get('contacts', { company_id: company.id, source, search: query, page: contactPage }, signal), [company.id, source, query, contactPage]);
  async function add(values) {
    setBusy(true);
    try {
      for (let index = 0; index < values.length; index += 500) await post(`lists/${list.id}/entries`, { entries: values.slice(index, index + 500) });
      setManual(''); setSelected([]); entries.refresh(); message.success('Список обновлён');
    } catch (e) { message.error(e.message); entries.refresh(); } finally { setBusy(false); }
  }
  return <>
    {list.type === 'dynamic' && <Alert type="info" message="Основной состав определяется фильтрами. Здесь управляются ручные добавления и исключения. Итоговая аудитория показывается в рассылке."/>}
    {editable && <Card title="Добавить адреса"><Space wrap><Select aria-label="Добавить или исключить" value={action} onChange={setAction} style={{ width: 230 }} options={[{ value: 'include', label: 'Включить в список' }, { value: 'exclude', label: 'Исключить из рассылки' }]}/></Space><Input.TextArea aria-label="Адреса вручную" rows={3} value={manual} onChange={e => setManual(e.target.value)} placeholder="Email через запятую, пробел или с новой строки"/><Button loading={busy} disabled={!manual.trim()} onClick={() => { try { add(parseAddresses(manual).map(email => ({ action, email }))); } catch (e) { message.error(e.message); } }}>Применить к адресам</Button></Card>}
    {editable && <Card title="Подобрать из ERP"><Space wrap className="toolbar"><Select aria-label="Источник контактов" options={sources} value={source} style={{ width: 240 }} onChange={value => { setSource(value); setContactPage(1); setSelected([]); }}/><Input.Search placeholder="Email или организация" value={search} onChange={e => setSearch(e.target.value)} onSearch={value => { setQuery(value); setContactPage(1); setSelected([]); }} style={{ width: 300 }}/><Button loading={busy} disabled={!selected.length} onClick={() => add(selected.map(source_id => ({ action, source, source_id })))}>{action === 'include' ? 'Добавить' : 'Исключить'} выбранных ({selected.length})</Button></Space><Failure error={contacts.error} retry={contacts.refresh}/><Table size="small" rowKey="id" dataSource={contacts.data?.data || []} loading={contacts.loading} rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} pagination={pager(contacts.data, value => { setContactPage(value); setSelected([]); })} columns={[{ title: 'Email', dataIndex: 'email' }, { title: 'Контакт', render: (_, row) => [row.last_name, row.first_name].filter(Boolean).join(' ') }, { title: 'Организация', dataIndex: 'organization' }]}/></Card>}
    <Card title="Ручные записи списка"><Failure error={entries.error} retry={entries.refresh}/><Table size="small" rowKey="id" dataSource={entries.data?.data || []} pagination={pager(entries.data, setPage)} columns={[{ title: 'Действие', dataIndex: 'action', render: value => <Tag color={value === 'exclude' ? 'red' : 'blue'}>{value === 'exclude' ? 'Исключить' : 'Включить'}</Tag> }, { title: 'Адрес / контакт', render: (_, row) => row.email || `${sources.find(s => s.value === row.source)?.label} · № ${row.source_id}` }, { title: '', render: (_, row) => editable && <Popconfirm title="Удалить ручную запись?" onConfirm={async () => { try { await remove(`lists/${list.id}/entries/${row.id}`); entries.refresh(); } catch (e) { message.error(e.message); } }}><Button danger icon={<DeleteOutlined/>} aria-label="Удалить запись"/></Popconfirm> }]}/></Card>
  </>;
}
