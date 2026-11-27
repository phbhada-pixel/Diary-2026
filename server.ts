import 'dotenv/config';
import express, { type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AppsScriptNotConfiguredError,
  createHoliday,
  createLeave,
  createSpecialEvent,
  createSubcenter,
  createVillage,
  createWeeklySchedule,
  DatabaseError,
  deleteHoliday,
  deleteLeave,
  deleteMonthlyDiary,
  deleteSpecialEvent,
  deleteSubcenter,
  deleteVillage,
  deleteWeeklySchedule,
  getAppsScriptStatusSummary,
  getBootstrapBundle,
  getEmployee,
  getMonthlyDiaryById,
  getSettings,
  listChangeHistory,
  listHolidays,
  listLeaves,
  listMonthlyDiaries,
  listSpecialEvents,
  listSubcenters,
  listVillages,
  listWeeklySchedules,
  restoreFullBackupToSheets,
  saveMonthlyDiary,
  updateEmployee,
  updateHoliday,
  updateLeave,
  updateSettings,
  updateSpecialEvent,
  updateSubcenter,
  updateVillage,
  updateWeeklySchedule,
  verifyAppsScriptConnection,
} from './src/server/appsScriptClient.ts';
import { computeDiarySummary, generateMonthlyDiary } from './src/shared/diaryEngine.ts';
import {
  calculateInclusiveDays,
  formatDateDDMMYYYY,
  getWeekdayLabel,
  getWeekOccurrenceLabel,
  makeMonthId,
} from './src/shared/marathi.ts';
import type { LeaveRecord, MonthlyDiaryEntry, WeekdayKey, WeekOccurrence } from './src/shared/types.ts';

function handleRouteError(res: Response, err: unknown, fallbackMessage: string) {
  if (err instanceof AppsScriptNotConfiguredError) {
    return res.status(err.status).json({
      error: err.message,
      missingVars: err.missingVars,
      notConfigured: true,
    });
  }
  if (err instanceof DatabaseError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.missingVars ? { missingVars: err.missingVars } : {}),
    });
  }
  const msg = err instanceof Error ? err.message : fallbackMessage;
  return res.status(500).json({ error: msg || fallbackMessage });
}

/**
 * Automatically updates ONLY the leave-impacted dates in already-saved monthly diaries
 * while keeping all other historical entries (including original vaccination / weekly schedules)
 * completely untouched in their original generated form.
 */
