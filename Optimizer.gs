/**
 * =====================================================
 * シフト最適化エンジン
 * =====================================================
 * スタッフマスタ・必要人員マスタ・固定ルールを元に
 * 3パターンのシフト案を自動生成します。
 *
 * 【依存】Code.gs の定数・関数を使用します:
 *   - TIMEZONE, SHEET_OUTPUT
 *   - getDatePeriod(ss)
 * =====================================================
 */

// ---- 最適化エンジン用定数 ----
var SHEET_STAFF_MASTER = 'スタッフマスタ';
var SHEET_REQUIREMENTS = '必要人員マスタ';
var SHEET_RULES        = '固定ルール';
var SHEET_TEMPLATE     = 'シフトテンプレート';

var WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

var ROLE_OWNER   = '社長';
var ROLE_MANAGER = '店長';
var ROLE_STAFF   = 'バイト';

var SKILL_KITCHEN = 'キッチン';
var SKILL_HALL    = 'ホール';
var SKILL_BOTH    = '両方';

var RULE_OWNER_OFF_REQUIRES_MANAGER   = 'OWNER_OFF_REQUIRES_MANAGER';
var RULE_OWNER_MANAGER_BOTH_REDUCE_PT = 'OWNER_MANAGER_BOTH_REDUCE_PT';
var RULE_PAIR_REQUIRED                = 'PAIR_REQUIRED';

var MODE_MIN_COST = 'MIN_COST';
var MODE_GENEROUS = 'GENEROUS';
var MODE_BALANCED = 'BALANCED';

// =====================================================
// メイン: シフト最適化を実行する
// =====================================================
function runShiftOptimizer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    var staffMap     = loadStaffMaster(ss);
    var requirements = loadRequirements(ss);
    var rules        = loadFixedRules(ss);
    var availability = loadAvailability(ss);
    var period       = getDatePeriod(ss);

    if (!period) {
      ui.alert('⚠ 設定エラー', '「設定」シートに取得期間を入力してください。', ui.ButtonSet.OK);
      return;
    }
    if (Object.keys(staffMap).length === 0) {
      ui.alert('⚠ データ不足', '「スタッフマスタ」シートにデータを入力してください。', ui.ButtonSet.OK);
      return;
    }

    var data       = { staffMap: staffMap, requirements: requirements, rules: rules, availability: availability, period: period };
    var monthLabel = Utilities.formatDate(period.startDate, TIMEZONE, 'M月');

    deleteOldProposalSheets(ss, monthLabel);

    var proposals = [
      { mode: MODE_MIN_COST, label: '最小コスト案' },
      { mode: MODE_GENEROUS, label: '余裕配置案'  },
      { mode: MODE_BALANCED, label: 'バランス案'  }
    ];

    proposals.forEach(function(p, i) {
      var proposal = generateProposal(data, p.mode);
      writeProposalSheet(ss, proposal, monthLabel + '_提案' + (i + 1), p.label);
    });

    ui.alert('✅ 最適化完了',
      monthLabel + 'のシフト提案を3パターン生成しました。\nシート「' + monthLabel + '_提案1〜3」を確認してください。',
      ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('❌ エラー', e.message, ui.ButtonSet.OK);
    Logger.log(e.stack);
  }
}

// =====================================================
// 「スタッフマスタ」シートを読み込む
// @return {name: {skill, kitchenScore, hallScore, wage, role, priority, maxHours}}
// =====================================================
function loadStaffMaster(ss) {
  var sheet = ss.getSheetByName(SHEET_STAFF_MASTER);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var data     = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var staffMap = {};

  data.forEach(function(row) {
    var name = String(row[0]).trim();
    if (!name) return;
    staffMap[name] = {
      name:         name,
      skill:        String(row[1]).trim(),
      kitchenScore: Number(row[2]) || 0,
      hallScore:    Number(row[3]) || 0,
      wage:         Number(row[4]) || 0,
      role:         String(row[5]).trim(),
      priority:     Number(row[6]) || 5,
      maxHours:     Number(row[7]) || 160
    };
  });

  return staffMap;
}

// =====================================================
// 「必要人員マスタ」シートを読み込む
// @return {曜日: {kitchenMin, kitchenMax, hallMin, hallMax, openTime, closeTime, budget}}
// =====================================================
function loadRequirements(ss) {
  var sheet = ss.getSheetByName(SHEET_REQUIREMENTS);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var data   = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var reqMap = {};

  data.forEach(function(row) {
    var day = String(row[0]).trim();
    if (!day) return;
    reqMap[day] = {
      kitchenMin: Number(row[1]) || 1,
      kitchenMax: Number(row[2]) || 2,
      hallMin:    Number(row[3]) || 1,
      hallMax:    Number(row[4]) || 2,
      openTime:   Number(row[5]) || 11,
      closeTime:  Number(row[6]) || 21,
      budget:     Number(row[7]) || 20000
    };
  });

  return reqMap;
}

