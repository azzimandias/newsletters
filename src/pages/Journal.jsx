import { useState } from 'react';
import { Card, Select, Table } from 'antd';
import { allPages, get, jsonValue } from '../api';
import { useLoad } from '../hooks';
import { date } from '../domain';
import { Blank, Failure, PageHead, pager } from '../components/Common';
import { useTableFilters } from '../components/useTableFilters';
import { eventLabel, eventLabels } from './Results';

export default function Journal({ company }) {
  const [id, setId] = useState(null);
  const { page, setPage, filters, heading } = useTableFilters();
  const campaigns = useLoad(signal => allPages('campaigns', { company_id: company.id }, signal), [company.id]);
  const journal = useLoad(signal => id ? get(`campaigns/${id}/journal`, { page, ...filters }, signal) : Promise.resolve(null), [id, page, filters], id ? 10000 : 0);
  return <><PageHead title="Журнал"/><Failure error={campaigns.error} retry={campaigns.refresh}/><Card><Select aria-label="Рассылка для журнала" showSearch optionFilterProp="label" placeholder="Выберите рассылку" style={{ width: 'min(100%, 500px)' }} value={id} onChange={value => { setId(value); setPage(1); }} options={campaigns.data?.map(c => ({ value: c.id, label: c.name })) || []}/></Card><Failure error={journal.error} retry={journal.refresh}/>{id ? <Table className="campaigns-table campaign-list" scroll={{ x: 760 }} rowKey="id" dataSource={journal.data?.data || []} loading={journal.loading} pagination={pager(journal.data, setPage)} columns={[{ title: heading('Время · МСК', 'day', null, 'date'), dataIndex: 'created_at', render: date }, { title: heading('Событие', 'action', Object.entries(eventLabels).map(([value, label]) => ({ value, label }))), dataIndex: 'action', render: eventLabel }, { title: heading('Пользователь', 'actor'), dataIndex: 'actor_id', render: id => id ? `Сотрудник № ${id}` : 'Система' }, { title: heading('Подробности', 'details'), dataIndex: 'details', render: value => <code className="mono">{JSON.stringify(jsonValue(value))}</code> }]}/> : <Blank title="Выберите рассылку" description="Здесь появится история её подготовки и отправки."/>}</>;
}
