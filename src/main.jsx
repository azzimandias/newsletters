import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import './assets/common-theme.css';
import './theme.css';

const css = getComputedStyle(document.documentElement);
const token = name => css.getPropertyValue(name).trim();
const size = name => parseFloat(token(name));

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/:section/:campaignId?', element: <App /> },
  { path: '*', element: <App /> },
], { basename: import.meta.env.BASE_URL });

createRoot(document.getElementById('root')).render(<React.StrictMode><ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: token('--sk-active-button'), colorInfo: '#1f4f82', borderRadius: 4, controlHeight: size('--ui-pagination-size'), fontSize: size('--ui-text-size'), fontFamily: token('--ui-font'), colorBgLayout: token('--ui-alt-row'), colorBorder: token('--ui-border'), colorText: token('--ui-text'), colorTextSecondary: '#536274' } }}><AntApp><RouterProvider router={router} /></AntApp></ConfigProvider></React.StrictMode>);
