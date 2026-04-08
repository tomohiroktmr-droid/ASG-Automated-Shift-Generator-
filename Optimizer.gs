/**
 * =====================================================
 * Optimizer.gs — AIシフト最適化エンジン
 * =====================================================
 * ビジネスルール:
 *   1. 火曜は定休日（全員）
 *   2. 社長・店長は週1日休み（異なる日）
 *   3. 月に1回、最多出勤週に社長・店長が同じ日に休む（合同定休）
 *      → その日は他のスタッフ5人以上の出勤を確保
 *   4. 毎日1人が仕込みシフト（15:00〜21:00）を担当
 *      優先順位: キッチンA → キッチンB → スタッフ → 店長 → 社長
 *   5. 土日祝でキッチンA・B両方が出勤する場合、社長は昼シフト免除
 *   6. 出勤人数が必要人数（通常3、合同定休日5）を下回る場合は警告
 * =====================================================
 */

// ---- 定数 ----
var SHEET_PROPOSAL  = 'シフト提案';
var ROLE_PRESIDENT  = '社長';
var ROLE_MANAGER    = '店長';
var ROLE_KITCHEN_A  = 'キッチンA';
var ROLE_KITCHEN_B  = 'キッチンB';
var HOLIDAY_CAL_ID  = 'ja.japanese#holiday@group.v.calendar.google.com';
var PREP_START_H    = 15;   // 仕込み開始時刻（時）
var PREP_END_H      = 21;   // 仕込み終了時刻（時）
var LUNCH_START_H   = 12;   // 昼シフト開始（時）
var LUNCH_END_H     = 16;   // 昼シフト終了（時）

// セル背景色
var COLOR_CLOSED    = '#b7b7b7';  // 定休日（灰）
var COLOR_DAYOFF    = '#fce8b2';  // 休み（薄橙）
var COLOR_PREP      = '#fff2cc';  // 仕込み担当（薄黄）
var COLOR_JOINT     = '#f4cccc';  // 合同定休（薄赤）
var COLOR_DUTY      = '#d9ead3';  // 通常出勤（薄緑）
var COLOR_LUNCHFREE = '#cfe2f3';  // 社長昼免除（薄青）
var COLOR_HEADER    = '#4a86e8';  // ヘッダー（青）

// 役職の表示順（列の並び順）
var ROLE_ORDER = [ROLE_PRESIDENT, ROLE_MANAGER, ROLE_KITCHEN_A, ROLE_KITCHEN_B, 'スタッフ'];

// =====================================================
// エントリポイント: メニューから呼び出される
// =====================================================
function runOptimizer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // 1. 期間取得
  var period = getDatePeriod(ss);
  if (!period) {
    ui.alert('⚠ 設定エラー', '「設定」シートのB1に開始日、B2に終了日を入力してください。', ui.ButtonSet.OK);
    return;
  }

  // 2. スタッフ一覧取得（役職付き）
  var staffList = getStaffList(ss);
  if (staffList.length === 0) {
    ui.alert('⚠ スタッフ未登録', '「スタッフ管理」シートにスタッフを登録してください。', ui.ButtonSet.OK);
    return;
  }

  // 3. シフト集計シートのデータ取得
  var outputSheet = ss.getSheetByName(SHEET_OUTPUT);
  var shiftRows = [];
  if (outputSheet && outputSheet.getLastRow() > 1) {
    shiftRows = outputSheet.getRange(2, 1, outputSheet.getLastRow() - 1, 5).getValues();
  }

  if (shiftRows.length === 0) {
    var resp = ui.alert(
      '⚠ シフトデータなし',
      '「シフト集計」シートにデータがありません。\n先に「シフトを集計する」を実行することをお勧めします。\n\nこのまま空の提案を作成しますか？',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
  }

  // 4. 提案を生成
  var proposal = buildOptimizedProposal(period, staffList, shiftRows);

  // 5. シートに書き出し
  writeProposalSheet(ss, staffList, proposal, period);

  ui.alert('✅ 完了', 'シフト提案シートを作成しました。\n「' + SHEET_PROPOSAL + '」シートをご確認ください。', ui.ButtonSet.OK);
}