// =====================================================
// 「固定ルール」シートを読み込む
// @return [{id, type, staffA, staffB, description}]
// =====================================================
function loadFixedRules(ss) {
  var sheet = ss.getSheetByName(SHEET_RULES);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data  = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var rules = [];

  data.forEach(function(row) {
    var id = String(row[0]).trim();
    if (!id) return;
    rules.push({
      id:          id,
      type:        String(row[1]).trim(),
      staffA:      String(row[2]).trim(),
      staffB:      String(row[3]).trim(),
      description: String(row[4]).trim()
    });
  });

  return rules;
}

// =====================================================
// 「シフト集計」シートからスタッフの出勤可能時間を読み込む
// @return {yyyy/MM/dd: [{name, startTime, endTime}]}
// =====================================================
function loadAvailability(ss) {
  var sheet = ss.getSheetByName(SHEET_OUTPUT);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var data  = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var avail = {};

  data.forEach(function(row) {
    var name  = String(row[0]).trim();
    var date  = String(row[1]).trim();
    var start = String(row[2]).trim();
    var end   = String(row[3]).trim();
    if (!name || !date) return;
    if (!avail[date]) avail[date] = [];
    avail[date].push({ name: name, startTime: start, endTime: end });
  });

  return avail;
}

// =====================================================
// 1提案を生成する
// @return {mode, days:[{date,weekday,assignments,cost,ruleOk,ruleNotes}], totalCost, score}
// =====================================================
function generateProposal(data, mode) {
  var days      = [];
  var totalCost = 0;

  var cur = new Date(data.period.startDate);
  var end = new Date(data.period.endDate);
  cur.setHours(0, 0, 0, 0);

  while (cur <= end) {
    var dateStr = Utilities.formatDate(cur, TIMEZONE, 'yyyy/MM/dd');
    var weekday = WEEKDAY_NAMES[cur.getDay()];
    var req     = data.requirements[weekday] || data.requirements['全日'] || getDefaultRequirement();
    var avail   = data.availability[dateStr] || [];

    var dayResult = buildDayAssignment(avail, req, data.staffMap, data.rules, mode);

    days.push({
      date:        dateStr,
      weekday:     weekday,
      assignments: dayResult.assignments,
      cost:        dayResult.cost,
      ruleOk:      dayResult.ruleOk,
      ruleNotes:   dayResult.ruleNotes
    });
    totalCost += dayResult.cost;
    cur.setDate(cur.getDate() + 1);
  }

  var score = scoreProposal(days, data.requirements);
  return { mode: mode, days: days, totalCost: totalCost, score: score };
}

function getDefaultRequirement() {
  return { kitchenMin: 1, kitchenMax: 2, hallMin: 1, hallMax: 2, openTime: 11, closeTime: 21, budget: 20000 };
}

// =====================================================
// 1日のシフト割り当てを決定する
// @return {assignments, cost, ruleOk, ruleNotes}
// =====================================================
function buildDayAssignment(avail, req, staffMap, rules, mode) {
  var candidates = avail.map(function(a) {
    var info = staffMap[a.name] || {};
    return {
      name:         a.name,
      skill:        info.skill        || SKILL_BOTH,
      kitchenScore: info.kitchenScore || 0,
      hallScore:    info.hallScore    || 0,
      wage:         info.wage         || 1000,
      role:         info.role         || ROLE_STAFF,
      priority:     info.priority     || 5,
      startTime:    a.startTime,
      endTime:      a.endTime
    };
  }).filter(function(c) { return !!c.name; });

  var ruleResult = applyFixedRules(candidates, rules);
  candidates = ruleResult.candidates;

  var assignments = greedyAssign(candidates, req, mode);

  if (mode === MODE_MIN_COST) {
    assignments = trimByBudget(assignments, req);
  }

  var cost = calcDailyCost(assignments);
  return { assignments: assignments, cost: cost, ruleOk: ruleResult.ok, ruleNotes: ruleResult.notes };
}

