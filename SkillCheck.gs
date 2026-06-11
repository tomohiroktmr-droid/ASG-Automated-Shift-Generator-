/**
 * =====================================================
 * スキルチェック機能スクリプト
 * =====================================================
 * スタッフのスキル項目を管理し、自己評価フォーム・上司評価フォームを
 * 自動作成、回答結果を集計します。
 *
 * 【シート構成】
 *   スタッフ管理 シート（拡張）:
 *     A列: スタッフ名
 *     B列: カレンダーID
 *     C列: 役職
 *     D列: 入社日
 *
 *   スキル項目マスタ シート:
 *     A列: カテゴリ
 *     B列: スキル項目
 *     C列: 詳細説明
 *     D列: 対象役職
 *
 *   スキルチェック設定 シート:
 *     自己評価・上司評価フォームのURLを保存
 *
 *   自己評価_回答 / 上司評価_回答 シート:
 *     Googleフォームの回答が自動で蓄積される
 *
 *   スキルチェック結果 シート:
 *     スタッフ × スキル項目ごとの自己評価・上司評価・乖離を集計表示
 * =====================================================
 */

// ---- 定数 ----
var SHEET_SKILL_MASTER    = 'スキル項目マスタ';
var SHEET_SKILL_RESULT    = 'スキルチェック結果';
var SHEET_SKILL_CONFIG    = 'スキルチェック設定';
var SHEET_SELF_RESPONSES  = '自己評価_回答';
var SHEET_SUPER_RESPONSES = '上司評価_回答';

var SCALE_MIN = 1;
var SCALE_MAX = 5;

var FIELD_SELF_STAFF_NAME   = 'スタッフ名（あなたの名前）';
var FIELD_SUPER_TARGET_NAME = '評価対象のスタッフ名';
var FIELD_EVALUATOR_NAME    = '評価者名（あなたの名前・役職）';
var FIELD_COMMENT           = 'コメント・気づき（任意）';

// =====================================================
// 初期設定: スキルチェック関連シートをまとめて作成する
// =====================================================
function setupSkillCheckSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // --- スタッフ管理シートに「役職」「入社日」列を追加 ---
  var staffSheet = ss.getSheetByName(SHEET_STAFF);
  if (!staffSheet) {
    staffSheet = ss.insertSheet(SHEET_STAFF);
    staffSheet.getRange('A1').setValue('スタッフ名');
    staffSheet.getRange('B1').setValue('カレンダーID（メールアドレス）');
    staffSheet.getRange(1, 1, 1, 2).setBackground('#e8f0fe').setFontWeight('bold');
  }
  if (!staffSheet.getRange('C1').getValue()) {
    staffSheet.getRange('C1').setValue('役職');
    staffSheet.getRange('C1').setBackground('#e8f0fe').setFontWeight('bold');
  }
  if (!staffSheet.getRange('D1').getValue()) {
    staffSheet.getRange('D1').setValue('入社日');
    staffSheet.getRange('D1').setBackground('#e8f0fe').setFontWeight('bold');
  }
  if (staffSheet.getRange('A2').getValue() && !staffSheet.getRange('C2').getValue()) {
    staffSheet.getRange('C2').setValue('ホール（サンプル）');
    staffSheet.getRange('D2').setValue('2024/04/01');
  }
  staffSheet.autoResizeColumns(1, 4);

  // --- スキル項目マスタシートを作成 ---
  var masterSheet = ss.getSheetByName(SHEET_SKILL_MASTER);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEET_SKILL_MASTER);
    var headers = ['カテゴリ', 'スキル項目', '詳細説明', '対象役職'];
    masterSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    masterSheet.getRange(1, 1, 1, headers.length).setBackground('#e8f0fe').setFontWeight('bold');

    var sampleItems = [
      ['接客', '笑顔で挨拶ができる', 'お客様の入店時に明るい声で挨拶する', '全員'],
      ['接客', 'オーダーを正確に取れる', '注文内容を復唱し、聞き間違いを防ぐ', 'ホール'],
      ['接客', 'クレーム対応ができる', 'お客様からの指摘に冷静に対応し、上長に報告する', 'ホール'],
      ['調理', '基本の盛り付けができる', 'レシピ通りの盛り付けで提供できる', 'キッチン'],
      ['調理', '衛生管理ができる', '食材の取り扱い・保管ルールを守れる', 'キッチン'],
      ['レジ', 'レジ操作が正確にできる', '会計処理・つり銭の受け渡しを誤りなく行える', '全員'],
      ['マネジメント', 'シフト管理ができる', 'スタッフのシフト調整・代打対応ができる', '店長']
    ];
    masterSheet.getRange(2, 1, sampleItems.length, headers.length).setValues(sampleItems);
    masterSheet.autoResizeColumns(1, headers.length);
  }

  // --- スキルチェック結果シートを作成 ---
  if (!ss.getSheetByName(SHEET_SKILL_RESULT)) {
    ss.insertSheet(SHEET_SKILL_RESULT);
  }

  // --- スキルチェック設定シートを作成 ---
  var configSheet = ss.getSheetByName(SHEET_SKILL_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_SKILL_CONFIG);
    configSheet.getRange('A1').setValue('項目');
    configSheet.getRange('B1').setValue('内容');
    configSheet.getRange(1, 1, 1, 2).setBackground('#e8f0fe').setFontWeight('bold');
    configSheet.getRange('A2').setValue('自己評価フォームURL（回答用）');
    configSheet.getRange('A3').setValue('上司評価フォームURL（回答用）');
    configSheet.getRange('A4').setValue('自己評価フォーム編集URL');
    configSheet.getRange('A5').setValue('上司評価フォーム編集URL');
    configSheet.autoResizeColumns(1, 2);
  }

  ui.alert(
    '✅ スキルチェック初期設定完了',
    '以下のシートを作成（または確認）しました:\n\n'
      + '・スタッフ管理 — C列「役職」、D列「入社日」を入力してください\n'
      + '・スキル項目マスタ — チェックしたいスキル項目を編集してください（サンプル入り）\n'
      + '・スキルチェック結果 — 集計結果の出力先です\n'
      + '・スキルチェック設定 — フォームのURLが保存されます\n\n'
      + '次に「スキルチェックフォームを作成する」を実行してください。',
    ui.ButtonSet.OK
  );
}

