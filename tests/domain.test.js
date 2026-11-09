import { describe, it, expect, vi } from 'vitest';
import { canLaunch, moscowSchedule, parseAddresses, date } from '../src/domain';

describe('Запуск только проверенной версии', () => {
  const data = { campaign: { status: 'draft' }, version: { id: 12, status: 'ready', recipient_count: 800, conflict_count: 0 }, tests: [{ version_id: 12, status: 'submitted', checked_at: '2026-11-03T10:00:00Z' }], dirty: false, canSend: true };
  it('разрешает актуальную проверенную версию', () => expect(canLaunch(data)).toBe(true));
  it.each([
    ['несохранённые изменения', { dirty: true }], ['нет права запуска', { canSend: false }],
    ['старый тест', { tests: [{ version_id: 11, status: 'submitted', checked_at: '2026-11-03' }] }],
    ['тест не проверен', { tests: [{ version_id: 12, status: 'submitted' }] }],
    ['неизвестный результат теста', { tests: [{ version_id: 12, status: 'unknown', checked_at: '2026-11-03' }] }],
    ['кампания уже отправляется', { campaign: { status: 'running' } }],
    ['есть конфликт', { version: { ...data.version, conflict_count: 1 } }],
    ['пустая аудитория', { version: { ...data.version, recipient_count: 0 } }],
    ['аудитория ещё готовится', { version: { ...data.version, status: 'pending' } }],
  ])('блокирует: %s', (_, values) => expect(canLaunch({ ...data, ...values })).toBe(false));
});

describe('Московское расписание', () => {
  it('передаёт явное смещение, независимо от часового пояса браузера', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    expect(moscowSchedule('2026-11-03T14:00')).toBe('2026-11-03T14:00:00+03:00');
    expect(() => moscowSchedule('2026-11-03T12:00')).toThrow();
    vi.useRealTimers();
  });
  it('читает даты БД как UTC и показывает Москву', () => expect(date('2026-11-03 09:30:00')).toContain('12:30'));
});

describe('Ручные адреса', () => {
  it('нормализует и устраняет дубликаты без изменения +tag', () => expect(parseAddresses(' A@EXAMPLE.COM; a@example.com\na+tag@example.com ')).toEqual(['a@example.com', 'a+tag@example.com']));
  it('отклоняет ошибочный и пустой ввод', () => { expect(() => parseAddresses('a@example.com; invalid')).toThrow(); expect(() => parseAddresses(' ')).toThrow(); });
});
