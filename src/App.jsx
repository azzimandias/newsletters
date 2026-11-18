import { useState } from 'react';
import { App as AntApp, Alert, Avatar, Button, Layout, Menu, Modal, Space, Spin, Tag } from 'antd';
import { SendOutlined, TeamOutlined, FileTextOutlined, HistoryOutlined, SettingOutlined, QuestionCircleOutlined, HomeOutlined, MailOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, Navigate, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get } from './api';
import { useLoad } from './hooks';
import { Failure, PageHead, ToolbarContext } from './components/Common';
import Campaigns from './pages/Campaigns';
import CampaignEditor from './pages/CampaignEditor';
import Lists from './pages/Lists';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Journal from './pages/Journal';
import Help from './pages/Help';

const homeUrl = import.meta.env.VITE_HOME_URL || '/';

export default function App() {
  const session = useLoad(signal => get('session', {}, signal), []);
  const { section, campaignId, '*': unmatched } = useParams();
  const [query] = useSearchParams();
  const companyId = query.get('company_id');
  const companies = (session.data?.companies || []).filter(c => c.name?.trim().toLowerCase() !== 'freecompany');
  const company = companyId ? companies.find(c => String(c.id) === companyId) : companies[0];
  const [toolbar, setToolbar] = useState(null);
  const [dirty, setDirty] = useState(false);
  const { modal } = AntApp.useApp();
  const go = useNavigate();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) return false;
    const companyAt = location => new URLSearchParams(location.search).get('company_id');
    return currentLocation.pathname !== nextLocation.pathname || companyAt(currentLocation) !== companyAt(nextLocation);
  });
  const page = section || 'campaigns';
  const validPath = !unmatched && (!campaignId || (page === 'campaigns' && /^[1-9]\d*$/.test(campaignId)));
  function pathFor(sectionName, id, selectedCompany = company?.id) {
    const path = '/' + sectionName + (id ? '/' + id : '');
    return selectedCompany ? path + '?company_id=' + selectedCompany : path;
  }
  const permissions = company?.permissions || {};
  const confirmLeave = fn => dirty ? modal.confirm({ title: 'Есть несохранённые изменения', content: 'При переходе они будут потеряны.', okText: 'Перейти без сохранения', cancelText: 'Остаться', onOk: () => { setDirty(false); fn(); } }) : fn();
  const navigate = (page, id = null) => go(pathFor(page, id));
  const menus = [
    { key: 'campaigns', icon: <SendOutlined />, label: 'Рассылки', allowed: permissions.view },
    { key: 'lists', icon: <TeamOutlined />, label: 'Получатели', allowed: permissions.view },
    { key: 'templates', icon: <FileTextOutlined />, label: 'Шаблоны', allowed: permissions.view },
    { key: 'journal', icon: <HistoryOutlined />, label: 'Журнал', allowed: permissions.statistics && permissions.view },
    { key: 'settings', icon: <SettingOutlined />, label: 'Настройки', allowed: permissions.settings },
    { key: 'help', icon: <QuestionCircleOutlined />, label: 'Справка', allowed: true },
  ].filter(item => item.allowed);
  const context = { company, permissions, session: session.data, navigate, onDirty: setDirty };

  if (!section && !unmatched && company) return <Navigate replace to={pathFor(menus[0].key)} />;

  const notices = <>
          {session.data?.preview && <Alert type="warning" showIcon message="Демонстрационный режим: вымышленные данные, письма не отправляются."/>}
          {!session.data?.sending_enabled && <Alert className="environment-banner" type="info" showIcon message="Можно готовить рассылки. Массовая отправка пока выключена администратором." />}
  </>;

  return <Layout className="app-shell">
    <Modal open={blocker.state === 'blocked'} title="Есть несохранённые изменения"
      okText="Перейти без сохранения" cancelText="Остаться"
      onOk={() => { setDirty(false); blocker.proceed?.(); }} onCancel={() => blocker.reset?.()}>
      При переходе изменения черновика будут потеряны.
    </Modal>
    <Layout>
      <div className="sticky-controls">
        <header className="global-header ui-topmenu"><Space><a className="home-link" title="На главную ERP" aria-label="На главную ERP" href={homeUrl} onClick={event => { if (dirty) { event.preventDefault(); confirmLeave(() => { window.location.assign(homeUrl); }); } }}><HomeOutlined /></a><span className="eyebrow">Рассылки</span></Space>
          <Menu mode="horizontal" selectedKeys={[page]} items={menus.map(({ allowed, ...item }) => ({ ...item, label: <Link to={pathFor(item.key)}>{item.label}</Link> }))} />
          <div className="user-profile"><Avatar size={23} shape="square" style={{ background: 'var(--sk-active-button)' }}>{session.data?.user.name?.[0] || 'E'}</Avatar><strong>{session.data?.user.name || 'ERP'}</strong></div></header>
        <div className="page-toolbar" ref={setToolbar} />
      </div>
      <ToolbarContext.Provider value={toolbar}>
      <main className="main-content">
        {page === 'help' && validPath ? <Help /> : session.loading ? <div className="loading-screen"><Spin size="large" /><p>Подключаемся к ERP…</p></div> : session.error ? <div className="connection-error"><PageHead title="Подключение к ERP" /><Failure error={session.error} retry={session.refresh}/><p>Для работы нужна активная сессия ERP и доступ к модулю рассылок.</p><Button href={import.meta.env.VITE_LOGIN_URL || '/login'}>Открыть вход в ERP</Button></div> : !company ? <Alert type="info" showIcon message={companyId ? "Выбранная компания недоступна" : "Нет доступных компаний"} description="Попросите администратора назначить права на модуль рассылок."/> : !validPath || !['campaigns', 'lists', 'templates', 'journal', 'settings', 'help'].includes(page) ? <Alert type="info" message="Страница не найдена" /> : !menus.some(item => item.key === page) ? <Alert type="warning" message="Нет доступа к этому разделу" /> : <>
          {notices}
          <div key={company.id} className={`page-content${['campaigns', 'lists', 'templates', 'journal', 'settings'].includes(page) && !campaignId ? ' page-content--table' : ''}`}>
            {page === 'campaigns' && (campaignId ? <CampaignEditor key={campaignId} id={campaignId} {...context} /> : <Campaigns {...context}/>)}
            {page === 'lists' && <Lists {...context}/>}
            {page === 'templates' && <Templates {...context}/>}
            {page === 'journal' && <Journal {...context}/>}
            {page === 'settings' && <Settings {...context}/>}
            {page === 'help' && <Help />}
            {!page && <Alert type="info" message="Для открытия разделов требуется право просмотра или управления настройками."/>}
          </div>
        </>}
      </main>
      </ToolbarContext.Provider>
    </Layout>
  </Layout>;
}
