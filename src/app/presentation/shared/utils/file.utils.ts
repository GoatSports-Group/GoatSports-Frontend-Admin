export function isImageFile(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:image')) return true;

  const cleanUrl = url.split('?')[0].toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(extension => cleanUrl.endsWith(extension));
}

/** Lưu file trình duyệt nhận về (báo cáo PDF/Excel/CSV) với tên cho trước. */
export function downloadBlob(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
