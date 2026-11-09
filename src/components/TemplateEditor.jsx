import { lazy, Suspense, useRef, useState } from 'react';
import { App, Checkbox, Form, Input, Modal, Select, Space, Spin } from 'antd';
import { jsonValue, post, put } from '../api';

const EmailDesigner = lazy(() => import('./EmailDesigner'));

export default function TemplateEditor({ initial, company, session, onClose, onSaved }) {
  const { message, modal } = App.useApp();
  const [editing, setEditing] = useState(() => ({ ...initial, editor_data: jsonValue(initial.editor_data, null) }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const capture = useRef(null);

  function change(values) {
    setEditing(previous => ({ ...previous, ...values }));
    setDirty(true);
  }
  function close() {
    if (busy) return;
    if (dirty) modal.confirm({ title: 'Закрыть без сохранения?', onOk: onClose });
    else onClose();
  }
  async function save() {
    const current = { ...editing, ...(capture.current?.() || {}) };
    const { id, name, subject, html, editor_mode, editor_data, company_id } = current;
    if (!name?.trim() || !subject?.trim() || !html?.trim()) {
      message.error('Заполните название, тему и содержимое');
      return;
    }
    setBusy(true);
    try {
      const data = { name, subject, html, editor_mode, editor_data, company_id };
      const result = id ? await put(`templates/${id}`, data) : await post('templates', data);
      message.success('Шаблон сохранён');
      onSaved({ ...data, id: result.id });
    } catch (error) {
      message.error(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={editing?.id ? 'Редактировать шаблон' : 'Новый шаблон'} width="95vw" onCancel={close} onOk={save} okText="Сохранить шаблон" confirmLoading={busy} destroyOnClose>
      {editing && <><Form layout="vertical" className="field-grid"><Form.Item label="Название"><Input maxLength={255} value={editing.name} onChange={e => change({ name: e.target.value })}/></Form.Item><Form.Item label="Тема письма"><Input maxLength={255} value={editing.subject} onChange={e => change({ subject: e.target.value })}/></Form.Item></Form>
      <Space className="editor-mode" wrap><Select aria-label="Режим шаблона" value={editing.editor_mode} options={[{ value: 'visual', label: 'Визуальный редактор' }, { value: 'html', label: 'HTML' }]} onChange={mode => { if (mode === 'visual') modal.confirm({ title: 'Преобразовать HTML в визуальные блоки?', content: 'Некоторые детали вёрстки могут измениться.', onOk: () => { change({ editor_mode: mode, editor_data: null }); setKey(k => k + 1); } }); else change({ editor_mode: mode }); }}/>{session.user.super && !editing.id && <Checkbox checked={editing.company_id === null} onChange={e => change({ company_id: e.target.checked ? null : company.id })}>Общий для всех компаний</Checkbox>}</Space>
      {editing.editor_mode === 'html' ? <Input.TextArea aria-label="HTML шаблона" rows={22} className="code-editor" value={editing.html} onChange={e => change({ html: e.target.value, editor_data: null })}/> : <Suspense fallback={<Spin/>}><EmailDesigner key={key} captureRef={capture} value={editing} companyId={company.id} onChange={change}/></Suspense>}</>}
    </Modal>
  );
}
