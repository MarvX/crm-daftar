import ExcelJS from 'exceljs';
import jalaali from 'jalaali-js';

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنج شنبه', 'جمعه', 'شنبه'];

function timeStr(dateObj) {
  if (!dateObj) return '';
  return dateObj.toTimeString().slice(0, 5);
}

export default async function handler(req, res) {
  try {
    const jy = parseInt(req.query.jy);
    const jm = parseInt(req.query.jm); // 1-12 (ماه شمسی)

    if (!jy || !jm) {
      res.status(400).json({ error: 'سال و ماه شمسی لازم است' });
      return;
    }

    const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);

    // بازه کلی میلادی برای واکشی رکوردهای حضور (کمی حاشیه اطمینان)
    const firstG = jalaali.toGregorian(jy, jm, 1);
    const lastG = jalaali.toGregorian(jy, jm, daysInMonth);
    const rangeStart = new Date(Date.UTC(firstG.gy, firstG.gm - 1, firstG.gd));
    const rangeEnd = new Date(Date.UTC(lastG.gy, lastG.gm - 1, lastG.gd + 1));

    const profilesRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` }
    });
    const profiles = await profilesRes.json();
    if (!Array.isArray(profiles)) {
      res.status(500).json({ error: 'خواندن پروفایل‌ها ناموفق بود', details: profiles });
      return;
    }

    const attRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/attendance?check_in=gte.${rangeStart.toISOString()}&check_in=lt.${rangeEnd.toISOString()}&select=*&order=check_in.asc`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
    );
    const attendance = await attRes.json();
    if (!Array.isArray(attendance)) {
      res.status(500).json({ error: 'خواندن حضور و غیاب ناموفق بود', details: attendance });
      return;
    }

    const workbook = new ExcelJS.Workbook();

    for (const profile of profiles) {
      const records = attendance.filter(a => a.user_id === profile.id);
      const sheet = workbook.addWorksheet((profile.full_name || profile.id.slice(0, 8)).slice(0, 30));

      sheet.getCell('B3').value = `نام و نام خانوادگی: ${profile.full_name || ''}`;
      sheet.getRow(4).values = ['', 'روز', 'تاریخ', 'ساعت ورود', 'ساعت خروج', 'مجموع ساعت کار روزانه'];

      let rowIndex = 5;
      let weekTotalMinutes = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const g = jalaali.toGregorian(jy, jm, d);
        const dayDate = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
        const weekday = dayDate.getUTCDay(); // 0=یکشنبه ... 6=شنبه (جدول جاوااسکریپت: 0=Sunday)

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
          WEEKDAY_FA[weekday],
          `${jy}-${String(jm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          timeStr(checkIn),
          timeStr(checkOut),
          checkIn && checkOut ? `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}` : ''
        ];
        rowIndex++;
        weekTotalMinutes += minutes;

        // پایان هفته: جمعه (weekday === 5)
        if (weekday === 5 || d === daysInMonth) {
          sheet.getRow(rowIndex).values = ['', 'مجموع هفته', '', '', '', `${Math.floor(weekTotalMinutes/60)}:${String(weekTotalMinutes%60).padStart(2,'0')}`];
          rowIndex++;
          weekTotalMinutes = 0;
        }
      }

      sheet.views = [{ rightToLeft: true }];
      sheet.columns = [{width:3},{width:14},{width:14},{width:12},{width:12},{width:20}];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet-${jy}-${jm}.xlsx`);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: 'خطای داخلی', details: err.message });
  }
}
