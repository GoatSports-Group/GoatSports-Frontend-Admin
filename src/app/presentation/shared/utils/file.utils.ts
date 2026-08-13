export function isImageFile(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:image')) return true;

  const cleanUrl = url.split('?')[0].toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(extension => cleanUrl.endsWith(extension));
}