// =====================================================
// 固定ルールを適用してスタッフ候補を調整する
// =====================================================
function applyFixedRules(candidates, rules) {
  var notes  = [];
  var ok     = true;
  var result = candidates.slice();

  var ownerPresent   = result.some(function(c) { return c.role === ROLE_OWNER; });
  var managerPresent = result.some(function(c) { return c.role === ROLE_MANAGER; });

  rules.forEach(function(rule) {
    if (rule.type === RULE_OWNER_OFF_REQUIRES_MANAGER && !ownerPresent && !managerPresent) {
      ok = false;
      notes.push('⚠ 社長休み・店長不在（要確認）');
    }

    if (rule.type === RULE_OWNER_MANAGER_BOTH_REDUCE_PT && ownerPresent && managerPresent) {
      notes.push('ℹ 社長・店長両出勤：バイト削減モード');
      result = result.map(function(c) {
        return c.role === ROLE_STAFF ? Object.assign({}, c, { reducible: true }) : c;
      });
    }

    if (rule.type === RULE_PAIR_REQUIRED) {
      var aPresent = result.some(function(c) { return c.name === rule.staffA; });
      var bPresent = result.some(function(c) { return c.name === rule.staffB; });
      if (!aPresent && !bPresent) {
        ok = false;
        notes.push('⚠ 必須スタッフ不在（' + rule.staffA + ' または ' + rule.staffB + '）');
      }
    }
  });

  return { candidates: result, notes: notes, ok: ok };
}

// =====================================================
// 貪欲法でキッチン・ホールにスタッフを割り当てる
// =====================================================
function greedyAssign(candidates, req, mode) {
  var assignments = [];
  var used        = {};

  // 社長・店長を無条件割り当て
  candidates.forEach(function(c) {
    if (c.role !== ROLE_OWNER && c.role !== ROLE_MANAGER) return;
    var hours = calcHours(c.startTime, c.endTime);
    assignments.push({
      name:          c.name,
      assignedSkill: (c.skill === SKILL_KITCHEN) ? SKILL_KITCHEN : SKILL_HALL,
      startTime:     c.startTime,
      endTime:       c.endTime,
      hours:         hours,
      cost:          hours * c.wage,
      role:          c.role
    });
    used[c.name] = true;
  });

  var partTimers = candidates.filter(function(c) {
    return c.role === ROLE_STAFF && !used[c.name];
  });

  // モード別ソート
  if (mode === MODE_MIN_COST) {
    partTimers.sort(function(a, b) { return a.wage - b.wage; });
  } else if (mode === MODE_GENEROUS) {
    partTimers.sort(function(a, b) {
      return (b.kitchenScore + b.hallScore) - (a.kitchenScore + a.hallScore) || b.priority - a.priority;
    });
  } else {
    partTimers.sort(function(a, b) {
      var sA = (a.kitchenScore + a.hallScore) * 0.5 + a.priority * 0.3 - a.wage * 0.0002;
      var sB = (b.kitchenScore + b.hallScore) * 0.5 + b.priority * 0.3 - b.wage * 0.0002;
      return sB - sA;
    });
  }

  function countAssigned(skill) {
    return assignments.filter(function(a) { return a.assignedSkill === skill; }).length;
  }

  var kTarget = (mode === MODE_GENEROUS) ? req.kitchenMax : req.kitchenMin;
  var hTarget = (mode === MODE_GENEROUS) ? req.hallMax    : req.hallMin;

  partTimers.forEach(function(c) {
    if (used[c.name]) return;
    var kCount = countAssigned(SKILL_KITCHEN);
    var hCount = countAssigned(SKILL_HALL);
    var assigned = null;

    if      (c.skill === SKILL_KITCHEN && kCount < kTarget) assigned = SKILL_KITCHEN;
    else if (c.skill === SKILL_HALL    && hCount < hTarget) assigned = SKILL_HALL;
    else if (c.skill === SKILL_BOTH) {
      if      (kCount < kTarget) assigned = SKILL_KITCHEN;
      else if (hCount < hTarget) assigned = SKILL_HALL;
    }

    if (!assigned) return;

    var hours = calcHours(c.startTime, c.endTime);
    assignments.push({
      name:          c.name,
      assignedSkill: assigned,
      startTime:     c.startTime,
      endTime:       c.endTime,
      hours:         hours,
      cost:          hours * c.wage,
      role:          c.role
    });
    used[c.name] = true;
  });

  return assignments;
}

// 予算超過時に最高時給のバイトを1人ずつ削除する
function trimByBudget(assignments, req) {
  var result = assignments.slice();
  while (calcDailyCost(result) > req.budget) {
    var partTimerIdxs = result
      .map(function(a, i) { return { i: i, a: a }; })
      .filter(function(x) { return x.a.role === ROLE_STAFF; });
    if (partTimerIdxs.length === 0) break;
    partTimerIdxs.sort(function(x, y) {
      return (y.a.cost / (y.a.hours || 1)) - (x.a.cost / (x.a.hours || 1));
    });
    result.splice(partTimerIdxs[0].i, 1);
  }
  return result;
}