// =====================================================
// 自己評価・上司評価フォームを作成する
// =====================================================
function createSkillCheckForms() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var skillItems = getSkillMasterItems(ss);
  if (skillItems.length === 0) {
    ui.alert(
      '⚠ スキル項目未登録',
      '「スキル項目マスタ」シートにスキル項目を入力してから実行してください。\n'
        + '先に「スキルチェックの初期設定」を実行するとサンプル項目が追加されます。',
      ui.ButtonSet.OK
    );
    return;
  }

  var staffNames = getStaffNamesForSkillCheck(ss);
  if (staffNames.length === 0) {
    ui.alert(
      '⚠ スタッフ未登録',
      '「スタッフ管理」シートのA列にスタッフ名を入力してから実行してください。',
      ui.ButtonSet.OK
    );
    return;
  }

  var configSheet = ss.getSheetByName(SHEET_SKILL_CONFIG);
  if (configSheet && configSheet.getRange('B2').getValue()) {
    var resp = ui.alert(
      '確認',
      'すでにスキルチェックフォームが作成されています。\n'
        + '再作成すると新しいフォームが作られ、URLが上書きされます。\n'
        + '（過去の回答シートは別名で保存されます）\n\n続行しますか？',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
  }

  var selfForm = buildSkillCheckForm({
    title: '【自己評価】スキルチェック',
    description: '自分のスキルについて、当てはまる点数を選んでください。\n（1：できない 〜 5：完璧にできる）',
    staffNames: staffNames,
    skillItems: skillItems,
    isSupervisorForm: false
  });

  var supervisorForm = buildSkillCheckForm({
    title: '【上司評価】スキルチェック',
    description: '部下のスキルについて、当てはまる点数を選んでください。\n（1：できない 〜 5：完璧にできる）',
    staffNames: staffNames,
    skillItems: skillItems,
    isSupervisorForm: true
  });

  setFormDestination(ss, selfForm, SHEET_SELF_RESPONSES);
  setFormDestination(ss, supervisorForm, SHEET_SUPER_RESPONSES);

  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_SKILL_CONFIG);
  }
  configSheet.getRange('A1').setValue('項目');
  configSheet.getRange('B1').setValue('内容');
  configSheet.getRange(1, 1, 1, 2).setBackground('#e8f0fe').setFontWeight('bold');
  configSheet.getRange('A2').setValue('自己評価フォームURL（回答用）');
  configSheet.getRange('B2').setValue(selfForm.getPublishedUrl());
  configSheet.getRange('A3').setValue('上司評価フォームURL（回答用）');
  configSheet.getRange('B3').setValue(supervisorForm.getPublishedUrl());
  configSheet.getRange('A4').setValue('自己評価フォーム編集URL');
  configSheet.getRange('B4').setValue(selfForm.getEditUrl());
  configSheet.getRange('A5').setValue('上司評価フォーム編集URL');
  configSheet.getRange('B5').setValue(supervisorForm.getEditUrl());
  configSheet.autoResizeColumns(1, 2);

  ui.alert(
    '✅ フォーム作成完了',
    'スキルチェック用のGoogleフォームを2つ作成しました。\n\n'
      + '・自己評価フォーム → 「' + SHEET_SELF_RESPONSES + '」シートに回答が蓄積されます\n'
      + '・上司評価フォーム → 「' + SHEET_SUPER_RESPONSES + '」シートに回答が蓄積されます\n\n'
      + 'フォームのURLは「' + SHEET_SKILL_CONFIG + '」シートに保存しました。\n'
      + 'スタッフ・上司にURLを共有してスキルチェックを実施してもらってください。',
    ui.ButtonSet.OK
  );
}

