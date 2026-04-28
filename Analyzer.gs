/**
 * =====================================================
 * シフト過去データ分析 & テンプレート生成エンジン
 * =====================================================
 * Googleカレンダーの過去データを読み取り:
 *   1. 曜日ごとの平均スキルスコアを集計
 *   2. 「黄金ペア」（相性の良い組み合わせ）を特定
 *   3. 「シフトテンプレート」シートに5パターンを生成
 *
 * 【タイムアウト対策】
 *   - デフォルト分析期間を1ヶ月に短縮（最大3ヶ月まで選択可）
 *   - スタッフ処理ループに経過時間ガードを追加
 *   - 途中でタイムアウトが近づいたら打ち切って部分結果を出力
 *
 * 【依存】Code.gs, Optimizer.gs の以下を使用:
 *   - TIMEZONE, WEEKDAY_NAMES, SHEET_TEMPLATE, ROLE_OWNER, ROLE_MANAGER, ROLE_STAFF
 *   - calcHours(), loadStaffMaster(), getStaffList(), getEventsForStaff()
 * =====================================================
 */

// GASの実行上限は6分。余裕を持って4分で打ち切る
var MAX_EXEC_MS = 240000;

var TEMPLATE_PATTERNS = [
  { id: 1, name: 'ベテラン重視型', desc: 'スキルスコア合計が最大になる配置' },
  { id: 2, name: 'コスト重視型',  desc: '人件費を最小化する低賃金優先配置' },
  { id: 3, name: 'バランス型',    desc: 'スキル・コスト・頻度のバランス配置' },
  { id: 4, name: '黄金ペア型',   desc: '過去データで相性の良いペアを優先' },
  { id: 5, name: '育成型',       desc: 'ベテラン＋新人の組み合わせによる育成配置' }
];

// =====================================================
// メイン: 過去データ分析を実行する
// =====================================================
function runHistoricalAnalysis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // --- 分析期間をユーザーに選ばせる ---
  var prompt = ui.prompt(
    '📊 分析期間の設定',
    '分析する月数を半角数字で入力してください。\n\n'
      + '  1 → 直近1ヶ月（推奨・高速）\n'
      + '  2 → 直近2ヶ月\n'
      + '  3 → 直近3ヶ月（スタッフが多いと時間がかかります）\n\n'
      + '※ 空欄または1未満の入力は「1ヶ月」として実行します。',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var months = parseInt(prompt.getResponseText().trim(), 10);
  if (isNaN(months) || months < 1) months = 1;
  if (months > 3) months = 3;

  try {
    // --- カレンダーデータをスキャン（タイムアウト監視付き）---
    var result = scanPastCalendarData(ss, months);

    if (result.data.length === 0) {
      ui.alert('⚠ データなし',
        '対象期間にカレンダーデータが見つかりませんでした。\n「スタッフ管理」シートのカレンダーIDを確認してください。',
        ui.ButtonSet.OK);
      return;
    }

    var skillMap     = loadStaffMaster(ss);
    var weekdayStats = calcWeekdaySkillAverages(result.data, skillMap);
    var pairStats    = findGoldenPairs(result.data, skillMap);
    var templates    = generateShiftTemplates(weekdayStats, pairStats, skillMap);

    writeTemplateSheet(ss, templates, weekdayStats, pairStats, result.data.length, months, result.timedOut, result.processedCount, result.totalCount);

    // --- 完了メッセージ ---
    var msg = '分析レコード数: ' + result.data.length + '件\n'
            + '処理スタッフ: ' + result.processedCount + ' / ' + result.totalCount + '名\n\n'
            + '「シフトテンプレート」シートを確認してください。';

    if (result.timedOut) {
      msg += '\n\n⚠ 実行時間の上限（4分）に達したため、一部スタッフのデータを省略しました。\n'
           + '再実行するか、分析期間を「1ヶ月」に短縮してお試しください。';
      ui.alert('⚠ 部分的に完了', msg, ui.ButtonSet.OK);
    } else {
      ui.alert('✅ 分析完了', msg, ui.ButtonSet.OK);
    }

  } catch (e) {
    ui.alert('❌ エラー', e.message, ui.ButtonSet.OK);
    Logger.log(e.stack);
  }
}

