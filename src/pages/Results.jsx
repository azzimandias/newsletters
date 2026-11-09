import { useState } from 'react';
import { Card, Modal, Select, Space, Statistic, Table, Tag } from 'antd';
import { get } from '../api';
import { useLoad } from '../hooks';
import { date, reasons, statusLabels } from '../domain';
import { Failure, pager, Status } from '../components/Common';

export default function Results({ id, version }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [recipient, setRecipient] = useState(null);
  const stats = useLoad(signal => get(`campaigns/${id}/statistics`, {}, signal), [id], 7000);
  const recipients = useLoad(signal => get(`campaigns/${id}/recipients`, { page, status }, signal), [id, page, status], 7000);
  const attempts = useLoad(signal => recipient ? get(`campaigns/${id}/recipients/${recipient.id}/attempts`, {}, signal) : Promise.resolve(null), [id, recipient?.id]);
  const journal = useLoad(signal => get(`campaigns/${id}/journal`, {}, signal), [id], 10000);
  const tracking = stats.data?.tracking || [];
  return <><Failure error={stats.error} retry={stats.refresh}/><div className="stat-grid">
    <Card><Statistic title="К отправке в снимке" value={version?.recipient_count || 0}/></Card>
    <Card><Statistic title="Ожидают" value={Number(stats.data?.sending.pending || 0) + Number(stats.data?.sending.retry_wait || 0)}/></Card>
    <Card><Statistic title="Передано SMTP" value={stats.data?.sending.submitted || 0}/></Card>
    <Card><Statistic title="Ошибки / неизвестно" value={`${stats.data?.sending.failed || 0} / ${stats.data?.sending.unknown || 0}`}/></Card>
    <Card><Statistic title="Доставлено / возвраты" value={`${stats.data?.delivery.delivered || 0} / ${stats.data?.delivery.bounced || 0}`}/></Card>
    <Card><Statistic title="Отписки" value={stats.data?.unsubscribes || 0}/></Card>
  </div><p className="muted">Передача SMTP не означает доставку. Доставка и возвраты появляются при получении подтверждённых событий почтового сервера.</p>
  <Card title="Вовлечённость"><div className="stat-grid four">{['open', 'click'].flatMap(type => { const row = tracking.find(t => t.type === type); return [<Statistic key={type} title={type === 'open' ? 'Все открытия' : 'Все переходы'} value={row?.total || 0}/>, <Statistic key={`${type}unique`} title={type === 'open' ? 'Открывшие адресаты' : 'Перешедшие адресаты'} value={row?.unique_recipients || 0}/>]; })}</div><p className="muted">Показатели приблизительные: почтовые роботы и блокировка картинок влияют на результат.</p><Table rowKey="link_id" size="small" pagination={false} dataSource={stats.data?.links || []} columns={[{ title: 'Ссылка', dataIndex: 'link_id', render: id => `№ ${id}` }, { title: 'Всего переходов', dataIndex: 'total' }, { title: 'Уникальных адресатов', dataIndex: 'unique_recipients' }]}/></Card>
  <Card title="Результат по адресатам" extra={<Select aria-label="Состояние отправки" style={{ width: 220 }} value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ value: '', label: 'Все состояния' }, ...['pending', 'processing', 'retry_wait', 'submitted', 'failed', 'unknown', 'skipped', 'cancelled'].map(value => ({ value, label: statusLabels[value] }))]}/>}>
    <Failure error={recipients.error} retry={recipients.refresh}/><Table rowKey="id" dataSource={recipients.data?.data || []} pagination={pager(recipients.data, setPage)} loading={recipients.loading} scroll={{ x: 760 }} columns={[{ title: 'Email · открыть попытки', dataIndex: 'email', render: (email, row) => <button className="text-button" onClick={() => setRecipient(row)}>{email}</button> }, { title: 'Отправка', dataIndex: 'status', render: value => <Status value={value}/> }, { title: 'Доставка', dataIndex: 'delivery_status', render: value => value === 'unknown' ? 'Нет сведений' : <Status value={value}/> }, { title: 'Причина', dataIndex: 'reason', render: value => reasons[value] || value || '—' }, { title: 'Попыток', dataIndex: 'attempt_count' }, { title: 'Передано · МСК', dataIndex: 'submitted_at', render: date }]}/>
  </Card>
  <Card title="Последние события рассылки"><Failure error={journal.error} retry={journal.refresh}/><Table size="small" rowKey="id" dataSource={journal.data?.data || []} pagination={false} columns={[{ title: 'Время · МСК', dataIndex: 'created_at', render: date }, { title: 'Действие', dataIndex: 'action', render: eventLabel }, { title: 'Пользователь', dataIndex: 'actor_id', render: id => id ? `№ ${id}` : 'Система' }]}/></Card>
  <Modal open={Boolean(recipient)} title={`Попытки отправки · ${recipient?.email || ''}`} width={820} footer={null} onCancel={() => setRecipient(null)}><Failure error={attempts.error} retry={attempts.refresh}/><Table size="small" rowKey="id" dataSource={attempts.data?.data || []} pagination={false} columns={[{ title: 'Начало · МСК', dataIndex: 'started_at', render: date }, { title: 'Результат', dataIndex: 'status', render: value => <Status value={value}/> }, { title: 'Код', dataIndex: 'error_code' }, { title: 'Message-ID', dataIndex: 'message_id', render: value => <span className="mono">{value}</span> }]}/></Modal>
  </>;
}

export const eventLabel = value => ({ 'campaign.created': 'Создан черновик', 'campaign.edited': 'Изменён черновик', 'campaign.preparing': 'Подготовка аудитории', 'campaign.confirmed': 'Подтверждён запуск', 'campaign.started': 'Начата отправка', 'campaign.pause': 'Пауза', 'campaign.resume': 'Возобновление', 'campaign.cancel': 'Отмена', 'campaign.draft': 'Возврат в черновик', 'campaign.completed': 'Отправка завершена', 'campaign.auto_paused': 'Автоматическая пауза', 'campaign.copied': 'Создана копия', 'campaign.test_requested': 'Запрошен тест', 'campaign.test_checked': 'Тест проверен', 'recipient.feedback': 'Получен результат SMTP' }[value] || value);
