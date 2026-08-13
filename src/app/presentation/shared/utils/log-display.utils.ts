export function formatInputDate(date: string): string {
  if (!date) return '';
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
}

export function formatLogTimestamp(date: string, dateFirst = false): string {
  if (!date) return '';

  const parsed = new Date(normalizeUtcDate(date));
  if (Number.isNaN(parsed.getTime())) return date;

  const time = [parsed.getHours(), parsed.getMinutes(), parsed.getSeconds()]
    .map(value => String(value).padStart(2, '0'))
    .join(':');
  const formattedDate = [parsed.getDate(), parsed.getMonth() + 1]
    .map(value => String(value).padStart(2, '0'))
    .concat(String(parsed.getFullYear()))
    .join('/');

  return dateFirst ? `${formattedDate} ${time}` : `${time} ${formattedDate}`;
}

export function getLogActionBadgeClass(action: string): string {
  const value = action?.toUpperCase();
  if (!value) return 'bg-slate-50 text-slate-600 border-slate-200';
  if (value.includes('LOGIN') || value.includes('REGISTER')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (value.includes('LOGOUT') || value.includes('RESET') || value.includes('UPDATE')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (value.includes('APPROVE') || value.includes('ASSIGN')) {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }
  if (value.includes('ERROR') || value.includes('FAIL')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function getHttpStatusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'bg-emerald-500 text-white';
  if (statusCode >= 300 && statusCode < 400) return 'bg-blue-500 text-white';
  if (statusCode >= 400 && statusCode < 500) return 'bg-amber-500 text-white';
  if (statusCode >= 500) return 'bg-rose-500 text-white';
  return 'bg-slate-500 text-white';
}

function normalizeUtcDate(date: string): string {
  return date.endsWith('Z') || date.includes('+') ? date : `${date}Z`;
}