// =====================================================
// 過去Nヶ月分のカレンダーデータをスキャンする
//
// 【タイムアウト対策】
//   - forループで1スタッフずつ処理
//   - ループ先頭で経過時間をチェックし MAX_EXEC_MS を超えたら打ち切る
//
// @return {data, timedOut, processedCount, totalCount}
// =====================================================
function scanPastCalendarData(ss, months) {
  var execStart = new Date().getTime();
  var staffList = getStaffList(ss);

  if (staffList.length === 0) {
    return { data: [], timedOut: false, processedCount: 0, totalCount: 0 };
  }

  var endDate   = new Date();
  endDate.setHours(23, 59, 59, 999);
  var startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setHours(0, 0, 0, 0);

  var shiftData      = [];
  var timedOut       = false;
  var processedCount = 0;

  for (var i = 0; i < staffList.length; i++) {
    // ---- タイムアウト事前チェック ----
    var elapsed = new Date().getTime() - execStart;
    if (elapsed > MAX_EXEC_MS) {
      timedOut = true;
      Logger.log('タイムアウト回避: ' + staffList[i].name + ' 以降をスキップ（経過 ' + Math.round(elapsed / 1000) + '秒）');
      break;
    }

    var staff = staffList[i];
    try {
      var rows = getEventsForStaff(staff, startDate, endDate);
      rows.forEach(function(row) {
        var dateStr = row[1];
        var parsed  = new Date(String(dateStr).replace(/\//g, '-'));
        if (isNaN(parsed.getTime())) return;
        shiftData.push({
          name:      row[0],
          date:      dateStr,
          weekday:   WEEKDAY_NAMES[parsed.getDay()],
          startTime: row[2],
          endTime:   row[3],
          hours:     calcHours(row[2], row[3])
        });
      });
    } catch (e) {
      Logger.log('スキャンエラー(' + staff.name + '): ' + e.message);
    }
    processedCount++;
  }

  return {
    data:           shiftData,
    timedOut:       timedOut,
    processedCount: processedCount,
    totalCount:     staffList.length
  };
}

// =====================================================
// 曜日ごとの平均スキルスコアを計算する
// @return {曜日: {kitchenAvg, hallAvg, totalAvg, staffFrequency, sampleCount}}
// =====================================================
function calcWeekdaySkillAverages(shiftData, skillMap) {
  var byWeekday = {};
  WEEKDAY_NAMES.forEach(function(w) {
    byWeekday[w] = { days: {}, staffFrequency: {} };
  });

  shiftData.forEach(function(entry) {
    var w = entry.weekday;
    if (!byWeekday[w]) return;
    if (!byWeekday[w].days[entry.date]) byWeekday[w].days[entry.date] = [];
    byWeekday[w].days[entry.date].push(entry);
    byWeekday[w].staffFrequency[entry.name] = (byWeekday[w].staffFrequency[entry.name] || 0) + 1;
  });

  var stats = {};
  WEEKDAY_NAMES.forEach(function(w) {
    var wd   = byWeekday[w];
    var days = Object.values(wd.days);
    var kSum = 0;
    var hSum = 0;

    days.forEach(function(staffOnDay) {
      staffOnDay.forEach(function(entry) {
        var info = skillMap[entry.name] || {};
        kSum += info.kitchenScore || 0;
        hSum += info.hallScore    || 0;
      });
    });

    var n = days.length;
    stats[w] = {
      kitchenAvg:     n > 0 ? Math.round(kSum / n * 10) / 10 : 0,
      hallAvg:        n > 0 ? Math.round(hSum / n * 10) / 10 : 0,
      totalAvg:       n > 0 ? Math.round((kSum + hSum) / n * 10) / 10 : 0,
      staffFrequency: wd.staffFrequency,
      sampleCount:    n
    };
  });

  return stats;
}

// =====================================================
// 同日出勤ペアを分析して黄金ペアTOP10を特定する
// @return [{staffA, staffB, coCount, skillSum, label}]
// =====================================================
function findGoldenPairs(shiftData, skillMap) {
  var byDate = {};
  shiftData.forEach(function(entry) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry.name);
  });

  var coMatrix = {};
  Object.values(byDate).forEach(function(names) {
    var unique = names.filter(function(v, i, a) { return a.indexOf(v) === i; }).sort();
    for (var i = 0; i < unique.length - 1; i++) {
      for (var j = i + 1; j < unique.length; j++) {
        var key = unique[i] + '|||' + unique[j];
        coMatrix[key] = (coMatrix[key] || 0) + 1;
      }
    }
  });

  var pairs = Object.keys(coMatrix).map(function(key) {
    var names    = key.split('|||');
    var infoA    = skillMap[names[0]] || {};
    var infoB    = skillMap[names[1]] || {};
    var skillSum = (infoA.kitchenScore || 0) + (infoA.hallScore || 0)
                 + (infoB.kitchenScore || 0) + (infoB.hallScore || 0);
    return { staffA: names[0], staffB: names[1], coCount: coMatrix[key], skillSum: skillSum };
  });

  pairs.sort(function(a, b) {
    return b.coCount !== a.coCount ? b.coCount - a.coCount : b.skillSum - a.skillSum;
  });

  var medals = ['🥇 鉄板', '🥇 鉄板', '🥇 鉄板', '🥈 定番', '🥈 定番', '🥈 定番', '🥉 相性良', '🥉 相性良', '🥉 相性良', '🥉 相性良'];
  return pairs.slice(0, 10).map(function(p, i) {
    return Object.assign({}, p, { label: medals[i] || '📌' });
  });
}