// =====================================================
// スキルチェックフォームを1つ組み立てる
// @param options {title, description, staffNames, skillItems, isSupervisorForm}
// @return Form
// =====================================================
function buildSkillCheckForm(options) {
  var form = FormApp.create(options.title);
  form.setDescription(options.description);

  if (options.isSupervisorForm) {
    form.addListItem()
      .setTitle(FIELD_SUPER_TARGET_NAME)
      .setChoiceValues(options.staffNames)
      .setRequired(true);
    form.addTextItem()
      .setTitle(FIELD_EVALUATOR_NAME)
      .setRequired(true);
  } else {
    form.addListItem()
      .setTitle(FIELD_SELF_STAFF_NAME)
      .setChoiceValues(options.staffNames)
      .setRequired(true);
  }

  var currentCategory = null;
  options.skillItems.forEach(function(item) {
    if (item.category !== currentCategory) {
      form.addSectionHeaderItem().setTitle(item.category);
      currentCategory = item.category;
    }

    var scaleItem = form.addScaleItem();
    scaleItem.setTitle(item.name);
    if (item.description) {
      scaleItem.setHelpText(item.description);
    }
    scaleItem.setBounds(SCALE_MIN, SCALE_MAX);
    scaleItem.setLabels('できない', '完璧にできる');
    scaleItem.setRequired(true);
  });

  form.addParagraphTextItem()
    .setTitle(FIELD_COMMENT)
    .setRequired(false);

  return form;
}

// =====================================================
// フォームの回答先を現在のスプレッドシートに設定し、
// 回答シートを指定の名前にリネームする
// （既存の同名シートがある場合は別名で残す）
// =====================================================
function setFormDestination(ss, form, sheetName) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    var archiveName = sheetName + '_旧_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss');
    existing.setName(archiveName);
  }

  var beforeNames = ss.getSheets().map(function(s) { return s.getName(); });

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  var newSheet = null;
  ss.getSheets().forEach(function(s) {
    if (beforeNames.indexOf(s.getName()) === -1) {
      newSheet = s;
    }
  });
  if (newSheet) {
    newSheet.setName(sheetName);
  }
}

// =====================================================
// 「スキル項目マスタ」シートからスキル項目一覧を取得する
// @return [{category, name, description, role}]
// =====================================================
function getSkillMasterItems(ss) {
  var sheet = ss.getSheetByName(SHEET_SKILL_MASTER);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var items = [];
  data.forEach(function(row) {
    var category    = String(row[0]).trim();
    var name        = String(row[1]).trim();
    var description = String(row[2]).trim();
    var role        = String(row[3]).trim();
    if (category && name) {
      items.push({ category: category, name: name, description: description, role: role });
    }
  });
  return items;
}

// =====================================================
// 「スタッフ管理」シートのA列からスタッフ名一覧を取得する
// （カレンダーID未登録でもスキルチェックは利用可能にする）
// @return [スタッフ名, ...]
// =====================================================
function getStaffNamesForSkillCheck(ss) {
  var sheet = ss.getSheetByName(SHEET_STAFF);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var names = [];
  data.forEach(function(row) {
    var name = String(row[0]).trim();
    if (name) names.push(name);
  });
  return names;
}

