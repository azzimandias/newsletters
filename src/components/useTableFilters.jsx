import { useState } from 'react';
import { DatePicker, Input, Select } from 'antd';
import dayjs from 'dayjs';

export function useTableFilters() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  function updateFilter(key, value) {
    setPage(1);
    setFilters(previous => {
      const next = { ...previous };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }
  function heading(label, key, options, type) {
    const props = { 'aria-label': label, placeholder: label, size: 'small', allowClear: true, variant: 'borderless', className: 'campaign-filter' };
    if (options) return <Select {...props} value={filters[key]} options={options} onChange={value => updateFilter(key, value)} />;
    if (type === 'date') return <DatePicker {...props} format="DD.MM.YYYY" value={filters[key] ? dayjs(filters[key]) : null}
      onChange={value => updateFilter(key, value?.format('YYYY-MM-DD'))} />;
    return <Input {...props} value={filters[key] || ''} maxLength={255} onChange={event => updateFilter(key, event.target.value)} />;
  }
  return { page, setPage, filters, heading };
}