// =====================================================
// 5パターンのシフトテンプレートを曜日ごとに生成する
// @return {曜日: [pattern1〜5]}
// =====================================================
function generateShiftTemplates(weekdayStats, pairStats, skillMap) {
  var templates = {};

  WEEKDAY_NAMES.forEach(function(weekday) {
    var stat   = weekdayStats[weekday];
    var freq   = stat.staffFrequency;
    var byFreq = Object.keys(freq).map(function(name) {
      return { name: name, freq: freq[name], info: skillMap[name] || {} };
    }).sort(function(a, b) { return b.freq - a.freq; });

    var dayPats = [];

    // パターン1: ベテラン重視型（スキル合計でソート）
    var veterans = byFreq.slice()
      .sort(function(a, b) {
        return ((b.info.kitchenScore || 0) + (b.info.hallScore || 0))
             - ((a.info.kitchenScore || 0) + (a.info.hallScore || 0));
      }).slice(0, 4);
    dayPats.push(buildPattern(1, weekday, veterans));

    // パターン2: コスト重視型（時給の低い順、社長・店長は先頭固定）
    var cheapest = byFreq.slice()
      .filter(function(s) { return s.info.role !== ROLE_OWNER && s.info.role !== ROLE_MANAGER; })
      .sort(function(a, b) { return (a.info.wage || 0) - (b.info.wage || 0); });
    var owners = byFreq.filter(function(s) { return s.info.role === ROLE_OWNER || s.info.role === ROLE_MANAGER; });
    dayPats.push(buildPattern(2, weekday, owners.concat(cheapest).slice(0, 4)));

    // パターン3: バランス型（出勤頻度トップ順）
    dayPats.push(buildPattern(3, weekday, byFreq.slice(0, 4)));

    // パターン4: 黄金ペア型
    var goldenStaff = pickGoldenPairStaff(pairStats, freq, byFreq, 4);
    dayPats.push(buildPattern(4, weekday, goldenStaff));

    // パターン5: 育成型（高スキル2名＋低スキル2名）
    var sorted   = byFreq.slice().sort(function(a, b) {
      return ((b.info.kitchenScore || 0) + (b.info.hallScore || 0))
           - ((a.info.kitchenScore || 0) + (a.info.hallScore || 0));
    });
    var trainers = sorted.slice(0, 2);
    var trainees = sorted.slice().reverse()
      .filter(function(s) { return s.info.role !== ROLE_OWNER && s.info.role !== ROLE_MANAGER; })
      .slice(0, 2);
    dayPats.push(buildPattern(5, weekday, trainers.concat(trainees)));

    templates[weekday] = dayPats;
  });

  return templates;
}

