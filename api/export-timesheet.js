import ExcelJS from 'exceljs';
import jalaali from 'jalaali-js';

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنج شنبه', 'جمعه', 'شنبه'];

function toJalaliStr(date) {
  const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
}

function timeStr(dateObj) {
  if (!dateObj) return '';
  return dateObj.toTimeString().slice(0, 5);
}

export default async function handler(req, res) {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month); // 1-12 (میلادی)

    if (!year || !month) {
      res.status(400).json({ error: 'سال و ماه لازم است' });
      return;
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const profilesRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` }
    });
    const profiles = await profilesRes.json();

    const attRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/attendance?check_in=gte.${start.toISOString()}&check_in=lt.${end.toISOString()}&select=*&order=check_in.asc`,
      { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );
    const attendance = await attRes.json();

    const workbook = new ExcelJS.Workbook();

    for (const profile of profiles) {
      const records = attendance.filter(a => a.user_id === profile.id);
      const sheet = workbook.addWorksheet(profile.full_name || profile.id.slice(0, 8));

      sheet.getCell('B3').value = `نام و نام خانوادگی: ${profile.full_name || ''}`;
      sheet.getRow(4).values = ['', 'روز', 'تاریخ', 'ساعت ورود', 'ساعت خروج', 'مجموع ساعت کار روزانه'];

      let rowIndex = 5;
      let weekTotalMinutes = 0;
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(Date.UTC(year, month - 1, d));
        const rec = records.find(r => {
          const ci = new Date(r.check_in);
          return ci.getUTCFullYear() === dayDate.getUTCFullYear() &&
                 ci.getUTCMonth() === dayDate.getUTCMonth() &&
                 ci.getUTCDate() === dayDate.getUTCDate();
        });

        const checkIn = rec ? new Date(rec.check_in) : null;
        const checkOut = rec && rec.check_out ? new Date(rec.check_out) : null;
        let minutes = 0;
        if (checkIn && checkOut) minutes = Math.round((checkOut - checkIn) / 60000);

        sheet.getRow(rowIndex).values = [
          '',
          WEEKDAY_FA[dayDate.getUTCDay()],
          toJalaliStr(dayDate),
          timeStr(checkIn),
          timeStr(checkOut),
          checkIn && checkOut ? `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}` : ''
        ];
        rowIndex++;
        weekTotalMinutes += minutes;

        if (dayDate.getUTCDay() === 5) { // پایان هفته (جمعه)
          sheet.getRow(rowIndex).values = ['', 'مجموع هفته', '', '', '', `${Math.floor(weekTotalMinutes/60)}:${String(weekTotalMinutes%60).padStart(2,'0')}`];
          rowIndex++;
          weekTotalMinutes = 0;
        }
      }
      if (weekTotalMinutes > 0) {
        sheet.getRow(rowIndex).values = ['', 'مجموع هفته', '', '', '', `${Math.floor(weekTotalMinutes/60)}:${String(weekTotalMinutes%60).padStart(2,'0')}`];
      }

      sheet.views = [{ rightToLeft: true }];
      sheet.columns = [{width:3},{width:14},{width:14},{width:12},{width:12},{width:20}];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet-${year}-${month}.xlsx`);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: 'خطای داخلی', details: err.message });
  }
}