// =====================================================
// 自己評価・上司評価の回答結果を集計する
// =====================================================
function aggregateSkillCheckResults() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var skillItems = getSkillMasterItems(ss);
  if (skillItems.length === 0) {
    ui.alert('⚠ スキル項目未登録', '「スキル項目マスタ」シートにスキル項目を入力してください。', ui.ButtonSet.OK);
    return;
  }

  var staffNames = getStaffNamesForSkillCheck(ss);
  if (staffNames.length === 0) {
    ui.alert('⚠ スタッフ未登録', '「スタッフ管理」シートのA列にスタッフ名を入力してください。', ui.ButtonSet.OK);
    return;
  }

  var selfSheet  = ss.getSheetByName(SHEET_SELF_RESPONSES);
  var superSheet = ss.getSheetByName(SHEET_SUPER_RESPONSES);
  if (!selfSheet || !superSheet) {
    ui.alert('⚠ フォーム未作成', '先に「スキルチェックフォームを作成する」を実行してください。', ui.ButtonSet.OK);
    return;
  }

  var selfData  = readResponseSheet(selfSheet);
  var superData = readResponseSheet(superSheet);

  // 自己評価: スタッフ名 → 最新の回答行
  var selfLatest = pickLatestByKey(selfData, FIELD_SELF_STAFF_NAME);

  // 上司評価: (評価対象スタッフ名, 評価者名) ごとの最新回答
  var superLatestList = pickLatestByCompositeKey(superData, [FIELD_SUPER_TARGET_NAME, FIELD_EVALUATOR_NAME]);

  // スタッフ名ごとに、評価者ごとの最新回答をまとめる
  var superByStaff = {};
  superLatestList.forEach(function(row) {
    var staffName = row[FIELD_SUPER_TARGET_NAME];
    if (!superByStaff[staffName]) superByStaff[staffName] = [];
    superByStaff[staffName].push(row);
  });

  var resultRows = [];
  staffNames.forEach(function(staffName) {
    var selfRow   = selfLatest[staffName];
    var superRows = superByStaff[staffName] || [];

    skillItems.forEach(function(item) {
      var selfScore = selfRow ? selfRow[item.name] : '';

      var superScores = superRows
        .map(function(r) { return r[item.name]; })
        .filter(function(v) { return v !== '' && v !== null && typeof v !== 'undefined'; })
        .map(Number);

      var superAvg = '';
      if (superScores.length > 0) {
        var sum = superScores.reduce(function(a, b) { return a + b; }, 0);
        superAvg = Math.round((sum / superScores.length) * 10) / 10;
      }

      var gap = '';
      if (selfScore !== '' && superAvg !== '') {
        gap = Math.round((Number(superAvg) - Number(selfScore)) * 10) / 10;
      }

      var selfComment = selfRow ? (selfRow[FIELD_COMMENT] || '') : '';

      var superComments = superRows
        .map(function(r) {
          var comment = r[FIELD_COMMENT];
          return comment ? (r[FIELD_EVALUATOR_NAME] + ': ' + comment) : '';
        })
        .filter(function(c) { return c; })
        .join(' / ');

      resultRows.push([
        staffName, item.category, item.name,
        selfScore, superAvg, gap,
        selfComment, superComments
      ]);
    });
  });

  outputSkillResultSheet(ss, resultRows);

  ui.alert('✅ 集計完了', 'スキルチェック結果を「' + SHEET_SKILL_RESULT + '」シートに出力しました。', ui.ButtonSet.OK);
}

// =====================================================
// フォーム回答シートを [{ヘッダー名: 値, ...}, ...] の配列として読み込む
// =====================================================
function readResponseSheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data    = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(header, i) {
      obj[header] = row[i];
    });
    return obj;
  });
}

// =====================================================
// 指定したフィールドの値をキーに、最新（最後）の行を保持したマップを返す
// @return { キー値: 行オブジェクト }
// =====================================================
function pickLatestByKey(data, keyField) {
  var map = {};
  data.forEach(function(row) {
    var key = row[keyField];
    if (key) map[key] = row;
  });
  return map;
}

// =====================================================
// 複数フィールドの組み合わせをキーに、最新（最後）の行のみ残した配列を返す
// =====================================================
function pickLatestByCompositeKey(data, keyFields) {
  var map = {};
  var order = [];
  data.forEach(function(row) {
    var key = keyFields.map(function(f) { return row[f]; }).join('||');
    if (!map[key]) order.push(key);
    map[key] = row;
  });
  return order.map(function(key) { return map[key]; });
}

// =====================================================
// 「スキルチェック結果」シートに集計結果を出力する（全クリア→全出し）
// =====================================================
function outputSkillResultSheet(ss, rows) {
  var sheet = ss.getSheetByName(SHEET_SKILL_RESULT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SKILL_RESULT);
  }

  sheet.clearContents();
  sheet.clearFormats();

  var headers = [
    'スタッフ名', 'カテゴリ', 'スキル項目',
    '自己評価', '上司評価（平均）', '乖離（上司-自己）',
    '自己評価コメント', '上司評価コメント'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4a86e8');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  if (rows.length === 0) {
    sheet.setConditionalFormatRules([]);
    return;
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);

  // 乖離（F列）が±1以上の行をハイライト
  var gapRange = sheet.getRange(2, 6, rows.length, 1);
  var rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(1)
      .setBackground('#fce8b2')
      .setRanges([gapRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThanOrEqualTo(-1)
      .setBackground('#f4cccc')
      .setRanges([gapRange])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);
}