// その曜日の頻度データから黄金ペアスタッフを選出する
function pickGoldenPairStaff(pairStats, freq, byFreq, maxCount) {
  var result = [];
  var used   = {};

  pairStats.forEach(function(pair) {
    if (result.length >= maxCount) return;
    [pair.staffA, pair.staffB].forEach(function(name) {
      if (result.length < maxCount && freq[name] && !used[name]) {
        result.push({ name: name, freq: freq[name] || 0, info: {} });
        used[name] = true;
      }
    });
  });

  // 不足分を頻度順で補完
  byFreq.forEach(function(s) {
    if (result.length >= maxCount || used[s.name]) return;
    result.push(s);
    used[s.name] = true;
  });

  return result.slice(0, maxCount);
}

// パターンオブジェクトを構築する
function buildPattern(id, weekday, staffList) {
  var pat   = TEMPLATE_PATTERNS[id - 1];
  var slots = staffList.map(function(s) {
    var info = s.info || {};
    return {
      name:   s.name,
      skill:  info.skill        || '不明',
      kScore: info.kitchenScore || 0,
      hScore: info.hallScore    || 0,
      wage:   info.wage         || 0,
      role:   info.role         || ROLE_STAFF,
      freq:   s.freq            || 0
    };
  });

  var totalK  = slots.reduce(function(s, x) { return s + x.kScore; }, 0);
  var totalH  = slots.reduce(function(s, x) { return s + x.hScore; }, 0);
  var estCost = slots.reduce(function(s, x) {
    return s + (x.role === ROLE_OWNER || x.role === ROLE_MANAGER ? 0 : x.wage * 8);
  }, 0);

  return {
    patternId:   id,
    patternName: pat.name,
    patternDesc: pat.desc,
    weekday:     weekday,
    slots:       slots,
    totalK:      totalK,
    totalH:      totalH,
    estCost:     estCost
  };
}

