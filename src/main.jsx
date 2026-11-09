import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/:section/:campaignId?', element: <App /> },
  { path: '*', element: <App /> },
], { basename: import.meta.env.BASE_URL });

createRoot(document.getElementById('root')).render(<React.StrictMode><ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#1f4f82', colorInfo: '#1f4f82', borderRadius: 4, controlHeight: 32, fontSize: 13, fontFamily: 'Inter, Segoe UI, sans-serif', colorBgLayout: '#e7ebf0', colorBorder: '#b8c4d1', colorText: '#182433', colorTextSecondary: '#536274' } }}><AntApp><RouterProvider router={router} /></AntApp></ConfigProvider></React.StrictMode>);
