/* Secure attendance QR client flow. Load this after app.js. */
(function () {
  const QR_TTL_MS = 90 * 1000;
  let qrTimer = null;

  async function issueAttendanceQr() {
    const result = await apiPost('/api/attendance-qr', { action: 'issue' });
    if (!result?.token) throw new Error('QR صادر نشد');
    return result;
  }

  window.openAttendanceQR = async function () {
    const root = document.getElementById('edit-modal-root');
    if (!root) return;
    root.innerHTML = '<div class="overlay"><div class="modal" style="text-align:center"><h3>📱 QR ورود و خروج دفتر</h3><p id="attendance-qr-status" style="font-size:12px;color:var(--muted)">در حال ساخت QR امن...</p><div id="attendance-qr" style="display:flex;justify-content:center;margin:16px"></div><div class="modal-actions"><button class="btn secondary" onclick="this.closest(\'.overlay\').remove()">بستن</button></div></div></div>';
    try {
      const issued = await issueAttendanceQr();
      const qr = document.getElementById('attendance-qr');
      if (!qr || !window.QRCode) throw new Error('QR library unavailable');
      new QRCode(qr, { text: location.origin + '/?attendance_qr=' + encodeURIComponent(issued.token), width: 240, height: 240 });
      const status = document.getElementById('attendance-qr-status');
      if (status) status.textContent = 'این QR تا ۹۰ ثانیه معتبر است و فقط یک‌بار استفاده می‌شود.';
      clearTimeout(qrTimer);
      qrTimer = setTimeout(() => {
        const s = document.getElementById('attendance-qr-status');
        if (s) s.textContent = 'این QR منقضی شد؛ پنجره را ببند و QR جدید بساز.';
        if (qr) qr.innerHTML = '';
      }, QR_TTL_MS);
    } catch (_) {
      const status = document.getElementById('attendance-qr-status');
      if (status) status.textContent = 'ساخت QR انجام نشد؛ دوباره تلاش کن.';
    }
  };

  window.consumeAttendanceQR = async function (token) {
    if (!token) return;
    const result = await apiPost('/api/attendance-qr', { action: 'consume', token });
    if (result?.status === 'ok') showToast(result.action + ' شما با QR امن ثبت شد ✅');
    else showToast(result?.error === 'expired_or_used' ? 'QR منقضی یا قبلاً استفاده شده است' : 'ثبت QR انجام نشد؛ دوباره تلاش کن');
  };
})();
