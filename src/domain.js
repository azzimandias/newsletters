export const statusLabels = {
  draft: 'Черновик', scheduled: 'Запланирована', running: 'Отправляется', paused: 'Приостановлена', completed: 'Завершена', cancelled: 'Отменена', failed: 'Ошибка',
  pending: 'Ожидает', processing: 'Обрабатывается', retry_wait: 'Ожидает повтора', submitted: 'Передано SMTP', unknown: 'Результат неизвестен', skipped: 'Пропущено',
  ready: 'Готова', superseded: 'Устарела', delivered: 'Доставлено', bounced: 'Возврат', building: 'Подготовка',
};
export const statusColors = { running: 'processing', completed: 'success', failed: 'error', paused: 'warning', scheduled: 'blue', submitted: 'cyan', unknown: 'warning', ready: 'success', delivered: 'success', bounced: 'error' };
export const sources = [{ value: 'contact', label: 'Контактные лица ERP' }, { value: 'organization', label: 'Общие адреса организаций' }, { value: 'legacy', label: 'Старый справочник' }];
export const variables = {
  first_name: 'Имя', last_name: 'Фамилия', middle_name: 'Отчество', organization: 'Организация получателя',
  manager_name: 'Менеджер клиента', manager_email: 'Email менеджера', manager_phone: 'Телефон менеджера',
  company_name: 'Наша компания', company_email: 'Email компании', company_phone: 'Телефон компании', company_signature: 'Подпись компании',
};
export const reasons = { unsubscribed: 'Отписка от компании', legacy_unsubscribed: 'Отписка в старом справочнике', legacy_subscription: 'Ограничение подписки ERP', invalid_mailbox: 'Адрес заблокирован', manual_exclusion: 'Ручное исключение', worker_interrupted: 'Прервано выполнение', transport_result_unknown: 'Нет подтверждённого ответа SMTP' };
export const filters = {
  organization_ids: 'Организации ERP', region_ids: 'Регионы ERP', town_ids: 'Города ERP', manager_ids: 'Менеджеры ERP', profile_ids: 'Профили ERP', relation_ids: 'Отношения ERP',
  legacy_organization_ids: 'Старые организации', legacy_region_ids: 'Старые регионы', legacy_town_ids: 'Старые города', legacy_manager_ids: 'Старые менеджеры', legacy_profile_ids: 'Старые профили',
};
export const date = value => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`)) : '—';
export const number = value => new Intl.NumberFormat('ru-RU').format(Number(value || 0));
export function moscowSchedule(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) throw new Error('Укажите дату и время отправки.');
  const result = `${value}:00+03:00`;
  if (!Number.isFinite(Date.parse(result)) || Date.parse(result) <= Date.now()) throw new Error('Время отправки должно быть в будущем.');
  return result;
}
export function canLaunch({ campaign, version, tests = [], dirty, canSend }) {
  return Boolean(canSend && !dirty && campaign?.status === 'draft' && version?.status === 'ready'
    && Number(version.recipient_count) > 0 && !Number(version.conflict_count || 0) && tests.some(t => t.status === 'submitted' && t.checked_at && Number(t.version_id) === Number(version.id)));
}
export function parseAddresses(value) {
  const addresses = [...new Set(value.split(/[\s;,]+/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (!addresses.length) throw new Error('Введите хотя бы один email.');
  const invalid = addresses.filter(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  if (invalid.length) throw new Error(`Проверьте адреса: ${invalid.slice(0, 5).join(', ')}`);
  return addresses;
}
