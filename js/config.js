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
    // ホイール: deltaY 1px あたりの対数ズーム量 (マウス 1 ノッチ ≒ 100px → 約 6%)
    wheelSensitivity: 0.0006,
    // ホイール 1 イベントあたりの最大倍率 (トラックパッドの急な入力を抑える)
    wheelMaxFactor: 1.15,
    // deltaMode が行 / ページ単位のときの px 換算
    lineDeltaPx: 16,
    pageDeltaPx: 400,
    // +/- ボタン 1 回あたりの倍率
    buttonStep: 1.1,
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
    sideThresholdPx: 80,
    curveX: 0.5,
    curveY: 0.2,
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
