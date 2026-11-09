import { Alert, Button, Empty, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { statusLabels, statusColors } from '../domain';

export function Status({ value }) { return <Tag color={statusColors[value]}>{statusLabels[value] || value || '—'}</Tag>; }
export function Failure({ error, retry }) {
  return error ? <Alert className="error-banner" type="error" showIcon message={error.message || 'Не удалось загрузить данные'} action={retry && <Button onClick={retry} icon={<ReloadOutlined />}>Повторить</Button>} /> : null;
}
export function PageHead({ title, children }) {
  return <div className="page-head"><h1>{title}</h1><Space wrap>{children}</Space></div>;
}
export function Blank({ title = 'Пока ничего нет', description, children }) { return <div className="blank"><Empty description={<><h3>{title}</h3><p>{description}</p></>}>{children}</Empty></div>; }
export const pager = (data, onChange) => ({ current: data?.current_page || 1, total: data?.total || 0, pageSize: data?.per_page || 25, showSizeChanger: false, showTotal: total => `Всего: ${total}`, onChange });
export function Preview({ html, title = 'Предпросмотр письма' }) {
  return <iframe title={title} className="mail-preview" sandbox="" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:;">${html || '<p style="font:16px sans-serif;color:#778;padding:32px">Здесь появится письмо</p>'}`} />;
}
