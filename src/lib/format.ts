const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatNaira(kobo: number): string {
  return nairaFormatter.format(kobo / 100);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
