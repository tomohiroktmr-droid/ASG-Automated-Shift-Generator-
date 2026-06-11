# 🐣 どうぶつタスク進捗アプリ 設計案

従業員ごとのタスク進捗を「動物アイコン」の成長段階で可視化するiOSアプリ（SwiftUI）の設計案。
今回は **アプリ内完結（外部連携なし）** で、進捗率に応じて動物が段階的に成長する形式。

---

## 1. コンセプト

- 各従業員が担当タスクの進捗（0〜100%）を入力する
- 進捗率に応じて、担当タスクの「動物アイコン」が成長していく
- 店長/管理者は一覧画面で全従業員の進捗状況を一目で把握できる
- ゲーミフィケーション要素により、入力のモチベーションを高める

---

## 2. 動物アイコンの成長ルール（進捗率連動）

進捗率に応じて5段階で動物が成長する。タスクごと・従業員の総合進捗ごとに同じルールを適用する。

| 進捗率 | 段階 | アイコン | ラベル |
|:------|:----|:-------|:------|
| 0%      | Stage 0 | 🥚 | たまご |
| 1〜25%  | Stage 1 | 🐣 | ひよこ |
| 26〜50% | Stage 2 | 🐥 | こども |
| 51〜75% | Stage 3 | 🐤 | せいちょう中 |
| 76〜99% | Stage 4 | 🐔 | もうすぐ完成 |
| 100%    | Stage 5 | 🦅／🏆 | コンプリート |

> 補足: 動物の種類はタスクのカテゴリ（接客／調理／清掃 等）ごとに変えることも可能（例: 接客タスクは鳥系、調理タスクは哺乳類系）。今回はシンプルに単一の成長ライン（卵→鳥）で統一する案とした。

---

## 3. データモデル（イメージ）

```swift
struct Employee: Identifiable {
    let id: UUID
    var name: String
    var tasks: [TaskItem]

    // 全タスクの平均進捗から算出
    var overallProgress: Double {
        guard !tasks.isEmpty else { return 0 }
        return tasks.map(\.progress).reduce(0, +) / Double(tasks.count)
    }
}

struct TaskItem: Identifiable {
    let id: UUID
    var title: String
    var progress: Double   // 0.0 ~ 1.0
    var dueDate: Date?
}

enum AnimalStage: Int {
    case egg = 0       // 🥚 0%
    case chick = 1     // 🐣 1-25%
    case junior = 2    // 🐥 26-50%
    case growing = 3   // 🐤 51-75%
    case almost = 4    // 🐔 76-99%
    case complete = 5  // 🦅 100%

    init(progress: Double) {
        switch progress {
        case 0:            self = .egg
        case ..<0.26:      self = .chick
        case ..<0.51:      self = .junior
        case ..<0.76:      self = .growing
        case ..<1.0:       self = .almost
        default:           self = .complete
        }
    }

    var emoji: String {
        switch self {
        case .egg:      return "🥚"
        case .chick:    return "🐣"
        case .junior:   return "🐥"
        case .growing:  return "🐤"
        case .almost:   return "🐔"
        case .complete: return "🦅"
        }
    }

    var label: String {
        switch self {
        case .egg:      return "たまご"
        case .chick:    return "ひよこ"
        case .junior:   return "こども"
        case .growing:  return "せいちょう中"
        case .almost:   return "もうすぐ完成"
        case .complete: return "コンプリート"
        }
    }
}
```

---

## 4. 画面構成

### 4-1. 従業員一覧画面（メイン画面）

各従業員の総合進捗を動物アイコンで一覧表示する。

```
┌──────────────────────────────────┐
│  🐾 みんなの進捗状況                │
├──────────────────────────────────┤
│  🐤  山田 太郎          進捗 65%   │
│      ────────────●───── 65%       │
│                                    │
│  🐣  佐藤 花子          進捗 20%   │
│      ──●──────────────── 20%      │
│                                    │
│  🦅  鈴木 次郎          進捗 100%  │
│      ────────────────●─ 100% ✅   │
│                                    │
│  🥚  田中 一郎          進捗 0%    │
│      ●───────────────── 0%        │
└──────────────────────────────────┘
```

- 行をタップすると従業員詳細（タスク一覧）画面へ遷移
- アイコンはリスト表示時にも進捗段階に応じてアニメーション（弾むような演出）

### 4-2. 従業員詳細画面（タスク一覧）

```
┌──────────────────────────────────┐
│ ← 山田 太郎                       │
├──────────────────────────────────┤
│   総合進捗                        │
│        🐤  65%                    │
│   ────────────●─────              │
├──────────────────────────────────┤
│  タスク一覧                        │
│                                    │
│  🦅 仕込み準備           100% ✅   │
│  🐤 ホール清掃            70%      │
│     ──────────●───                │
│  🐣 発注書チェック         15%     │
│     ──●─────────────              │
│  🥚 来月シフト希望提出       0%     │
│     ●─────────────────            │
│                                    │
│            [＋ タスクを追加]        │
└──────────────────────────────────┘
```

### 4-3. タスク編集画面

```
┌──────────────────────────────────┐
│ ← タスク編集                       │
├──────────────────────────────────┤
│  タスク名                          │
│  [ ホール清掃                  ]   │
│                                    │
│  進捗                              │
│        🐤  70%                    │
│  ─────────────●───────            │
│  (スライダーで0〜100%を調整)        │
│                                    │
│  期限                              │
│  [ 2026/06/30                  ]   │
│                                    │
│        [ 保存 ]   [ 削除 ]         │
└──────────────────────────────────┘
```

- スライダー操作中、リアルタイムで動物アイコンが変化
- 100%に到達すると🦅へ進化＋お祝いアニメーション（confetti等）

---

## 5. 画面遷移図

```
[従業員一覧]
    │ タップ
    ▼
[従業員詳細(タスク一覧)] ──「＋タスクを追加」──▶ [タスク編集(新規)]
    │ タスクをタップ
    ▼
[タスク編集(既存)]
```

---

## 6. 想定ファイル構成（次ステップで実装する場合）

```
AnimalProgressApp/
├── AnimalProgressApp.swift       // App entry point
├── Models/
│   ├── Employee.swift
│   ├── TaskItem.swift
│   └── AnimalStage.swift
├── ViewModels/
│   └── AppStore.swift            // @Observable, タスク・従業員データ管理
├── Views/
│   ├── EmployeeListView.swift    // 4-1
│   ├── EmployeeDetailView.swift  // 4-2
│   ├── TaskEditView.swift        // 4-3
│   └── Components/
│       ├── AnimalIconView.swift  // 動物アイコン+アニメーション
│       └── ProgressBarView.swift
└── Resources/
    └── Assets.xcassets           // 動物アイコン画像 (絵文字の代わりにイラスト案)
```

---

## 7. 次のステップ案

1. この設計案のレビュー・修正（動物の種類、段階数、画面項目など）
2. SwiftUIプロジェクトの新規作成（Xcodeプロジェクト一式をリポジトリに追加）
3. モックデータでの画面実装（4-1〜4-3）
4. データ永続化（UserDefaults / SwiftData）の実装
5. 動物アイコンのイラスト化（絵文字→オリジナルアイコン）
