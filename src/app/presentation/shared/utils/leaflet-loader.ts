// Admin không cài gói leaflet: nạp bản 1.9.4 từ unpkg một lần cho mọi trang có bản đồ (Tổng quan, Sân ngoài hệ thống).
const STYLE_ID = 'leaflet-dashboard-styles';
const SCRIPT_ID = 'leaflet-dashboard-script';

/** Trả `window.L` khi Leaflet sẵn sàng; gọi nhiều lần chỉ nạp một lần. */
export function loadLeaflet(): Promise<any> {
  const loaded = (window as any).L;
  if (loaded) return Promise.resolve(loaded);

  if (!document.getElementById(STYLE_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  return new Promise(resolve => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.body.appendChild(script);
    }
    script.addEventListener('load', () => resolve((window as any).L), { once: true });
  });
}
