const engine = require("../../shared/sudoku9-engine");
const session = require("../../utils/game-session");

const difficultyCards = [
  {
    key: "easy",
    title: "雅集 · 简单",
    subtitle: "36 个空格，适合先在微信里熟悉触控节奏。",
    badge: "轻松"
  },
  {
    key: "normal",
    title: "雅集 · 普通",
    subtitle: "46 个空格，作为小游戏 MVP 的默认主模式。",
    badge: "推荐"
  },
  {
    key: "hard",
    title: "雅集 · 困难",
    subtitle: "54 个空格，保留完整挑战感，适合后续冲榜。",
    badge: "挑战"
  }
];

function buildQuickStats(archive) {
  if (!archive) {
    return [
      { label: "默认模式", value: "9x9" },
      { label: "推荐难度", value: "普通" },
      { label: "当前阶段", value: "MVP" }
    ];
  }

  const remainingCount = Array.isArray(archive.current)
    ? archive.current.filter((value) => value === 0).length
    : 0;

  return [
    {
      label: "上次难度",
      value: engine.DIFFICULTIES[engine.sanitizeDifficulty(archive.difficulty)].label
    },
    {
      label: "剩余空格",
      value: String(remainingCount).padStart(2, "0")
    },
    {
      label: "累计用时",
      value: engine.formatTime(archive.elapsedMs || 0)
    }
  ];
}

Page({
  data: {
    brandTitle: "数独",
    tagline: "墨色起卷，落子成局",
    heroQuote: "先把 9x9 单机玩法在微信里跑起来，再把水墨入口、统计和登录接回来。",
    showGuide: false,
    hasSavedGame: false,
    selectedDifficulty: "normal",
    difficultyCards,
    quickStats: buildQuickStats(null),
    primaryActions: [
      { key: "start", label: "开始新局" },
      { key: "continue", label: "继续上次" }
    ],
    secondaryActions: [
      { key: "guide", label: "新手说明" },
      { key: "clear", label: "清空存档" }
    ]
  },

  onShow() {
    const archive = session.readArchive();
    this.setData({
      hasSavedGame: Boolean(archive),
      selectedDifficulty: session.readLastDifficulty(),
      quickStats: buildQuickStats(archive)
    });
  },

  handleSelectDifficulty(event) {
    const key = engine.sanitizeDifficulty(event.currentTarget.dataset.key);
    session.writeLastDifficulty(key);
    this.setData({ selectedDifficulty: key });
  },

  handlePrimaryAction(event) {
    const key = event.currentTarget.dataset.key;
    const difficulty = engine.sanitizeDifficulty(this.data.selectedDifficulty);

    if (key === "start") {
      session.writeLastDifficulty(difficulty);
      wx.navigateTo({
        url: `/pages/game/index?mode=new&difficulty=${difficulty}`
      });
      return;
    }

    if (key === "continue") {
      if (!this.data.hasSavedGame) {
        wx.showToast({
          title: "还没有可继续的棋局",
          icon: "none"
        });
        return;
      }
      wx.navigateTo({
        url: "/pages/game/index?mode=continue"
      });
    }
  },

  handleSecondaryAction(event) {
    const key = event.currentTarget.dataset.key;
    if (key === "guide") {
      const next = !this.data.showGuide;
      if (!next) {
        session.writeGuideSeen();
      }
      this.setData({ showGuide: next });
      return;
    }

    if (key === "clear") {
      if (!this.data.hasSavedGame) {
        wx.showToast({
          title: "当前没有存档",
          icon: "none"
        });
        return;
      }

      wx.showModal({
        title: "清空上次棋局",
        content: "会删除当前小游戏端保存的 9x9 进度，但不会影响网页端内容。",
        success: (result) => {
          if (!result.confirm) {
            return;
          }
          session.clearArchive();
          this.setData({
            hasSavedGame: false,
            quickStats: buildQuickStats(null)
          });
          wx.showToast({
            title: "已清空",
            icon: "success"
          });
        }
      });
    }
  }
});
