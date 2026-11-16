import { useTableFilters } from '../components/useTableFilters';
import { useState } from 'react';
import { App, Button, Form, Input, Modal, Select, Space, Table } from 'antd';
import { PlusOutlined, ArrowRightOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { get, post } from '../api';
import { useLoad } from '../hooks';
import { date, statusLabels } from '../domain';
import { PageHead, Failure, Status, Blank, pager } from '../components/Common';

export default function Campaigns({ company, permissions, navigate }) {
  const { page, setPage, filters, heading } = useTableFilters();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const list = useLoad(signal => get('campaigns', { company_id: company.id, page, ...filters }, signal), [company.id, page, filters], 10000);
  async function create() {
    try { const values = await form.validateFields(); setBusy(true); const campaign = await post('campaigns', { ...values, company_id: company.id }); setOpen(false); navigate('campaigns', campaign.id); }
    catch (e) { if (!e.errorFields) message.error(e.message); } finally { setBusy(false); }
  }
  async function copy(row) {
    try { const next = await post(`campaigns/${row.id}/copy`, {}); message.success('Создан новый черновик'); navigate('campaigns', next.id); } catch (e) { message.error(e.message); }
  }
  return <>
    <PageHead title="Рассылки">
      <Button icon={<ReloadOutlined/>} onClick={list.refresh}>Обновить</Button>{permissions.edit && <Button type="primary" icon={<PlusOutlined/>} onClick={() => { form.resetFields(); setOpen(true); }}>Создать рассылку</Button>}
    </PageHead>
    <Failure error={list.error} retry={list.refresh}/>
      <Table className="campaigns-table campaign-list" rowKey="id" loading={list.loading} dataSource={list.data?.data || []} pagination={pager(list.data, setPage)} scroll={{ x: 920 }} locale={{ emptyText: Object.keys(filters).length ? 'По выбранным фильтрам рассылок нет' : <Blank title="Первая рассылка начинается здесь" description="Создайте письмо, выберите контакты и отправьте тест."/> }} columns={[
        { title: heading('Рассылка', 'search'), dataIndex: 'name', render: (name, row) => <div><Button type="link" className="table-title" onClick={() => navigate('campaigns', row.id)}>{name}</Button><div className="muted table-subtitle">{row.subject || 'Тема ещё не задана'}</div></div> },
        { title: heading('Категория', 'category', [{ value: 'general', label: 'Новости' }, { value: 'seminar', label: 'Семинары' }]), dataIndex: 'category', render: value => value === 'seminar' ? 'Семинары' : 'Новости' },
        { title: heading('Статус', 'status', ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'].map(value => ({ value, label: statusLabels[value] }))), dataIndex: 'status', render: value => <Status value={value}/> },
        { title: heading('Отправка · МСК', 'sent_day', null, 'date'), dataIndex: 'scheduled_at', render: (value, row) => date(value || row.started_at) },
        { title: heading('Создана', 'created_day', null, 'date'), dataIndex: 'created_at', render: date },
        { title: 'Действия', key: 'actions', width: 250, render: (_, row) => <Space>{permissions.edit && <Button aria-label={`Копировать ${row.name}`} icon={<CopyOutlined/>} onClick={() => copy(row)}>Копировать</Button>}<Button aria-label={`В редактор: ${row.name}`} icon={<ArrowRightOutlined/>} onClick={() => navigate('campaigns', row.id)}>В редактор</Button></Space> },
      ]}/>
    <Modal open={open} title="Новая рассылка" okText="Создать черновик" confirmLoading={busy} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ category: 'general' }}><Form.Item name="name" label="Название для команды" rules={[{ required: true, whitespace: true, message: 'Введите название' }]}><Input maxLength={255} placeholder="Например, ноябрьские новинки"/></Form.Item><Form.Item name="category" label="Категория"><Select options={[{ value: 'general', label: 'Новости и предложения' }, { value: 'seminar', label: 'Семинары' }]}/></Form.Item><p className="muted">Это внутреннее название. Получатели увидят тему письма.</p></Form>
    </Modal>
  </>;
}
