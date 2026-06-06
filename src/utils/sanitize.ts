import DOMPurify from 'dompurify';

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

/**
 * [FIX-07] 이메일 본문 HTML을 안전하게 정제합니다.
 * - 모든 스크립트, 이벤트 핸들러, iframe, form, object 태그를 제거
 * - 외부 이미지 로딩을 차단하여 Web Beacon(1px 추적 이미지) 방지
 * - 안전한 서식 태그만 허용
 */
export function sanitizeEmailHtml(dirtyHtml: string): string {
  if (typeof window === 'undefined') {
    return dirtyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'span', 'div',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'pre', 'code', 'hr', 'small', 'sub', 'sup',
    ],
    ALLOWED_ATTR: ['class', 'dir', 'lang'],
    FORBID_TAGS: [
      'script', 'style', 'iframe', 'object', 'embed', 'form',
      'input', 'textarea', 'select', 'button', 'link', 'meta',
      'img', 'video', 'audio', 'source', 'picture', 'svg',
    ],
    FORBID_ATTR: [
      'onerror', 'onclick', 'onload', 'onmouseover', 'onfocus',
      'onblur', 'onsubmit', 'onchange', 'style', 'src', 'href',
      'action', 'formaction', 'background', 'poster',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * 이메일 본문을 순수 텍스트로 안전하게 변환합니다.
 */
export function sanitizeToPlainText(dirtyHtml: string): string {
  if (typeof window === 'undefined') {
    return dirtyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const cleaned = DOMPurify.sanitize(dirtyHtml, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}