// =====================================================
// 「シフトテンプレート」シートに全分析結果を書き出す
// @param timedOut       タイムアウト打ち切りが発生したか
// @param processedCount 処理できたスタッフ数
// @param totalCount     全スタッフ数
// =====================================================
function writeTemplateSheet(ss, templates, weekdayStats, pairStats, dataCount, months, timedOut, processedCount, totalCount) {
  var old = ss.getSheetByName(SHEET_TEMPLATE);
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet(SHEET_TEMPLATE);

  var COL = 8;
  function r8(arr) {
    while (arr.length < COL) arr.push('');
    return arr.slice(0, COL);
  }

  var rows = [];

  // ---- タイトル ----
  var titleText = '📋 シフトテンプレート（直近' + months + 'ヶ月データ分析）';
  if (timedOut) titleText += '　⚠ 部分データ（' + processedCount + '/' + totalCount + '名）';
  rows.push(r8([titleText]));
  rows.push(r8([
    '分析レコード数: ' + dataCount + '件　'
    + '処理スタッフ: ' + processedCount + '/' + totalCount + '名　'
    + '生成日時: ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd HH:mm')
  ]));

  // タイムアウト警告行
  if (timedOut) {
    rows.push(r8(['⚠ 実行時間の上限に達したため ' + (totalCount - processedCount) + '名分のデータを省略しました。分析期間を短縮するか、再実行してください。']));
  } else {
    rows.push(r8(['']));
  }

  // ---- 黄金ペアランキング ----
  var pairTitleRow = rows.length + 1;
  rows.push(r8(['🏆 黄金ペアランキング（共演回数 TOP10）']));
  rows.push(r8(['順位', '評価', 'スタッフA', 'スタッフB', '共演回数', 'スキル合計(K+H)', '']));

  if (pairStats.length === 0) {
    rows.push(r8(['', '', '（データ不足 — 複数スタッフが同日出勤した記録がありません）']));
  } else {
    pairStats.forEach(function(p, i) {
      rows.push(r8([i + 1, p.label, p.staffA, p.staffB, p.coCount + '回', p.skillSum + 'pt', '']));
    });
  }
  rows.push(r8(['']));

  // ---- 曜日別 平均スキルスコア ----
  var statTitleRow = rows.length + 1;
  rows.push(r8(['📊 曜日別 平均スキルスコア']));
  rows.push(r8(['曜日', 'キッチン平均', 'ホール平均', '総合平均', 'サンプル日数', '出勤頻度 TOP3スタッフ', '']));

  WEEKDAY_NAMES.forEach(function(w) {
    var st   = weekdayStats[w];
    var freq = st.staffFrequency;
    var top3 = Object.keys(freq)
      .sort(function(a, b) { return freq[b] - freq[a]; })
      .slice(0, 3)
      .map(function(name) { return name + '(' + freq[name] + '回)'; })
      .join('、');
    rows.push(r8([
      w + '曜日',
      st.kitchenAvg + 'pt',
      st.hallAvg    + 'pt',
      st.totalAvg   + 'pt',
      st.sampleCount + '日',
      top3 || '（データなし）',
      ''
    ]));
  });
  rows.push(r8(['']));

  // ---- 曜日別シフトテンプレート ----
  var tmplTitleRow = rows.length + 1;
  rows.push(r8(['🗓 曜日別シフトテンプレート（5パターン）']));

  WEEKDAY_NAMES.forEach(function(weekday) {
    var pats = templates[weekday];
    rows.push(r8(['']));
    rows.push(r8(['━━━ ' + weekday + '曜日 ━━━']));
    rows.push(r8(['パターン', '特徴説明', 'スロット1', 'スロット2', 'スロット3', 'スロット4', '推定コスト', '合計スキル']));

    if (!pats || pats.length === 0) {
      rows.push(r8(['', '', '（' + weekday + '曜日のデータなし）']));
      return;
    }

    pats.forEach(function(pt) {
      var cells = [pt.patternName, pt.patternDesc];
      pt.slots.forEach(function(s) {
        cells.push(s.name + ' [' + s.skill + '] K' + s.kScore + '/H' + s.hScore);
      });
      while (cells.length < 6) cells.push('—');
      cells.push('¥' + pt.estCost.toLocaleString() + '〜');
      cells.push('K:' + pt.totalK + ' / H:' + pt.totalH);
      rows.push(r8(cells));
    });
  });

  // ---- スキルスコア凡例 ----
  rows.push(r8(['']));
  rows.push(r8(['【スキルスコア凡例】']));
  rows.push(r8(['記号', '×', '△', '□', '◎', '◎◎', '', '']));
  rows.push(r8(['点数',  0,    1,   2,   3,     4,   '', '']));

  // ---- シートに書き込み ----
  sheet.getRange(1, 1, rows.length, COL).setValues(rows);

  // 書式設定
  var titleBg = timedOut ? '#e65100' : '#1a73e8';
  sheet.getRange(1, 1, 1, COL).setBackground(titleBg).setFontColor('#ffffff').setFontWeight('bold').setFontSize(13);
  if (timedOut) {
    sheet.getRange(3, 1, 1, COL).setBackground('#fff3e0').setFontColor('#bf360c').setFontWeight('bold');
  }
  sheet.getRange(pairTitleRow, 1, 1, COL).setBackground('#fff3e0').setFontWeight('bold');
  sheet.getRange(pairTitleRow + 1, 1, 1, COL).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(statTitleRow, 1, 1, COL).setBackground('#e8f5e9').setFontWeight('bold');
  sheet.getRange(statTitleRow + 1, 1, 1, COL).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(tmplTitleRow, 1, 1, COL).setBackground('#fce8b2').setFontWeight('bold');

  sheet.autoResizeColumns(1, COL);
}
