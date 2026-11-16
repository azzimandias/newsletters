import { useTableFilters } from '../components/useTableFilters';
import { useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Select, Space, Spin, Table } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { get, jsonValue, post, put, remove } from '../api';
import { useLoad } from '../hooks';
import { Blank, Failure, PageHead, pager, Preview } from '../components/Common';

import TemplateEditor from '../components/TemplateEditor';
export default function Templates({ company, permissions, session }) {
  const { message, modal } = App.useApp();
  const { page, setPage, filters: columnFilters, heading } = useTableFilters();
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const list = useLoad(signal => get('templates', { company_id: company.id, page, ...columnFilters }, signal), [company.id, page, columnFilters]);
  return <><PageHead title="Шаблоны">{permissions.edit && <Button type="primary" icon={<PlusOutlined/>} onClick={() => { setEditing({ name: '', subject: '', html: '', editor_mode: 'visual', editor_data: null, company_id: company.id }); }}>Создать шаблон</Button>}</PageHead><Failure error={list.error} retry={list.refresh}/><Card className="table-card"><Table className="campaigns-table" scroll={{ x: 800 }} rowKey="id" dataSource={list.data?.data || []} loading={list.loading} pagination={pager(list.data, setPage)} locale={{ emptyText: Object.keys(columnFilters).length ? 'По выбранным фильтрам ничего не найдено' : <Blank title="Библиотека пока пуста" description="Создайте первый шаблон для рассылки."/> }} columns={[{ title: heading('Шаблон', 'name'), dataIndex: 'name', render: (name, row) => <button className="text-button" onClick={() => setPreview(row)}>{name}</button> }, { title: heading('Тема', 'subject'), dataIndex: 'subject' }, { title: heading('Доступ', 'scope', [{ value: 'company', label: 'Эта компания' }, { value: 'shared', label: 'Все компании' }]), dataIndex: 'company_id', render: value => value ? 'Эта компания' : 'Все компании' }, { title: heading('Редактор', 'editor_mode', [{ value: 'html', label: 'HTML' }, { value: 'visual', label: 'Визуальный' }]), dataIndex: 'editor_mode', render: value => value === 'html' ? 'HTML' : 'Визуальный' }, { title: 'Действия', render: (_, row) => <Space><Button onClick={() => setPreview(row)}>Просмотр</Button>{permissions.edit && (row.company_id || session.user.super) && <><Button aria-label="Редактировать шаблон" icon={<EditOutlined/>} onClick={() => { setEditing({ ...row, editor_data: jsonValue(row.editor_data, null) }); }}>Редактировать</Button><Popconfirm title="Удалить шаблон?" description="Созданные из него рассылки сохранятся." onConfirm={async () => { try { await remove(`templates/${row.id}`); list.refresh(); } catch (e) { message.error(e.message); } }}><Button aria-label="Удалить шаблон" danger icon={<DeleteOutlined/>}>Удалить</Button></Popconfirm></>}</Space> }]}/></Card>
    {editing && <TemplateEditor initial={editing} company={company} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.refresh(); }} />}<Modal open={Boolean(preview)} title={preview?.name} width={850} footer={null} onCancel={() => setPreview(null)}><Preview html={preview?.html}/></Modal>
  </>;
}
