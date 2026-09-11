/**
 * アプリ全体で共有する定数
 * (マジックナンバーをここに集約し、各モジュールから参照する)
 */
const APP_CONFIG = Object.freeze({
  // テーブルカードの寸法 (レイアウト計算・接続線のフォールバックに使用)
  card: Object.freeze({
    width: 300,
    headerHeight: 44,
    bodyPadding: 16,
    rowHeight: 29,
    bodyMaxHeight: 380,
    fallbackHeight: 280,
  }),

  // 自動整列時の開始座標・カード間隔
  layout: Object.freeze({
    startX: 80,
    startY: 100,
    gapX: 90,
    gapY: 80,
  }),

  // ズーム範囲・感度
  zoom: Object.freeze({
    min: 0.15,
    max: 2.5,
    // ホイール: deltaY 1px あたりの対数ズーム量の既定値 (= 「標準」)。マウス 1 ノッチ ≒ 100px → 約 13%
    wheelSensitivity: 0.0012,
    // ホイール 1 イベントあたりの最大倍率 (トラックパッドの急な入力を抑える)
    wheelMaxFactor: 1.4,
    // deltaMode が行 / ページ単位のときの px 換算
    lineDeltaPx: 16,
    pageDeltaPx: 400,
    // +/- ボタン 1 回あたりの倍率の既定値 (= 「標準」)
    buttonStep: 1.2,
    // ユーザーが選べる感度 (軽い = 少ない操作で大きく動く)
    sensitivityLevels: Object.freeze([
      Object.freeze({ id: 'lightest', label: '最も軽い', wheelSensitivity: 0.0026, buttonStep: 1.3 }),
      Object.freeze({ id: 'light', label: '軽い', wheelSensitivity: 0.0018, buttonStep: 1.25 }),
      Object.freeze({ id: 'normal', label: '標準', wheelSensitivity: 0.0012, buttonStep: 1.2 }),
      Object.freeze({ id: 'heavy', label: '重い', wheelSensitivity: 0.0008, buttonStep: 1.15 }),
      Object.freeze({ id: 'heaviest', label: '最も重い', wheelSensitivity: 0.0005, buttonStep: 1.1 }),
    ]),
    defaultSensitivityId: 'normal',
    // テーブルへジャンプするとき、これより小さい倍率なら読みやすい倍率までズームイン
    focusMinScale: 0.9,
    fitMin: 0.2,
    fitMax: 1.05,
    fitPadding: 80,
  }),

  // 詳細パネル (中央寄せの最小倍率は zoom.focusMinScale を共用)
  detailPanel: Object.freeze({
    widthPx: 340,
  }),

  // 初期ビュー
  view: Object.freeze({
    scale: 0.85,
    translateX: 40,
    translateY: 40,
  }),

  // カードドラッグをクリックと区別するしきい値 (px)
  drag: Object.freeze({
    thresholdPx: 3,
  }),

  // 接続線の形状
  connection: Object.freeze({
    // 中心の横ずれがこれ以下なら上下の辺、超えれば左右の辺から線を出す
    sideThresholdPx: 80,
    // ベジェのハンドル長 (端点間距離に対する比率と最小値)。辺に垂直に出入りする
    handleRatio: 0.4,
    handleMinPx: 40,
    // 同じ辺に複数の線が集まるときの端点の間隔と、辺の端に残す余白
    anchorSpacingPx: 30,
    anchorEdgeMarginPx: 24,
    // 自己参照ループ: 右辺の高さ何割分を使うか / ハンドル長
    selfLoopSpan: 0.3,
    selfLoopHandlePx: 70,
    // クロウズフット記法の寸法 (px)
    notation: Object.freeze({
      barOffset: 12, // 「1」の縦棒: 辺からの距離
      barHalfLength: 7, // 縦棒の半分の長さ
      footLength: 16, // 三叉 (多) の奥行き
      footHalfWidth: 8, // 三叉の開き (半分)
      circleRadius: 4.5, // 「0」の丸
      circleGap: 3, // 記号と丸の隙間
    }),
  }),

  // 自動保存 (localStorage) の上限。SQL 本文がこれを超える場合は保存しない
  persistence: Object.freeze({
    maxSnapshotBytes: 1024 * 1024,
  }),

  // ファイル読み込みの上限
  fileImport: Object.freeze({
    maxFileBytes: 5 * 1024 * 1024,
  }),

  // Tailwind CDN のスタイル適用を待つための描画ディレイ (ms)
  timing: Object.freeze({
    toggleRenderMs: 50,
    parseRenderMs: 80,
    initialRenderMs: 150,
    // プログラムによるビュー移動 (全体表示 / テーブルへジャンプ) のアニメーション時間
    viewAnimationMs: 300,
    // トースト通知の表示時間
    toastMs: 2600,
    // 状態変更から自動保存までの待ち時間 (ドラッグ中の連続更新をまとめる)
    autosaveDebounceMs: 400,
  }),
});
