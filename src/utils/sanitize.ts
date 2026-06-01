export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