function calcDailyCost(assignments) {
  return assignments.reduce(function(sum, a) { return sum + (a.cost || 0); }, 0);
}

// 時刻文字列 "HH:mm" を時間数（float）に変換する
function calcHours(startStr, endStr) {
  if (!startStr || startStr === '終日' || !endStr || endStr === '終日') return 8;
  var s = timeStrToFloat(startStr);
  var e = timeStrToFloat(endStr);
  return (e > s) ? (e - s) : 0;
}

function timeStrToFloat(t) {
  var p = String(t).split(':');
  return p.length < 2 ? 0 : parseInt(p[0], 10) + parseInt(p[1], 10) / 60;
}

// =====================================================
// 提案をスコアリングする
// @return {budgetRate, ruleScore, coverageScore}
// =====================================================
function scoreProposal(days, requirements) {
  var total        = days.length;
  var withinBudget = 0;
  var ruleOk       = 0;
  var covered      = 0;

  days.forEach(function(day) {
    var req = requirements[day.weekday] || requirements['全日'] || getDefaultRequirement();
    if (day.cost <= req.budget) withinBudget++;
    if (day.ruleOk) ruleOk++;
    var k = day.assignments.filter(function(a) { return a.assignedSkill === SKILL_KITCHEN; }).length;
    var h = day.assignments.filter(function(a) { return a.assignedSkill === SKILL_HALL; }).length;
    if (k >= req.kitchenMin && h >= req.hallMin) covered++;
  });

  var pct = function(n) { return total > 0 ? Math.round(n / total * 100) : 0; };
  return { budgetRate: pct(withinBudget), ruleScore: pct(ruleOk), coverageScore: pct(covered) };
}

// =====================================================
// 提案シートを書き出す
// =====================================================
function writeProposalSheet(ss, proposal, sheetName, label) {
  var old = ss.getSheetByName(sheetName);
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet(sheetName);

  var COL = 9;
  function row9(arr) {
    while (arr.length < COL) arr.push('');
    return arr.slice(0, COL);
  }

  var rows = [];

  rows.push(row9([sheetName + '　【' + label + '】']));
  rows.push(row9(['生成日時: ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd HH:mm')]));
  rows.push(row9(['']));
  rows.push(row9([
    '📊 スコアサマリー',
    '予算達成率: ' + proposal.score.budgetRate + '%',
    'ルール充足度: ' + proposal.score.ruleScore + '%',
    'カバレッジ: ' + proposal.score.coverageScore + '%',
    '総人件費: ¥' + Math.round(proposal.totalCost).toLocaleString()
  ]));
  rows.push(row9(['']));
  rows.push(row9(['日付', '曜日', 'スタッフ名', '担当', '開始', '終了', '時間数', '人件費', '備考']));

  proposal.days.forEach(function(day) {
    if (day.assignments.length === 0) {
      rows.push(row9([day.date, day.weekday, '（出勤可能スタッフなし）']));
      return;
    }
    day.assignments.forEach(function(a, i) {
      var note = (i === 0 && day.ruleNotes.length > 0) ? day.ruleNotes.join(' ') : '';
      rows.push(row9([
        i === 0 ? day.date    : '',
        i === 0 ? day.weekday : '',
        a.name,
        a.assignedSkill,
        a.startTime,
        a.endTime,
        a.hours > 0 ? a.hours.toFixed(1) : '',
        a.cost  > 0 ? '¥' + Math.round(a.cost) : '',
        note
      ]));
    });
    rows.push(row9(['', '', '【小計】', '', '', '', '', '¥' + Math.round(day.cost)]));
  });

  sheet.getRange(1, 1, rows.length, COL).setValues(rows);
  sheet.getRange(1, 1, 1, COL).setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold').setFontSize(12);
  sheet.getRange(4, 1, 1, COL).setBackground('#e8f5e9').setFontWeight('bold');
  sheet.getRange(6, 1, 1, COL).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
  sheet.autoResizeColumns(1, COL);
}

function deleteOldProposalSheets(ss, monthLabel) {
  var toDelete = [];
  ss.getSheets().forEach(function(s) {
    if (s.getName().indexOf(monthLabel + '_提案') === 0) toDelete.push(s);
  });
  toDelete.forEach(function(s) { ss.deleteSheet(s); });
}