async function autoRefreshDiariesForDateRange(
  startDate: string,
  endDate: string,
  reasonSummary: string,
  newlyAddedLeave?: LeaveRecord
): Promise<string[]> {
  const updatedMonthIds: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return updatedMonthIds;

  const visited = new Set<string>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  let cachedLeaves: LeaveRecord[] | null = newlyAddedLeave ? [newlyAddedLeave] : null;
  let bundle: Awaited<ReturnType<typeof getBootstrapBundle>> | null = null;

  while (cursor <= lastMonth) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const monthId = makeMonthId(y, m);
    if (!visited.has(monthId)) {
      visited.add(monthId);
      const existing = await getMonthlyDiaryById(monthId);
      if (existing) {
        if (!cachedLeaves) {
          cachedLeaves = await listLeaves();
        }

        const findLeave = (isoDate: string) =>
          cachedLeaves!.find((lv) => isoDate >= lv.startDate && isoDate <= lv.endDate);

        // Compute fallback entries only if a previously marked leave date was cancelled
        let fallbackByDate: Map<string, MonthlyDiaryEntry> | null = null;
        let changed = false;

        const patchedEntries: MonthlyDiaryEntry[] = [];
        for (const entry of existing.entries) {
          // Never touch dates outside the modified leave range
          if (entry.date < startDate || entry.date > endDate) {
            patchedEntries.push(entry);
            continue;
          }
          // Preserve manual edits only; Leave is strictly final for all dates in leave range
          if (entry.isManualEdit) {
            patchedEntries.push(entry);
            continue;
          }

          const activeLeave = findLeave(entry.date);
          if (activeLeave) {
            const nextDesc = `रजा — ${activeLeave.leaveType}${activeLeave.reason ? ` (${activeLeave.reason})` : ''}`;
            if (
              entry.entryType !== 'leave' ||
              entry.sourceId !== activeLeave.id ||
              entry.workDescription !== nextDesc
            ) {
              changed = true;
              patchedEntries.push({
                ...entry,
                toPlace: 'रजा',
                workDescription: nextDesc,
                entryType: 'leave',
                originalDate: null,
                adjustedDate: null,
                sourceId: activeLeave.id,
                notes: activeLeave.notes || '',
              });
              continue;
            }
            patchedEntries.push(entry);
            continue;
          }

          // Leave was cancelled/shortened for this specific date: restore only this date
          if (entry.entryType === 'leave') {
            changed = true;
            if (!fallbackByDate) {
              if (!bundle) bundle = await getBootstrapBundle();
              const prevMonthId = makeMonthId(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
              const previousMonthDiary =
                bundle.monthlyDiaries.find((d) => d.id === prevMonthId) || null;
              const refDoc = generateMonthlyDiary({
                year: y,
                month: m,
                employee: bundle.employee,
                villages: bundle.villages,
                weeklySchedules: bundle.weeklySchedules,
                holidays: bundle.holidays.filter((h) => h.year === y),
                leaves: bundle.leaves,
                specialEvents: bundle.specialEvents,
                settings: bundle.settings,
                existingEntries: existing.entries,
                previousMonthDiary,
                preserveManualEdits: true,
              });
              fallbackByDate = new Map(refDoc.entries.map((e) => [e.date, e]));
            }
            patchedEntries.push(
              fallbackByDate.get(entry.date) || {
                ...entry,
                toPlace: bundle?.settings.officePlace || 'प्राथमिक आरोग्य केंद्र भादा',
                workDescription: 'कार्यालयीन कामकाज',
                entryType: 'office_work',
                sourceId: null,
                notes: '',
              }
            );
            continue;
          }

          patchedEntries.push(entry);
        }

        if (changed) {
          const updatedDoc = {
            ...existing,
            entries: patchedEntries,
            summary: computeDiarySummary(patchedEntries),
            hasManualEdits: patchedEntries.some((e) => e.isManualEdit),
            updatedAt: new Date().toISOString(),
          };
          await saveMonthlyDiary(updatedDoc, {
            action: 'RECALCULATE',
            summary: `${existing.monthLabelMarathi} दैनंदिनीतील फक्त रजा दिनांक अद्ययावत (${reasonSummary}) — मूळ वारनिहाय नोंदी सुरक्षित`,
            oldData: null,
            newData: JSON.stringify(updatedDoc.summary),
          });
          updatedMonthIds.push(monthId);
        }
      }
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return updatedMonthIds;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Ensure all /api/* responses are never cached by mobile browsers or proxies
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // --- Backend Configuration Status (always HTTP 200 JSON) ---
  app.get('/api/status', (_req, res) => {
    res.json(getAppsScriptStatusSummary());
  });

  // --- Backend Health & Live Google Apps Script + Google Sheets Read/Write Verification ---
  app.get('/api/health', async (_req, res) => {
    try {
      const report = await verifyAppsScriptConnection();
      res.json(report);
    } catch (err) {
      handleRouteError(res, err, 'Google Apps Script Server प्रतिसाद देत नाही.');
    }
  });

  // --- Bootstrap bundle (reads directly from Google Sheets) ---
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const bundle = await getBootstrapBundle();
      res.json(bundle);
    } catch (err) {
      handleRouteError(res, err, 'डेटा लोड करताना त्रुटी आली.');
    }
  });

  // --- 1. Employee_Master ---
  app.get('/api/employee', async (_req, res) => {
    try {
      res.json(await getEmployee());
    } catch (err) {
      handleRouteError(res, err, 'कर्मचारी माहिती वाचताना त्रुटी.');
    }
  });

  app.put('/api/employee', async (req, res) => {
    try {
      const { fullName, designation, officeName } = req.body;
      if (!fullName?.trim() || !designation?.trim() || !officeName?.trim()) {
        return res.status(400).json({ error: 'कर्मचाऱ्याचे नाव, पदनाम आणि कार्यालयाचे नाव आवश्यक आहे.' });
      }
      const updated = await updateEmployee(req.body);
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'कर्मचारी माहिती जतन करताना त्रुटी.');
    }
  });

  // --- 2. Subcenter_Master ---
  app.get('/api/subcenters', async (_req, res) => {
    try {
      res.json(await listSubcenters());
    } catch (err) {
      handleRouteError(res, err, 'उपकेंद्र यादी वाचताना त्रुटी.');
    }
  });

  app.post('/api/subcenters', async (req, res) => {
    try {
      const { name, location, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'उपकेंद्राचे नाव आवश्यक आहे.' });
      const created = await createSubcenter({ name, location: location || '', notes: notes || '' });
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'उपकेंद्र जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/subcenters/:id', async (req, res) => {
    try {
      const { name, location, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'उपकेंद्राचे नाव आवश्यक आहे.' });
      const updated = await updateSubcenter(req.params.id, {
        name,
        location: location || '',
        notes: notes || '',
      });
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'उपकेंद्र अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/subcenters/:id', async (req, res) => {
    try {
      await deleteSubcenter(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'उपकेंद्र हटवताना त्रुटी.');
    }
  });

  // --- 3. Village_Master ---
  app.get('/api/villages', async (_req, res) => {
    try {
      res.json(await listVillages());
    } catch (err) {
      handleRouteError(res, err, 'गावांची यादी वाचताना त्रुटी.');
    }
  });

  app.post('/api/villages', async (req, res) => {
    try {
      const { name, subcenterId, subcenterName, population, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'गावाचे नाव आवश्यक आहे.' });
      const created = await createVillage({
        name,
        subcenterId: subcenterId || '',
        subcenterName: subcenterName || '',
        population: population || '',
        notes: notes || '',
      });
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'गाव जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/villages/:id', async (req, res) => {
    try {
      const { name, subcenterId, subcenterName, population, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'गावाचे नाव आवश्यक आहे.' });
      const updated = await updateVillage(req.params.id, {
        name,
        subcenterId: subcenterId || '',
        subcenterName: subcenterName || '',
        population: population || '',
        notes: notes || '',
      });
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'गाव अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/villages/:id', async (req, res) => {
    try {
      await deleteVillage(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'गाव हटवताना त्रुटी.');
    }
  });

  // --- 4. Weekly_Schedule_Master ---
  app.get('/api/weekly-schedule', async (_req, res) => {
    try {
      res.json(await listWeeklySchedules());
    } catch (err) {
      handleRouteError(res, err, 'वारनिहाय कार्यक्रम वाचताना त्रुटी.');
    }
  });

  app.post('/api/weekly-schedule', async (req, res) => {
    try {
      const { weekday, weekNumber, villageId, villageName, subcenterName, sessionType, notes } = req.body;
      const validWeekdays: WeekdayKey[] = ['monday', 'tuesday', 'thursday', 'friday', 'saturday'];
      if (!validWeekdays.includes(weekday)) {
        return res.status(400).json({
          error: 'कृपया सोमवार, मंगळवार, गुरुवार, शुक्रवार किंवा शनिवार निवडा (बुधवार मुख्यालयाच्या बैठकीसाठी राखीव आहे).',
        });
      }
      const wkNum = Number(weekNumber) as WeekOccurrence;
      if (![1, 2, 3, 4, 5].includes(wkNum)) {
        return res.status(400).json({ error: 'आठवड्याचा क्रमांक १ ते ५ दरम्यान असावा.' });
      }
      if (!villageName?.trim() || !sessionType?.trim()) {
        return res.status(400).json({ error: 'गावाचे नाव आणि आरोग्य सेवा सत्राचे स्वरूप आवश्यक आहे.' });
      }

      const summary = `वारनिहाय कार्यक्रम जोडला: ${getWeekOccurrenceLabel(wkNum)} ${getWeekdayLabel(weekday)} — ${villageName.trim()}`;
      const created = await createWeeklySchedule(
        {
          weekday,
          weekNumber: wkNum,
          villageId: villageId || '',
          villageName,
          subcenterName: subcenterName || '',
          sessionType,
          notes: notes || '',
        },
        summary
      );
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'वारनिहाय कार्यक्रम जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/weekly-schedule/:id', async (req, res) => {
    try {
      const { weekday, weekNumber, villageId, villageName, subcenterName, sessionType, notes } = req.body;
      const wkNum = Number(weekNumber) as WeekOccurrence;
      if (!villageName?.trim() || !sessionType?.trim()) {
        return res.status(400).json({ error: 'गावाचे नाव आणि आरोग्य सेवा सत्राचे स्वरूप आवश्यक आहे.' });
      }
      const updated = await updateWeeklySchedule(
        req.params.id,
        {
          weekday,
          weekNumber: wkNum,
          villageId: villageId || '',
          villageName,
          subcenterName: subcenterName || '',
          sessionType,
          notes: notes || '',
        },
        `वारनिहाय कार्यक्रम बदलला: ${getWeekOccurrenceLabel(wkNum)} ${getWeekdayLabel(weekday)} — ${villageName.trim()}`
      );
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'वारनिहाय कार्यक्रम अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/weekly-schedule/:id', async (req, res) => {
    try {
      await deleteWeeklySchedule(
        req.params.id,
        `वारनिहाय कार्यक्रम हटवला (${req.params.id})`
      );
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'हटवताना त्रुटी.');
    }
  });

  // --- 5. Government_Holiday_Master ---
  app.get('/api/holidays', async (req, res) => {
    try {
      const yearParam = req.query.year ? Number(req.query.year) : undefined;
      res.json(await listHolidays(yearParam));
    } catch (err) {
      handleRouteError(res, err, 'शासकीय सुट्ट्या वाचताना त्रुटी.');
    }
  });

  app.post('/api/holidays', async (req, res) => {
    try {
      const { date, name, holidayType, year, notes } = req.body;
      if (!date || !name?.trim()) {
        return res.status(400).json({ error: 'सुट्टीची तारीख आणि सुट्टीचे नाव आवश्यक आहे.' });
      }
      const parsedYear = Number(date.slice(0, 4));
      if (year && Number(year) !== parsedYear) {
        return res
          .status(400)
          .json({ error: `निवडलेली तारीख (${formatDateDDMMYYYY(date)}) ही वर्ष ${year} मधील नाही.` });
      }
      const created = await createHoliday(
        { date, name, holidayType: holidayType || 'सार्वजनिक सुट्टी', year: parsedYear, notes: notes || '' },
        `शासकीय सुट्टी जोडली (${parsedYear}): ${formatDateDDMMYYYY(date)} — ${name.trim()}`
      );
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'शासकीय सुट्टी जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/holidays/:id', async (req, res) => {
    try {
      const { date, name, holidayType, notes } = req.body;
      if (!date || !name?.trim()) {
        return res.status(400).json({ error: 'सुट्टीची तारीख आणि नाव आवश्यक आहे.' });
      }
      const updated = await updateHoliday(
        req.params.id,
        { date, name, holidayType: holidayType || 'सार्वजनिक सुट्टी', notes: notes || '' },
        `शासकीय सुट्टी बदलली: ${formatDateDDMMYYYY(date)} — ${name.trim()}`
      );
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'सुट्टी अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/holidays/:id', async (req, res) => {
    try {
      await deleteHoliday(req.params.id, `शासकीय सुट्टी हटवली (${req.params.id})`);
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'सुट्टी हटवताना त्रुटी.');
    }
  });

  // --- 6. Leave_Management ---
  app.get('/api/leaves', async (_req, res) => {
    try {
      res.json(await listLeaves());
    } catch (err) {
      handleRouteError(res, err, 'रजा नोंदवही वाचताना त्रुटी.');
    }
  });

  app.post('/api/leaves', async (req, res) => {
    try {
      const { leaveType, startDate, endDate, reason, notes } = req.body;
      if (!leaveType?.trim() || !startDate || !endDate) {
        return res.status(400).json({ error: 'रजेचा प्रकार, सुरुवातीचा दिनांक आणि समाप्तीचा दिनांक आवश्यक आहे.' });
      }
      if (endDate < startDate) {
        return res.status(400).json({ error: 'समाप्तीचा दिनांक सुरुवातीच्या दिनांकापेक्षा आधीचा असू शकत नाही.' });
      }
      const totalDays = calculateInclusiveDays(startDate, endDate);
      const created = await createLeave(
        {
          leaveType: leaveType.trim(),
          startDate,
          endDate,
          totalDays,
          reason: (reason || '').trim(),
          notes: (notes || '').trim(),
        },
        `रजा नोंदवली: ${formatDateDDMMYYYY(startDate)} ते ${formatDateDDMMYYYY(endDate)} (${totalDays} दिवस — ${leaveType.trim()})`
      );

      // Fast-patch any affected saved monthly diaries without an extra getBootstrapBundle() round-trip
      let updatedMonths: string[] = [];
      try {
        updatedMonths = await autoRefreshDiariesForDateRange(startDate, endDate, 'रजा नोंद', created);
      } catch (refreshErr) {
        console.warn('Leave saved, but secondary diary refresh skipped:', refreshErr);
      }
      res.status(201).json({ record: created, updatedMonths });
    } catch (err) {
      handleRouteError(res, err, 'रजा जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/leaves/:id', async (req, res) => {
    try {
      const { leaveType, startDate, endDate, reason, notes } = req.body;
      if (!leaveType?.trim() || !startDate || !endDate || endDate < startDate) {
        return res.status(400).json({ error: 'कृपया वैध रजेचे दिनांक व प्रकार भरा.' });
      }
      const totalDays = calculateInclusiveDays(startDate, endDate);
      const { prev, updated } = await updateLeave(
        req.params.id,
        {
          leaveType: leaveType.trim(),
          startDate,
          endDate,
          totalDays,
          reason: (reason || '').trim(),
          notes: (notes || '').trim(),
        },
        `रजा अद्ययावत: ${formatDateDDMMYYYY(startDate)} ते ${formatDateDDMMYYYY(endDate)} (${totalDays} दिवस)`
      );

      const rangeStart = prev.startDate < startDate ? prev.startDate : startDate;
      const rangeEnd = prev.endDate > endDate ? prev.endDate : endDate;
      let updatedMonths: string[] = [];
      try {
        updatedMonths = await autoRefreshDiariesForDateRange(rangeStart, rangeEnd, 'रजा बदल');
      } catch (refreshErr) {
        console.warn('Leave updated, but secondary diary refresh skipped:', refreshErr);
      }
      res.json({ record: updated, updatedMonths });
    } catch (err) {
      handleRouteError(res, err, 'रजा अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/leaves/:id', async (req, res) => {
    try {
      const prev = await deleteLeave(req.params.id, `रजा हटवली (${req.params.id})`);
      let updatedMonths: string[] = [];
      try {
        updatedMonths = await autoRefreshDiariesForDateRange(prev.startDate, prev.endDate, 'रजा रद्द');
      } catch (refreshErr) {
        console.warn('Leave deleted, but secondary diary refresh skipped:', refreshErr);
      }
      res.json({ deleted: true, updatedMonths });
    } catch (err) {
      handleRouteError(res, err, 'रजा हटवताना त्रुटी.');
    }
  });

  // --- 7. Special_Event_Master ---
  app.get('/api/special-events', async (_req, res) => {
    try {
      res.json(await listSpecialEvents());
    } catch (err) {
      handleRouteError(res, err, 'विशेष कार्यक्रम वाचताना त्रुटी.');
    }
  });

  app.post('/api/special-events', async (req, res) => {
    try {
      const { date, eventType, location, workDescription, notes } = req.body;
      if (!date || !location?.trim() || !workDescription?.trim()) {
        return res.status(400).json({ error: 'दिनांक, कोठे आणि कामाचे स्वरूप आवश्यक आहे.' });
      }
      const isMeetingRule = typeof date === 'string' && date.startsWith('MEETING_RULE_');
      const isWorkLog = typeof date === 'string' && date.startsWith('WORK_LOG_');
      const workLogIso = isWorkLog
        ? String(date).slice('WORK_LOG_'.length).split('__')[0].slice(0, 10)
        : '';
      const label = eventType || 'इतर विशेष शासकीय कार्यक्रम';
      const historySummary = isWorkLog
        ? `सविस्तर कामाचा वृत्तांत जोडला: दि. ${formatDateDDMMYYYY(workLogIso)} — ${location.trim()}`
        : isMeetingRule
        ? `${label} जोडली (सेटिंग्ज): ${location.trim()} — ${workDescription.trim()}`
        : `विशेष कार्यक्रम जोडला: ${formatDateDDMMYYYY(date)} — ${location.trim()}`;
      const created = await createSpecialEvent(
        {
          date,
          eventType: label,
          location,
          workDescription,
          notes: notes || '',
        },
        historySummary
      );
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'विशेष कार्यक्रम जतन करताना त्रुटी आली.');
    }
  });

  app.put('/api/special-events/:id', async (req, res) => {
    try {
      const { date, eventType, location, workDescription, notes } = req.body;
      if (!date || !location?.trim() || !workDescription?.trim()) {
        return res.status(400).json({ error: 'दिनांक, कोठे आणि कामाचे स्वरूप आवश्यक आहे.' });
      }
      const isMeetingRule = typeof date === 'string' && date.startsWith('MEETING_RULE_');
      const isWorkLog = typeof date === 'string' && date.startsWith('WORK_LOG_');
      const workLogIso = isWorkLog
        ? String(date).slice('WORK_LOG_'.length).split('__')[0].slice(0, 10)
        : '';
      const label = eventType || 'इतर विशेष शासकीय कार्यक्रम';
      const historySummary = isWorkLog
        ? `सविस्तर कामाचा वृत्तांत अद्ययावत केला: दि. ${formatDateDDMMYYYY(workLogIso)} — ${location.trim()}`
        : isMeetingRule
        ? `${label} बदलली (सेटिंग्ज): ${location.trim()} — ${workDescription.trim()}`
        : `विशेष कार्यक्रम बदलला: ${formatDateDDMMYYYY(date)} — ${location.trim()}`;
      const updated = await updateSpecialEvent(
        req.params.id,
        {
          date,
          eventType: label,
          location,
          workDescription,
          notes: notes || '',
        },
        historySummary
      );
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'विशेष कार्यक्रम अपडेट करताना त्रुटी.');
    }
  });

  app.delete('/api/special-events/:id', async (req, res) => {
    try {
      await deleteSpecialEvent(req.params.id, `विशेष कार्यक्रम हटवला (${req.params.id})`);
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'विशेष कार्यक्रम हटवताना त्रुटी.');
    }
  });

  // --- 8. Monthly_Diary (Stored directly in Monthly_Diary + individual month tabs like April_2026) ---
  app.get('/api/diaries', async (_req, res) => {
    try {
      res.json(await listMonthlyDiaries());
    } catch (err) {
      handleRouteError(res, err, 'मासिक दैनंदिन्या वाचताना त्रुटी.');
    }
  });

  app.get('/api/diaries/:id', async (req, res) => {
    try {
      const doc = await getMonthlyDiaryById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'या महिन्याची दैनंदिनी अद्याप तयार केलेली नाही.' });
      res.json(doc);
    } catch (err) {
      handleRouteError(res, err, 'दैनंदिनी वाचताना त्रुटी.');
    }
  });

  app.post('/api/diaries/generate', async (req, res) => {
    try {
      const year = Number(req.body.year);
      const month = Number(req.body.month);
      const preserveManualEdits = req.body.preserveManualEdits !== false;
      const confirmedOverwrite = Boolean(req.body.confirmedOverwrite);

      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({ error: 'वैध वर्ष आणि महिना निवडा.' });
      }

      const monthId = makeMonthId(year, month);
      const existing = await getMonthlyDiaryById(monthId);

      if (existing && !confirmedOverwrite) {
        return res.status(409).json({
          requiresConfirmation: true,
          hasManualEdits: existing.hasManualEdits,
          error: `${existing.monthLabelMarathi} ची दैनंदिनी आधीच सेव्ह आहे. पुन्हा तयार (Recalculate) करण्यासाठी संमती आवश्यक आहे.`,
        });
      }

      const bundle = await getBootstrapBundle();
      const prevMonthId = makeMonthId(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
      const previousMonthDiary =
        bundle.monthlyDiaries.find((d) => d.id === prevMonthId) || null;
      const generated = generateMonthlyDiary({
        year,
        month,
        employee: bundle.employee,
        villages: bundle.villages,
        weeklySchedules: bundle.weeklySchedules,
        holidays: bundle.holidays.filter((h) => h.year === year),
        leaves: bundle.leaves,
        specialEvents: bundle.specialEvents,
        settings: bundle.settings,
        existingEntries: existing ? existing.entries : [],
        previousMonthDiary,
        preserveManualEdits,
      });

      if (existing) {
        generated.createdAt = existing.createdAt;
      }

      // Synchronously confirm write to Google Sheets before returning to client
      await saveMonthlyDiary(generated, {
        action: existing ? 'RECALCULATE' : 'GENERATE',
        summary: existing
          ? `${generated.monthLabelMarathi} दैनंदिनी पुन्हा अद्ययावत केली (${preserveManualEdits ? 'मॅन्युअल बदल सुरक्षित' : 'पूर्ण नव्याने तयार'})`
          : `${generated.monthLabelMarathi} ची नवीन दौरा दैनंदिनी स्वयंचलित तयार केली`,
        oldData: existing ? JSON.stringify(existing.summary) : null,
        newData: JSON.stringify(generated.summary),
      });

      res.json(generated);
    } catch (err) {
      handleRouteError(res, err, 'दैनंदिनी तयार करताना त्रुटी आली.');
    }
  });

  app.put('/api/diaries/:id/entry/:date', async (req, res) => {
    try {
      const { id, date } = req.params;
      const existing = await getMonthlyDiaryById(id);
      if (!existing) return res.status(404).json({ error: 'दैनंदिनी आढळली नाही.' });

      const { fromPlace, toPlace, workDescription, notes, isManualEdit, entryType } = req.body;
      if (!toPlace?.trim() || !workDescription?.trim()) {
        return res.status(400).json({ error: 'कोठे आणि कामाचे स्वरूप आवश्यक आहे.' });
      }

      const idx = existing.entries.findIndex((e) => e.date === date);
      if (idx === -1) return res.status(404).json({ error: 'संबंधित दिनांक दैनंदिनीत आढळला नाही.' });

      const oldEntry = existing.entries[idx];
      const updatedEntry: MonthlyDiaryEntry = {
        ...oldEntry,
        fromPlace: (fromPlace || existing.entries[idx].fromPlace || 'भादा').trim(),
        toPlace: toPlace.trim(),
        workDescription: workDescription.trim(),
        notes: (notes ?? oldEntry.notes ?? '').trim(),
        entryType: entryType || oldEntry.entryType,
        isManualEdit: isManualEdit !== false,
      };

      const updatedEntries = [...existing.entries];
      updatedEntries[idx] = updatedEntry;

      const updatedDoc = {
        ...existing,
        entries: updatedEntries,
        summary: computeDiarySummary(updatedEntries),
        hasManualEdits: updatedEntries.some((e) => e.isManualEdit),
        updatedAt: new Date().toISOString(),
      };

      await saveMonthlyDiary(updatedDoc, {
        action: 'MANUAL_EDIT',
        summary: `${existing.monthLabelMarathi} — दि. ${formatDateDDMMYYYY(date)} मॅन्युअल बदल: ${updatedEntry.toPlace}`,
        oldData: JSON.stringify(oldEntry),
        newData: JSON.stringify(updatedEntry),
      });

      res.json(updatedDoc);
    } catch (err) {
      handleRouteError(res, err, 'नोंद संपादित करताना त्रुटी.');
    }
  });

  app.delete('/api/diaries/:id', async (req, res) => {
    try {
      await deleteMonthlyDiary(req.params.id);
      res.json({ deleted: true });
    } catch (err) {
      handleRouteError(res, err, 'दैनंदिनी हटवताना त्रुटी.');
    }
  });

  // --- 9. Diary_Change_History ---
  app.get('/api/history', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      res.json(await listChangeHistory(limit));
    } catch (err) {
      handleRouteError(res, err, 'बदल इतिहास वाचताना त्रुटी.');
    }
  });

  // --- 10. Application_Settings ---
  app.get('/api/settings', async (_req, res) => {
    try {
      res.json(await getSettings());
    } catch (err) {
      handleRouteError(res, err, 'सेटिंग्ज वाचताना त्रुटी.');
    }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const updated = await updateSettings(req.body);
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'सेटिंग्ज जतन करताना त्रुटी.');
    }
  });

  // --- Database JSON Backup & Restore (directly from/to Google Sheets) ---
  app.get('/api/backup', async (_req, res) => {
    try {
      const bundle = await getBootstrapBundle();
      res.json({
        exportedAt: new Date().toISOString(),
        application: 'मासिक दौरा दैनंदिनी व्यवस्थापन प्रणाली — प्राथमिक आरोग्य केंद्र भादा',
        data: {
          Employee_Master: bundle.employee,
          Application_Settings: bundle.settings,
          Subcenter_Master: bundle.subcenters,
          Village_Master: bundle.villages,
          Weekly_Schedule_Master: bundle.weeklySchedules,
          Government_Holiday_Master: bundle.holidays,
          Leave_Management: bundle.leaves,
          Special_Event_Master: bundle.specialEvents,
          Monthly_Diary: bundle.monthlyDiaries,
          Diary_Change_History: bundle.changeHistory,
        },
      });
    } catch (err) {
      handleRouteError(res, err, 'बॅकअप तयार करताना त्रुटी.');
    }
  });

  app.post('/api/restore', async (req, res) => {
    try {
      const payload = req.body?.data;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'अवैध बॅकअप फाईल स्वरूप.' });
      }
      await restoreFullBackupToSheets(payload);
      res.json({ restored: true });
    } catch (err) {
      handleRouteError(res, err, 'बॅकअप रिस्टोअर करताना त्रुटी.');
    }
  });

  // Guard: never let unknown /api/* requests fall through to Vite HTML SPA fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'विनंती केलेला API मार्ग सर्व्हरवर आढळला नाही.' });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `PHC Bhada Monthly Tour Diary Server (Google Apps Script + Google Sheets DB) running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
