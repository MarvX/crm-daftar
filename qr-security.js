/* Secure attendance QR flow. Loaded after app.js. */
(() => {
  const TTL = 90_000;
  const PENDING_KEY = 'dast_pending_attendance_qr';
  let timer;

  async function issue() {
    const result = await apiPost('/api/attendance-qr', { action: 'issue' });
    if (!result?.token) throw new Error('QR صادر نشد');
    return result;
  }

  window.openAttendanceQR = async () => {
    const root = document.getElementById('edit-modal-root');
    if (!root) return;
    root.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeAttendanceQrModal()"><div class="modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-qr-title"><div class="qr-modal-head"><div><h3 id="attendance-qr-title">QR امن ورود و خروج</h3><p id="attendance-qr-status">در حال ساخت QR امن...</p></div><span class="qr-live-badge">۹۰ ثانیه</span></div><div id="attendance-qr" class="qr-code-box" aria-label="QR ورود و خروج"></div><p class="qr-modal-note">این QR پویاست و فقط یک‌بار قابل استفاده است. برای چاپ دائمی طراحی نشده؛ هنگام ورود یا خروج QR تازه بساز.</p><div class="modal-actions"><button class="btn secondary" onclick="closeAttendanceQrModal()">بستن</button></div></div></div>';
    try {
      const issued = await issue();
      const box = document.getElementById('attendance-qr');
      if (!box || !window.QRCode) throw new Error('QR library unavailable');
      new QRCode(box, { text: location.origin + '/?attendance_qr=' + encodeURIComponent(issued.token), width: 240, height: 240 });
      const status = document.getElementById('attendance-qr-status');
      if (status) status.textContent = 'QR آماده است؛ فقط تا ۹۰ ثانیه معتبر و فقط یک‌بار مصرف می‌شود.';
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!box.isConnected) return;
        box.innerHTML = '<div class="qr-expired">QR منقضی شد</div>';
        if (status) status.textContent = 'این QR دیگر معتبر نیست. برای ثبت، QR جدید بساز.';
      }, TTL);
    } catch (_) {
      const status = document.getElementById('attendance-qr-status');
      if (status) status.textContent = 'ساخت QR انجام نشد؛ دوباره تلاش کن.';
    }
  };

  window.closeAttendanceQrModal = () => {
    clearTimeout(timer);
    const root = document.getElementById('edit-modal-root');
    if (root) root.innerHTML = '';
  };

  window.consumeAttendanceQR = async (token) => {
    if (!token) return;
    const result = await apiPost('/api/attendance-qr', { action: 'consume', token });
    if (result?.status === 'ok') {
      showToast(`${result.action} شما با QR امن ثبت شد ✅`);
      try { await loadAttendanceStatus(); } catch (_) {}
    } else {
      showToast(result?.error === 'expired_or_used' ? 'QR منقضی یا قبلاً استفاده شده است' : 'ثبت QR انجام نشد؛ دوباره تلاش کن');
    }
  };

  window.tryPendingAttendanceQR = async () => {
    if (!currentUser) return;
    const token = sessionStorage.getItem(PENDING_KEY);
    if (!token) return;
    sessionStorage.removeItem(PENDING_KEY);
    await window.consumeAttendanceQR(token);
  };

  setTimeout(() => window.tryPendingAttendanceQR?.(), 350);
})();