// =====================================================
// 最適化用シートの初期設定
// =====================================================
function setupOptimizerSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // スタッフマスタ
  if (!ss.getSheetByName(SHEET_STAFF_MASTER)) {
    var sm = ss.insertSheet(SHEET_STAFF_MASTER);
    var smH = ['名前', 'スキル(キッチン/ホール/両方)', 'キッチンスコア(0-4)', 'ホールスコア(0-4)', '時給', '役職(社長/店長/バイト)', '優先度(1-10)', '月最大時間'];
    sm.getRange(1, 1, 1, smH.length).setValues([smH]).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
    var smData = [
      ['田中（社長）', '両方',    4, 4, 0,    '社長', 10, 200],
      ['山田（店長）', '両方',    3, 4, 0,    '店長',  9, 200],
      ['鈴木A',       'キッチン', 3, 0, 1100, 'バイト', 7, 120],
      ['佐藤B',       'ホール',   0, 3, 1050, 'バイト', 7, 120],
      ['高橋',        'ホール',   0, 2, 1000, 'バイト', 5,  80],
      ['中村',        '両方',     2, 2, 1050, 'バイト', 6, 100]
    ];
    sm.getRange(2, 1, smData.length, smH.length).setValues(smData);
    sm.getRange(smData.length + 3, 1).setValue('【スコア凡例】×=0　△=1　□=2　◎=3　◎◎=4')
      .setFontStyle('italic').setFontColor('#666666');
    sm.autoResizeColumns(1, smH.length);
  }

  // 必要人員マスタ
  if (!ss.getSheetByName(SHEET_REQUIREMENTS)) {
    var req = ss.insertSheet(SHEET_REQUIREMENTS);
    var reqH = ['曜日', 'キッチン最小', 'キッチン最大', 'ホール最小', 'ホール最大', '営業開始(例:11)', '営業終了(例:21)', '目標予算(円)'];
    req.getRange(1, 1, 1, reqH.length).setValues([reqH]).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
    var reqData = [
      ['月', 1, 2, 1, 2, 11, 21, 15000],
      ['火', 1, 2, 1, 2, 11, 21, 15000],
      ['水', 1, 2, 1, 2, 11, 21, 15000],
      ['木', 1, 2, 1, 2, 11, 21, 15000],
      ['金', 1, 2, 2, 3, 11, 22, 20000],
      ['土', 2, 3, 2, 3, 10, 22, 25000],
      ['日', 2, 3, 2, 3, 10, 22, 25000]
    ];
    req.getRange(2, 1, reqData.length, reqH.length).setValues(reqData);
    req.autoResizeColumns(1, reqH.length);
  }

  // 固定ルール
  if (!ss.getSheetByName(SHEET_RULES)) {
    var rs = ss.insertSheet(SHEET_RULES);
    var rsH = ['ルールID', 'タイプ', 'スタッフA', 'スタッフB', '説明'];
    rs.getRange(1, 1, 1, rsH.length).setValues([rsH]).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
    var rsData = [
      ['R001', RULE_OWNER_OFF_REQUIRES_MANAGER,   '田中（社長）', '山田（店長）', '社長休みの日は店長必須'],
      ['R002', RULE_OWNER_MANAGER_BOTH_REDUCE_PT, '田中（社長）', '山田（店長）', '社長・店長両出勤時はバイト削減'],
      ['R003', RULE_PAIR_REQUIRED,                '鈴木A',        '佐藤B',       'AさんかBさんのどちらかが必ず必要']
    ];
    rs.getRange(2, 1, rsData.length, rsH.length).setValues(rsData);
    var legend = [
      ['【タイプ凡例】'],
      [RULE_OWNER_OFF_REQUIRES_MANAGER + ' : 社長休みの日は店長必須'],
      [RULE_OWNER_MANAGER_BOTH_REDUCE_PT + ' : 社長・店長両出勤時はバイト削減'],
      [RULE_PAIR_REQUIRED + ' : AさんまたはBさんのどちらかが必須']
    ];
    rs.getRange(rsData.length + 3, 1, legend.length, 1).setValues(legend)
      .setFontStyle('italic').setFontColor('#666666');
    rs.autoResizeColumns(1, rsH.length);
  }

  ui.alert('✅ 最適化シート初期設定完了',
    '以下のシートを作成しました:\n\n'
    + '・スタッフマスタ — スキル・時給・役職を入力してください\n'
    + '・必要人員マスタ — 曜日ごとの必要人数と予算を設定してください\n'
    + '・固定ルール — 特殊なシフト条件を登録してください\n\n'
    + '設定後、「🤖 シフト最適化を実行」をクリックしてください。',
    ui.ButtonSet.OK);
}