// =====================================================
// コアロジック: 最適化された提案辞書を生成する
// @return { dateStr: DayProposal }
// =====================================================
function buildOptimizedProposal(period, staffList, shiftRows) {
  // 祝日セット取得
  var holidaySet = getHolidayDates(period.startDate, period.endDate);

  // 出勤可能マップ構築
  var availMap = buildAvailabilityMap(shiftRows);

  // 期間内の全日付リスト生成
  var allDates = [];
  var cur = new Date(period.startDate);
  cur.setHours(0, 0, 0, 0);
  var endDay = new Date(period.endDate);
  endDay.setHours(0, 0, 0, 0);
  while (cur <= endDay) {
    allDates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // 休み割り当て計画
  var dayOffPlan = planWeeklyDaysOff(allDates, staffList, availMap, holidaySet);

  // 各日の提案を生成
  var proposal = {};
  allDates.forEach(function(date) {
    var dateStr  = formatDateStr(date);
    var dow      = date.getDay(); // 0=日,1=月,...,6=土
    var dayLabel = ['日','月','火','水','木','金','土'][dow];
    var isClosed = (dow === 2); // 火曜定休

    var isJoint  = (dayOffPlan.jointDate === dateStr);
    var isWeekendOrHoliday = (dow === 0 || dow === 6 || holidaySet.has(dateStr));

    var requiredCount = isJoint ? 5 : 3;

    var assignments = {};
    staffList.forEach(function(s) {
      assignments[s.name] = {
        status: 'no-request',
        start: '',
        end: '',
        isPrep: false,
        lunchExempt: false
      };
    });

    var note = '';

    if (isClosed) {
      // 全員定休
      staffList.forEach(function(s) { assignments[s.name].status = 'closed'; });
      proposal[dateStr] = {
        dateStr: dateStr, dayLabel: dayLabel,
        isClosed: true, isWeekendOrHoliday: isWeekendOrHoliday,
        isJointDayOff: false, note: '', requiredCount: 0, assignments: assignments
      };
      return;
    }

    // 社長・店長の休み設定
    staffList.forEach(function(s) {
      if (s.role === ROLE_PRESIDENT && dayOffPlan.presidentOff.has(dateStr)) {
        assignments[s.name].status = isJoint ? 'off-joint' : 'off';
      } else if (s.role === ROLE_MANAGER && dayOffPlan.managerOff.has(dateStr)) {
        assignments[s.name].status = isJoint ? 'off-joint' : 'off';
      }
    });

    // 出勤可能スタッフの設定
    var available = availMap[dateStr] || [];
    available.forEach(function(entry) {
      var a = assignments[entry.name];
      if (!a) return;
      if (a.status === 'off' || a.status === 'off-joint') return; // 休みは優先
      a.status = 'duty';
      a.start  = entry.start;
      a.end    = entry.end;
    });

    // 仕込み担当の決定
    var dutyStaff = staffList.filter(function(s) {
      return assignments[s.name].status === 'duty';
    });
    var prepWorker = assignPrepWorker(dutyStaff, available);
    if (prepWorker) {
      assignments[prepWorker].isPrep = true;
      assignments[prepWorker].start  = PREP_START_H + ':00';
      assignments[prepWorker].end    = PREP_END_H   + ':00';
    }

    // 土日祝 + キッチンA・B 両方出勤 → 社長昼免除
    if (isWeekendOrHoliday) {
      var hasKA = dutyStaff.some(function(s) { return s.role === ROLE_KITCHEN_A; });
      var hasKB = dutyStaff.some(function(s) { return s.role === ROLE_KITCHEN_B; });
      if (hasKA && hasKB) {
        staffList.forEach(function(s) {
          if (s.role === ROLE_PRESIDENT && assignments[s.name].status === 'duty') {
            assignments[s.name].lunchExempt = true;
          }
        });
      }
    }

    // 備考
    if (isJoint) note += '★合同定休 5人体制';
    var dutyCount = dutyStaff.length;
    if (dutyCount < requiredCount) {
      note += (note ? ' ' : '') + '⚠ 人手不足（' + dutyCount + '/' + requiredCount + '人）';
    }

    proposal[dateStr] = {
      dateStr: dateStr, dayLabel: dayLabel,
      isClosed: false, isWeekendOrHoliday: isWeekendOrHoliday,
      isJointDayOff: isJoint, note: note, requiredCount: requiredCount,
      assignments: assignments
    };
  });

  return proposal;
}

// =====================================================
// 仕込み担当の決定
// 優先順位: キッチンA → キッチンB → スタッフ → 店長 → 社長
// @return staffName | null
// =====================================================
function assignPrepWorker(dutyStaff, available) {
  // 仕込み候補: 15:00以降のシフト or 終日
  var candidates = dutyStaff.filter(function(s) {
    var entry = available.filter(function(a) { return a.name === s.name; })[0];
    if (!entry) return false;
    if (entry.start === '終日') return true;
    var h = parseInt(entry.start.split(':')[0], 10);
    return h <= PREP_START_H; // 15:00以前に開始するシフトが必要
  });

  var priority = [ROLE_KITCHEN_A, ROLE_KITCHEN_B, 'スタッフ', ROLE_MANAGER, ROLE_PRESIDENT];
  for (var i = 0; i < priority.length; i++) {
    var found = candidates.filter(function(s) { return s.role === priority[i]; });
    if (found.length > 0) return found[0].name;
  }
  // 候補なしの場合は duty スタッフ先頭
  if (dutyStaff.length > 0) return dutyStaff[0].name;
  return null;
}

// =====================================================
// 休み割り当て計画
// @return { presidentOff: Set, managerOff: Set, jointDate: string|null }
// =====================================================
function planWeeklyDaysOff(allDates, staffList, availMap, holidaySet) {
  var presidentOff = new Set();
  var managerOff   = new Set();
  var jointDate    = null;

  if (allDates.length === 0) return { presidentOff: presidentOff, managerOff: managerOff, jointDate: null };

  // 平日（火曜=2 除く）かつ休祝日でない日を候補とするヘルパー
  function isWeekday(date) {
    var dow = date.getDay();
    var ds  = formatDateStr(date);
    return dow !== 0 && dow !== 2 && dow !== 6 && !holidaySet.has(ds);
  }

  // 全日付をISO週（月曜始まり）でグループ化
  var weeks = {};
  allDates.forEach(function(date) {
    var key = getIsoWeekKey(date);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(date);
  });

  var weekKeys = Object.keys(weeks).sort();

  // 合同定休週: 平日の出勤可能人数合計が最多の週
  var maxSum = -1;
  var jointWeekKey = null;

  weekKeys.forEach(function(wk) {
    var sum = 0;
    weeks[wk].forEach(function(date) {
      if (isWeekday(date)) {
        var ds = formatDateStr(date);
        sum += (availMap[ds] || []).length;
      }
    });
    if (sum > maxSum) { maxSum = sum; jointWeekKey = wk; }
  });

  // 合同定休週の平日で5人以上出勤可能な日を選択
  if (jointWeekKey) {
    var jointWeekDates = weeks[jointWeekKey].filter(isWeekday).sort(function(a, b) {
      return (availMap[formatDateStr(b)] || []).length - (availMap[formatDateStr(a)] || []).length;
    });

    var fiveOrMore = jointWeekDates.filter(function(d) {
      return (availMap[formatDateStr(d)] || []).length >= 5;
    });

    var jointCandidate = fiveOrMore.length > 0 ? fiveOrMore[0] : jointWeekDates[0];
    if (jointCandidate) {
      jointDate = formatDateStr(jointCandidate);
      presidentOff.add(jointDate);
      managerOff.add(jointDate);
    }
  }

  // 各週で社長・店長の個別休みを割り当て
  weekKeys.forEach(function(wk) {
    var weekdays = weeks[wk].filter(isWeekday).sort(function(a, b) {
      return (availMap[formatDateStr(b)] || []).length - (availMap[formatDateStr(a)] || []).length;
    });

    // 合同定休週はすでに設定済みなのでスキップ
    if (wk === jointWeekKey) return;

    // 社長の休み: 他の出勤者が最多の平日
    var presDate = weekdays[0];
    if (presDate) presidentOff.add(formatDateStr(presDate));

    // 店長の休み: 社長と異なる平日
    var mgrDate = weekdays.filter(function(d) {
      return formatDateStr(d) !== (presDate ? formatDateStr(presDate) : '');
    })[0] || weekdays[1];
    if (mgrDate) managerOff.add(formatDateStr(mgrDate));
  });

  return { presidentOff: presidentOff, managerOff: managerOff, jointDate: jointDate };
}

// =====================================================
// 祝日Setを取得する
// @return Set<string> — 'yyyy/MM/dd' 形式
// =====================================================
function getHolidayDates(startDate, endDate) {
  var s = new Set();
  try {
    var cal = CalendarApp.getCalendarById(HOLIDAY_CAL_ID);
    if (!cal) return s;
    cal.getEvents(startDate, endDate).forEach(function(ev) {
      s.add(Utilities.formatDate(ev.getStartTime(), TIMEZONE, 'yyyy/MM/dd'));
    });
  } catch (e) {
    Logger.log('祝日カレンダー取得エラー: ' + e.message);
  }
  return s;
}

// =====================================================
// シフト集計シートの行データを日付別マップに変換する
// @param rows [[name, dateStr, start, end, title], ...]
// @return { dateStr: [{name, start, end}] }
// =====================================================
function buildAvailabilityMap(rows) {
  var map = {};
  rows.forEach(function(row) {
    var name    = String(row[0]).trim();
    var dateStr = String(row[1]).trim();
    var start   = String(row[2]).trim();
    var end     = String(row[3]).trim();
    if (!name || !dateStr) return;
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push({ name: name, start: start, end: end });
  });
  return map;
}

// =====================================================
// シフト提案シートへグリッド出力する
// =====================================================
function writeProposalSheet(ss, staffList, proposal, period) {
  // シートの作成 or クリア
  var sheet = ss.getSheetByName(SHEET_PROPOSAL);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(SHEET_PROPOSAL);
    // シフト集計シートの隣に移動
    var outputIdx = ss.getSheetByName(SHEET_OUTPUT)
      ? ss.getSheetByName(SHEET_OUTPUT).getIndex()
      : ss.getSheets().length;
    ss.moveActiveSheet(outputIdx + 1);
  }

  // 役職順でスタッフ列を並べる
  var sortedStaff = staffList.slice().sort(function(a, b) {
    var ai = ROLE_ORDER.indexOf(a.role);
    var bi = ROLE_ORDER.indexOf(b.role);
    if (ai === -1) ai = ROLE_ORDER.length;
    if (bi === -1) bi = ROLE_ORDER.length;
    return ai - bi;
  });

  // --- ヘッダー行 ---
  var fixedHeaders = ['日付', '曜日', '区分', '必要人数', '確定人数', '備考'];
  var headerRow = fixedHeaders.concat(sortedStaff.map(function(s) { return s.name + '\n(' + s.role + ')'; }));
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  sheet.getRange(1, 1, 1, headerRow.length)
    .setBackground(COLOR_HEADER)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.setRowHeight(1, 40);

  // --- データ行 ---
  var dateKeys = Object.keys(proposal).sort();
  var dataStartRow = 2;

  dateKeys.forEach(function(dateStr, rowIdx) {
    var dp   = proposal[dateStr];
    var row  = rowIdx + dataStartRow;

    // 区分文字列
    var kubun = dp.isClosed ? '定休' : (dp.isJointDayOff ? '合同定休' : (dp.isWeekendOrHoliday ? '土日祝' : '平日'));

    // 出勤確定人数
    var dutyCount = 0;
    Object.keys(dp.assignments).forEach(function(n) {
      if (dp.assignments[n].status === 'duty') dutyCount++;
    });

    // 固定列
    var fixedCols = [
      dateStr,
      dp.dayLabel,
      kubun,
      dp.isClosed ? '-' : dp.requiredCount,
      dp.isClosed ? '-' : dutyCount,
      dp.note
    ];
    sheet.getRange(row, 1, 1, fixedCols.length).setValues([fixedCols]);

    // 備考列（F列=6列目）の文字色
    if (dp.note.indexOf('⚠') !== -1) {
      sheet.getRange(row, 6).setFontColor('#cc0000');
    }

    // 行全体の背景色（定休日）
    if (dp.isClosed) {
      sheet.getRange(row, 1, 1, fixedHeaders.length + sortedStaff.length)
        .setBackground(COLOR_CLOSED);
    } else if (dp.dayLabel === '土' || dp.dayLabel === '日') {
      sheet.getRange(row, 1, 1, fixedHeaders.length)
        .setBackground('#f3f3f3');
    }

    // スタッフ列
    sortedStaff.forEach(function(s, colIdx) {
      var col = fixedHeaders.length + colIdx + 1;
      var a   = dp.assignments[s.name];
      if (!a) return;

      var cellText = '';
      var bg       = null;

      if (a.status === 'closed') {
        cellText = '定休';
        bg       = COLOR_CLOSED;
      } else if (a.status === 'off-joint') {
        cellText = '休★合同';
        bg       = COLOR_JOINT;
      } else if (a.status === 'off') {
        cellText = '休';
        bg       = COLOR_DAYOFF;
      } else if (a.status === 'duty') {
        if (a.lunchExempt) {
          cellText = '昼不要（夕〜）';
          bg       = COLOR_LUNCHFREE;
        } else if (a.isPrep) {
          cellText = '★仕込み ' + PREP_START_H + '-' + PREP_END_H;
          bg       = COLOR_PREP;
        } else {
          cellText = (a.start && a.end && a.start !== '終日') ? a.start + '〜' + a.end : '出勤';
          bg       = COLOR_DUTY;
        }
      } else {
        cellText = '-';
        bg       = null;
      }

      var cell = sheet.getRange(row, col);
      cell.setValue(cellText);
      if (bg) cell.setBackground(bg);
    });
  });

  // --- 凡例エリア ---
  var legendRow = dataStartRow + dateKeys.length + 2;
  var legends = [
    ['【凡例】', '', ''],
    ['定休', '定休日（火曜）', COLOR_CLOSED],
    ['休', '通常休み', COLOR_DAYOFF],
    ['休★合同', '合同定休（月1回）', COLOR_JOINT],
    ['★仕込み 15-21', '仕込み担当', COLOR_PREP],
    ['出勤（時刻）', '通常出勤', COLOR_DUTY],
    ['昼不要（夕〜）', '社長昼シフト免除（土日祝・KA/KB出勤時）', COLOR_LUNCHFREE],
    ['-', 'シフト未提出', '']
  ];
  legends.forEach(function(leg, i) {
    var r = legendRow + i;
    sheet.getRange(r, 1).setValue(leg[0]).setFontWeight(i === 0 ? 'bold' : 'normal');
    sheet.getRange(r, 2).setValue(leg[1]);
    if (leg[2]) sheet.getRange(r, 1).setBackground(leg[2]);
  });

  // --- 列幅・フリーズ ---
  sheet.setColumnWidth(1, 100);  // 日付
  sheet.setColumnWidth(2, 40);   // 曜日
  sheet.setColumnWidth(3, 70);   // 区分
  sheet.setColumnWidth(4, 60);   // 必要人数
  sheet.setColumnWidth(5, 60);   // 確定人数
  sheet.setColumnWidth(6, 180);  // 備考
  sortedStaff.forEach(function(_, i) {
    sheet.setColumnWidth(fixedHeaders.length + i + 1, 110);
  });

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(6);

  // シートをアクティブ化
  ss.setActiveSheet(sheet);
}

// =====================================================
// ユーティリティ関数
// =====================================================

// Date → 'yyyy/MM/dd' 文字列
function formatDateStr(date) {
  return Utilities.formatDate(date, TIMEZONE, 'yyyy/MM/dd');
}

// ISO週キー（月曜始まり）を返す — 例: '2026-W15'
function getIsoWeekKey(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // 月曜に揃える
  var day = d.getDay() || 7; // 日曜=7
  d.setDate(d.getDate() - day + 1);
  return d.getFullYear() + '-W' + String(getWeekNumber(d)).padStart(2, '0');
}

function getWeekNumber(d) {
  var start = new Date(d.getFullYear(), 0, 1);
  var diff  = (d - start) / (1000 * 60 * 60 * 24);
  return Math.ceil((diff + start.getDay() + 1) / 7);
}
