import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Select, Space, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { post } from '../api';
import { variables } from '../domain';
import 'grapesjs/dist/css/grapes.min.css';
import ru from 'grapesjs/locale/ru.mjs';

const editorMessages = {
  ...ru,
  styleManager: {
    ...ru.styleManager,
    sectors: { ...ru.styleManager.sectors, dimension: 'Размеры' },
    properties: {
      ...ru.styleManager.properties,
      width: 'Ширина', height: 'Высота', 'max-width': 'Максимальная ширина', 'min-height': 'Минимальная высота',
      margin: 'Внешний отступ', padding: 'Внутренний отступ',
      'font-family': 'Шрифт', 'font-size': 'Размер шрифта', 'font-weight': 'Толщина шрифта',
      'letter-spacing': 'Межбуквенный интервал', color: 'Цвет текста', 'line-height': 'Межстрочный интервал',
      'text-align': 'Выравнивание текста', 'text-decoration': 'Оформление текста', 'font-style': 'Начертание',
      'vertical-align': 'Вертикальное выравнивание', 'text-shadow': 'Тень текста',
      'background-color': 'Цвет фона', 'border-collapse': 'Объединение границ', 'border-radius': 'Скругление углов',
      border: 'Граница', background: 'Фон',
    },
  },
  domComponents: { ...ru.domComponents, names: { ...ru.domComponents.names, image: 'Изображение', video: 'Видео' } },
  traitManager: {
    ...ru.traitManager,
    empty: 'Выберите элемент для настройки',
    traits: { ...ru.traitManager.traits, labels: { id: 'Идентификатор', alt: 'Описание изображения', href: 'Адрес ссылки', title: 'Подсказка', target: 'Открывать ссылку' } },
  },
  panels: { ...ru.panels, buttons: { ...ru.panels.buttons, titles: {
    ...ru.panels.buttons.titles,
    'open-sm': 'Стили', 'open-layers': 'Слои', 'open-blocks': 'Блоки',
    'set-device-desktop': 'Компьютер', 'set-device-tablet': 'Планшет', 'set-device-mobile': 'Телефон',
    'gjs-open-import-template': 'Импорт шаблона', 'gjs-toggle-images': 'Показать или скрыть изображения',
    undo: 'Отменить действие', redo: 'Повторить действие', 'canvas-clear': 'Очистить макет',
  } } },
};

const initial = '<table role="presentation" width="100%" style="background:#f4f5f2;padding:24px"><tr><td><table role="presentation" align="center" width="600" style="background:#fff;padding:32px;font-family:Arial,sans-serif;color:#243a30"><tr><td><h1>Расскажите о главном</h1><p>Здравствуйте!</p><p>Добавьте сюда новости, предложение или приглашение на семинар.</p><p>С уважением,<br>{{company_name}}</p></td></tr></table></td></tr></table>';

export default function EmailDesigner({ value, companyId, onChange, disabled, captureRef }) {
  const container = useRef(null);
  const instance = useRef(null);
  const fileInput = useRef(null);
  const latest = useRef(onChange); latest.current = onChange;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { message } = App.useApp();
  useEffect(() => {
    let cancelled = false;
    let editor;
    Promise.all([import('grapesjs'), import('grapesjs-preset-newsletter')]).then(([g, plugin]) => {
      if (cancelled) return;
      editor = g.default.init({
        container: container.current, height: '650px', storageManager: false, fromElement: false,
        i18n: { locale: 'ru', detectLocale: false, messages: { ru: editorMessages } },
        plugins: [plugin.default], pluginsOpts: { [plugin.default]: {
          inlineCss: true, modalTitleImport: 'Импорт шаблона', modalTitleExport: 'Экспорт шаблона',
          modalBtnImport: 'Импортировать', textCleanCanvas: 'Очистить макет письма?',
        } },
        assetManager: { upload: false, autoAdd: false },
        canvas: { scripts: [], styles: [] },
        parser: { optionsHtml: { allowScripts: false, allowUnsafeAttr: false } },
      });
      instance.current = editor;
      const labels = { 'sect100': 'Одна колонка', 'sect50': 'Две колонки', 'sect30': 'Три колонки', 'sect37': 'Колонки 30/70', 'button': 'Кнопка', 'divider': 'Разделитель', 'text': 'Текст', 'text-sect': 'Текстовый раздел', 'image': 'Изображение', 'quote': 'Цитата', 'link': 'Ссылка', 'link-block': 'Блок-ссылка', 'grid-items': 'Карточки', 'list-items': 'Список' };
      Object.entries(labels).forEach(([id, label]) => editor.BlockManager.get(id)?.set('label', label));
      if (value.editor_data && Object.keys(value.editor_data).length) editor.loadProjectData(value.editor_data);
      else editor.setComponents(value.html || initial);
      editor.on('load', () => { if (!cancelled) setLoading(false); });
      const capture = () => {
        let html;
        try { html = editor.runCommand('gjs-get-inlined-html'); } catch { html = `<style>${editor.getCss()}</style>${editor.getHtml()}`; }
        return { html: html || editor.getHtml(), editor_data: editor.getProjectData(), editor_mode: 'visual' };
      };
      if (captureRef) captureRef.current = capture;
      editor.on('update', () => { if (!cancelled) latest.current(capture()); });
      if (!value.html) latest.current(capture());
      setLoading(false);
    }).catch(e => { if (!cancelled) { setError(`Не удалось открыть редактор: ${e.message}`); setLoading(false); } });
    return () => { cancelled = true; instance.current = null; if (captureRef) captureRef.current = null; editor?.destroy(); };
  }, []);
  async function upload(file) {
    if (!file) return;
    try {
      const form = new FormData(); form.append('company_id', companyId); form.append('kind', 'image'); form.append('file', file);
      const asset = await post('assets', form);
      if (!asset.url?.startsWith('https://')) { message.error('Для изображений администратор должен настроить публичный HTTPS-адрес.'); return; }
      instance.current?.AssetManager.add({ src: asset.url, name: file.name });
      const selected = instance.current?.getSelected();
      if (selected?.is('image')) selected.set('src', asset.url);
      else instance.current?.addComponents({ type: 'image', src: asset.url, style: { 'max-width': '100%' } });
      message.success('Изображение добавлено');
    } catch (e) { message.error(e.message); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  return <div className={disabled ? 'designer-disabled' : ''}>
    <div className="designer-tools"><Space wrap><Button icon={<UploadOutlined/>} disabled={disabled} onClick={() => fileInput.current.click()}>Загрузить изображение</Button><Select aria-label="Добавить переменную" placeholder="Персонализация" style={{ width: 230 }} value={null} disabled={disabled} options={Object.entries(variables).map(([value, label]) => ({ value, label }))} onChange={key => { const component = instance.current?.getSelected(); if (component?.is('text')) component.components(`${component.get('content') || component.getInnerHTML()} {{${key}}}`); else instance.current?.addComponents(`<p>{{${key}}}</p>`); }}/></Space><small>Перетаскивайте блоки и редактируйте текст прямо в письме</small></div>
    <input ref={fileInput} type="file" accept="image/jpeg,image/png" hidden onChange={e => upload(e.target.files[0])}/>
    {error && <Alert type="error" message={error}/>}<Spin spinning={loading}><div ref={container}/></Spin>
  </div>;
}
