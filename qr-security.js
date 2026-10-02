/* Secure attendance QR flow. Loaded after app.js. */
(() => {
  const TTL = 90_000;
  let timer;

  async function issue() {
    const result = await apiPost('/api/attendance-qr', { action: 'issue' });
    if (!result?.token) throw new Error('QR صادر نشد');
    return result;
  }

  window.openAttendanceQR = async () => {
    const root = document.getElementById('edit-modal-root');
    if (!root) return;
    root.innerHTML = '<div class="overlay"><div class="modal" style="text-align:center"><h3>📱 QR ورود و خروج دفتر</h3><p id="attendance-qr-status" style="font-size:12px;color:var(--muted)">در حال ساخت QR امن...</p><div id="attendance-qr" style="display:flex;justify-content:center;margin:16px"></div><div class="modal-actions"><button class="btn secondary" onclick="this.closest(\'.overlay\').remove()">بستن</button></div></div></div>';
    try {
      const issued = await issue();
      const box = document.getElementById('attendance-qr');
      if (!box || !window.QRCode) throw new Error('QR library unavailable');
      new QRCode(box, { text: `${location.origin}/?attendance_qr=${encodeURIComponent(issued.token)}`, width: 240, height: 240 });
      document.getElementById('attendance-qr-status').textContent = 'این QR تا ۹۰ ثانیه معتبر است و فقط یک‌بار استفاده می‌شود.';
      clearTimeout(timer);
      timer = setTimeout(() => { box.innerHTML = ''; document.getElementById('attendance-qr-status').textContent = 'QR منقضی شد؛ QR جدید بساز.'; }, TTL);
    } catch (_) {
      document.getElementById('attendance-qr-status').textContent = 'ساخت QR انجام نشد؛ دوباره تلاش کن.';
    }
  };

  window.consumeAttendanceQR = async (token) => {
    if (!token) return;
    const result = await apiPost('/api/attendance-qr', { action: 'consume', token });
    showToast(result?.status === 'ok' ? `${result.action} شما با QR امن ثبت شد ✅` : result?.error === 'expired_or_used' ? 'QR منقضی یا قبلاً استفاده شده است' : 'ثبت QR انجام نشد؛ دوباره تلاش کن');
  };
})();
