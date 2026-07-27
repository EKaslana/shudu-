const BOARD_MARGIN = 18;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, color) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, color, lineWidth) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawText(ctx, text, x, y, options = {}) {
  ctx.fillStyle = options.color || "#22313f";
  ctx.font = options.font || "16px sans-serif";
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = options.baseline || "alphabetic";
  ctx.fillText(text, x, y);
}

function wrapText(ctx, text, maxWidth) {
  const chars = String(text).split("");
  const lines = [];
  let current = "";
  chars.forEach((char) => {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  });
  if (current) {
    lines.push(current);
  }
  return lines;
}

function drawCoverImage(ctx, image, x, y, width, height, options = {}) {
  if (!image || !width || !height) {
    return false;
  }
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    return false;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;

  ctx.save();
  if (typeof options.alpha === "number") {
    ctx.globalAlpha = options.alpha;
  }
  if (options.radius) {
    roundedRect(ctx, x, y, width, height, options.radius);
    ctx.clip();
  }
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  ctx.restore();
  return true;
}

class Renderer {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = options.ctx;
    this.pixelRatio = options.pixelRatio || 1;
    this.width = options.width;
    this.height = options.height;
    this.interactives = [];
    this.assets = options.assets || {};
  }

  setViewport(width, height) {
    this.width = width;
    this.height = height;
  }

  setAssets(assets) {
    this.assets = assets || {};
  }

  hitTest(x, y) {
    for (let index = this.interactives.length - 1; index >= 0; index -= 1) {
      const item = this.interactives[index];
      if (
        x >= item.x &&
        x <= item.x + item.width &&
        y >= item.y &&
        y <= item.y + item.height
      ) {
        return item;
      }
    }
    return null;
  }

  render(snapshot) {
    const ctx = this.ctx;
    this.interactives = [];

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#f4efe5");
    gradient.addColorStop(1, "#e7ece8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.assets.landscape) {
      drawCoverImage(ctx, this.assets.landscape, 0, 0, this.width, this.height, {
        alpha: snapshot.scene === "home" ? 0.24 : 0.12
      });
      ctx.fillStyle = snapshot.scene === "home" ? "rgba(247,243,236,0.7)" : "rgba(247,243,236,0.82)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (snapshot.scene === "entry") {
      this.renderEntry(snapshot.entry);
    } else if (snapshot.scene === "home") {
      this.renderHome(snapshot.home);
    } else if (snapshot.game) {
      this.renderGame(snapshot.game);
    }
  }

  renderEntry(entry) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const scale = clamp((height - 20) / 820, 0.72, 1);
    const side = clamp(20 * scale, 14, 20);
    const heroHeight = Math.round(height * 0.34);
    const contentTop = heroHeight;
    const cardWidth = width - side * 2;
    const heroWidth = cardWidth * 0.7;
    const heroInkHeight = clamp(heroWidth * 0.46, 92, 134);
    const heroInkY = Math.max(18, heroHeight * 0.18);

    if (this.assets.titleInk) {
      drawCoverImage(
        ctx,
        this.assets.titleInk,
        (width - heroWidth) / 2,
        heroInkY,
        heroWidth,
        heroInkHeight,
        { alpha: 0.98 }
      );
    } else {
      drawText(ctx, entry.title, width / 2, heroInkY + heroInkHeight * 0.5, {
        align: "center",
        font: `700 ${Math.round(clamp(42 * scale, 30, 42))}px serif`,
        color: "#1d2d39",
        baseline: "middle"
      });
    }

    ctx.font = `${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`;
    wrapText(ctx, entry.subtitle, cardWidth - clamp(40 * scale, 28, 40)).slice(0, 2).forEach((line, index) => {
      drawText(ctx, line, width / 2, heroHeight - clamp(28 * scale, 20, 28) + index * clamp(16 * scale, 13, 16), {
        align: "center",
        font: `${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
        color: "#617582",
        baseline: "middle"
      });
    });

    fillRoundedRect(
      ctx,
      side,
      contentTop,
      cardWidth,
      height - contentTop - side,
      clamp(34 * scale, 24, 34),
      "rgba(255,255,255,0.36)"
    );

    const inset = clamp(18 * scale, 14, 18);
    const buttonHeight = clamp(82 * scale, 66, 82);
    const buttonGap = clamp(12 * scale, 10, 12);
    const statusHeight = clamp(92 * scale, 76, 92);
    let y = contentTop + clamp(20 * scale, 16, 20);

    entry.actions.forEach((action) => {
      const fillColor = action.disabled
        ? action.primary
          ? "rgba(63,93,114,0.66)"
          : "rgba(255,255,255,0.58)"
        : action.primary
          ? "#3f5d72"
          : "rgba(255,255,255,0.82)";
      fillRoundedRect(
        ctx,
        side + inset,
        y,
        cardWidth - inset * 2,
        buttonHeight,
        clamp(24 * scale, 18, 24),
        fillColor
      );
      strokeRoundedRect(
        ctx,
        side + inset,
        y,
        cardWidth - inset * 2,
        buttonHeight,
        clamp(24 * scale, 18, 24),
        action.disabled ? "rgba(67,96,116,0.12)" : action.primary ? "#b49a63" : "rgba(67,96,116,0.14)",
        2
      );
      drawText(ctx, action.title, width / 2, y + buttonHeight * 0.38, {
        align: "center",
        font: `700 ${Math.round(clamp(22 * scale, 17, 22))}px sans-serif`,
        color: action.disabled ? (action.primary ? "rgba(255,255,255,0.82)" : "#6f7f8b") : action.primary ? "#ffffff" : "#213240",
        baseline: "middle"
      });
      drawText(ctx, action.subtitle, width / 2, y + buttonHeight * 0.7, {
        align: "center",
        font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
        color: action.disabled ? "rgba(106,121,134,0.86)" : action.primary ? "rgba(255,255,255,0.82)" : "#6a7986",
        baseline: "middle"
      });
      if (!action.disabled) {
        this.interactives.push({
          type: "entry-action",
          value: action.key,
          x: side + inset,
          y,
          width: cardWidth - inset * 2,
          height: buttonHeight
        });
      }
      y += buttonHeight + buttonGap;
    });

    fillRoundedRect(
      ctx,
      side + inset,
      y + clamp(4 * scale, 2, 4),
      cardWidth - inset * 2,
      statusHeight,
      clamp(22 * scale, 16, 22),
      "rgba(244,241,236,0.88)"
    );
    ctx.font = `${Math.round(clamp(13 * scale, 10, 13))}px sans-serif`;
    wrapText(ctx, entry.status, cardWidth - inset * 2 - clamp(32 * scale, 24, 32)).slice(0, 4).forEach((line, index) => {
      drawText(
        ctx,
        line,
        side + inset + clamp(16 * scale, 12, 16),
        y + clamp(24 * scale, 18, 24) + index * clamp(18 * scale, 14, 18),
        {
          font: `${Math.round(clamp(13 * scale, 10, 13))}px sans-serif`,
          color: entry.statusTone === "warning" ? "#8a5a28" : "#566978",
          baseline: "middle"
        }
      );
    });
  }

  renderHome(home) {
    const ctx = this.ctx;
    const width = this.width;
    const expandedPanel = home.showGuide;
    const scale = clamp((this.height - 18) / (expandedPanel ? 800 : 650), 0.72, 1);
    const side = clamp(18 * scale, 12, 18);
    const gap = clamp(10 * scale, 7, 10);
    const cardWidth = width - side * 2;
    const buttonGap = clamp(14 * scale, 10, 14);
    const buttonWidth = (cardWidth - buttonGap) / 2;
    const topZoneHeight = Math.round(this.height * 0.4);
    const bottomZoneY = topZoneHeight;

    const titleArtWidth = cardWidth * 0.68;
    const titleArtHeight = clamp(titleArtWidth * 0.5, 86, 124);
    const titleArtY = Math.max(10, Math.round(topZoneHeight * 0.48 - titleArtHeight * 0.5));
    if (this.assets.titleInk && drawCoverImage(ctx, this.assets.titleInk, (width - titleArtWidth) / 2, titleArtY, titleArtWidth, titleArtHeight, { alpha: 0.98 })) {
      // Keep the hero fully inside the upper third.
    } else {
      drawText(ctx, home.title, width / 2, titleArtY + clamp(26 * scale, 22, 26), {
        align: "center",
        font: `700 ${Math.round(clamp(40 * scale, 30, 40))}px serif`,
        color: "#1d2d39",
        baseline: "middle"
      });
    }

    drawText(ctx, home.status, width / 2, topZoneHeight - clamp(12 * scale, 10, 12), {
      align: "center",
      font: `600 ${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
      color: "#627784",
      baseline: "middle"
    });

    fillRoundedRect(
      ctx,
      side,
      bottomZoneY + clamp(2 * scale, 2, 4),
      cardWidth,
      this.height - bottomZoneY - clamp(16 * scale, 12, 16),
      clamp(30 * scale, 22, 30),
      "rgba(255,255,255,0.34)"
    );

    let y = bottomZoneY + clamp(18 * scale, 14, 20);

    const versionGap = clamp(10 * scale, 8, 10);
    const versionHeight = clamp(52 * scale, 40, 52);
    const versionWidth = (cardWidth - versionGap) / 2;
    home.versionCards.forEach((card, index) => {
      const x = side + index * (versionWidth + versionGap);
      fillRoundedRect(
        ctx,
        x,
        y,
        versionWidth,
        versionHeight,
        clamp(20 * scale, 14, 20),
        card.active ? "rgba(67,96,116,0.94)" : "rgba(255,255,255,0.72)"
      );
      strokeRoundedRect(
        ctx,
        x,
        y,
        versionWidth,
        versionHeight,
        clamp(20 * scale, 14, 20),
        card.active ? "#b49a63" : "rgba(67, 96, 116, 0.12)",
        2
      );
      drawText(ctx, card.title, x + clamp(16 * scale, 12, 16), y + versionHeight * 0.34, {
        font: `700 ${Math.round(clamp(16 * scale, 12, 16))}px sans-serif`,
        color: card.active ? "#f8f3eb" : "#223240",
        baseline: "middle"
      });
      drawText(ctx, card.subtitle, x + clamp(16 * scale, 12, 16), y + versionHeight * 0.7, {
        font: `${Math.round(clamp(11 * scale, 9, 11))}px sans-serif`,
        color: card.active ? "rgba(248,243,235,0.82)" : "#6a7986",
        baseline: "middle"
      });
      this.interactives.push({ type: "version", value: card.key, x, y, width: versionWidth, height: versionHeight });
    });
    y += versionHeight + clamp(14 * scale, 10, 14);

    const cardHeight = clamp(74 * scale, 58, 74);
    home.difficultyCards.forEach((card, index) => {
      const x = side;
      const cardY = y + index * (cardHeight + gap);
      fillRoundedRect(ctx, x, cardY, cardWidth, cardHeight, clamp(24 * scale, 18, 24), card.active ? "rgba(42, 60, 74, 0.94)" : "rgba(255,255,255,0.8)");
      strokeRoundedRect(ctx, x, cardY, cardWidth, cardHeight, clamp(24 * scale, 18, 24), card.active ? "#b49a63" : "rgba(67, 96, 116, 0.12)", 2);
      drawText(ctx, card.title, x + clamp(20 * scale, 14, 20), cardY + cardHeight * 0.34, {
        font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
        color: card.active ? "#f8f3eb" : "#1f303c",
        baseline: "middle"
      });
      drawText(ctx, card.subtitle, x + clamp(20 * scale, 14, 20), cardY + cardHeight * 0.68, {
        font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
        color: card.active ? "rgba(248,243,235,0.82)" : "#687785",
        baseline: "middle"
      });
      drawText(ctx, card.badge, x + cardWidth - clamp(18 * scale, 14, 18), cardY + cardHeight * 0.34, {
        align: "right",
        font: `700 ${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
        color: card.active ? "#d6be88" : "#907746",
        baseline: "middle"
      });
      this.interactives.push({ type: "difficulty", value: card.key, x, y: cardY, width: cardWidth, height: cardHeight });
    });
    y += home.difficultyCards.length * cardHeight + (home.difficultyCards.length - 1) * gap + clamp(16 * scale, 12, 18);

    const buttonHeight = clamp(58 * scale, 46, 58);
    fillRoundedRect(ctx, side, y, buttonWidth, buttonHeight, clamp(22 * scale, 16, 22), "#436074");
    fillRoundedRect(ctx, side + buttonWidth + buttonGap, y, buttonWidth, buttonHeight, clamp(22 * scale, 16, 22), home.hasArchive ? "#f8f4eb" : "rgba(248,244,235,0.55)");
    drawText(ctx, "开始新局", side + buttonWidth / 2, y + buttonHeight / 2 + 1, {
      align: "center",
      font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
      color: "#ffffff",
      baseline: "middle"
    });
    drawText(ctx, home.hasArchive ? "继续上次" : "暂无存档", side + buttonWidth + buttonGap + buttonWidth / 2, y + buttonHeight / 2 + 1, {
      align: "center",
      font: `700 ${Math.round(clamp(17 * scale, 13, 17))}px sans-serif`,
      color: home.hasArchive ? "#233543" : "#8b989f",
      baseline: "middle"
    });
    this.interactives.push({ type: "home-action", value: "start", x: side, y, width: buttonWidth, height: buttonHeight });
    this.interactives.push({ type: "home-action", value: "continue", x: side + buttonWidth + buttonGap, y, width: buttonWidth, height: buttonHeight });

    y += buttonHeight + clamp(14 * scale, 10, 14);
    const utilityY = y;
    const utilityWidth = clamp(90 * scale, 76, 90);
    const utilityHeight = clamp(24 * scale, 20, 24);
    const utilityTextY = utilityY + utilityHeight / 2;
    const leftUtilityX = width / 2 - clamp(72 * scale, 58, 72);
    const rightUtilityX = width / 2 + clamp(72 * scale, 58, 72);
    drawText(ctx, home.showGuide ? "收起说明" : "查看说明", leftUtilityX, utilityTextY, {
      align: "center",
      font: `600 ${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
      color: "#6d7f8e",
      baseline: "middle"
    });
    drawText(ctx, home.showStats ? "收起统计" : "对局统计", rightUtilityX, utilityTextY, {
      align: "center",
      font: `600 ${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
      color: "#6d7f8e",
      baseline: "middle"
    });
    this.interactives.push({ type: "home-action", value: "guide", x: leftUtilityX - utilityWidth / 2, y: utilityY, width: utilityWidth, height: utilityHeight });
    this.interactives.push({ type: "home-action", value: "stats", x: rightUtilityX - utilityWidth / 2, y: utilityY, width: utilityWidth, height: utilityHeight });

    if (home.showGuide) {
      y += utilityHeight + clamp(10 * scale, 8, 10);
      const guideHeight = clamp(94 * scale, 74, 94);
      fillRoundedRect(ctx, side, y, cardWidth, guideHeight, clamp(24 * scale, 18, 24), "rgba(255,255,255,0.7)");
      ctx.font = `${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`;
      wrapText(ctx, "首页负责选难度与续局；对局页支持落子、笔记、提示、存档、读档与暂停。", cardWidth - clamp(36 * scale, 28, 36)).slice(0, 3).forEach((line, index) => {
        drawText(ctx, line, side + clamp(18 * scale, 14, 18), y + clamp(24 * scale, 20, 24) + index * clamp(18 * scale, 15, 18), {
          font: `${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
          color: "#4b5c67",
          baseline: "middle"
        });
      });
    }

    if (home.showStats) {
      ctx.fillStyle = "rgba(231,236,232,0.58)";
      ctx.fillRect(0, 0, width, this.height);
      this.interactives.push({ type: "overlay", x: 0, y: 0, width, height: this.height });

      const panel = home.statsPanel;
      const dialogWidth = Math.min(width - side * 2, clamp(cardWidth + 8, 280, 380));
      const dialogHeight = Math.min(this.height - clamp(28 * scale, 20, 28), clamp(this.height * 0.54, 332, 430));
      const dialogX = (width - dialogWidth) / 2;
      const dialogY = (this.height - dialogHeight) / 2;
      const inset = clamp(18 * scale, 14, 18);
      const contentWidth = dialogWidth - inset * 2;
      fillRoundedRect(ctx, dialogX, dialogY, dialogWidth, dialogHeight, clamp(26 * scale, 20, 26), "rgba(244,241,236,0.98)");

      drawText(ctx, panel.title, dialogX + inset, dialogY + clamp(28 * scale, 22, 28), {
        font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
        color: "#213240",
        baseline: "middle"
      });
      drawText(ctx, panel.subtitle, dialogX + inset, dialogY + clamp(50 * scale, 40, 50), {
        font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
        color: "#647684",
        baseline: "middle"
      });

      const summaryTop = dialogY + clamp(70 * scale, 56, 70);
      const summaryGap = clamp(8 * scale, 6, 8);
      const summaryColumns = 2;
      const summaryRows = 2;
      const summaryCardWidth = (contentWidth - summaryGap) / summaryColumns;
      const summaryCardHeight = clamp(58 * scale, 48, 58);
      panel.summary.forEach((item, index) => {
        const row = Math.floor(index / summaryColumns);
        const col = index % summaryColumns;
        const x = dialogX + inset + col * (summaryCardWidth + summaryGap);
        const yCard = summaryTop + row * (summaryCardHeight + summaryGap);
        fillRoundedRect(ctx, x, yCard, summaryCardWidth, summaryCardHeight, clamp(16 * scale, 12, 16), "rgba(255,255,255,0.86)");
        drawText(ctx, item.label, x + clamp(14 * scale, 11, 14), yCard + clamp(18 * scale, 15, 18), {
          font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
          color: "#7a8995",
          baseline: "middle"
        });
        drawText(ctx, item.value, x + clamp(14 * scale, 11, 14), yCard + clamp(40 * scale, 33, 40), {
          font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
          color: "#223240",
          baseline: "middle"
        });
      });

      const tableTop = summaryTop + summaryRows * summaryCardHeight + (summaryRows - 1) * summaryGap + clamp(18 * scale, 14, 18);
      drawText(ctx, "难度分布", dialogX + inset, tableTop, {
        font: `700 ${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
        color: "#8a6a34",
        baseline: "middle"
      });
      const headerY = tableTop + clamp(20 * scale, 16, 20);
      drawText(ctx, "难度", dialogX + inset, headerY, {
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "开局", dialogX + dialogWidth * 0.54, headerY, {
        align: "center",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "胜局", dialogX + dialogWidth * 0.72, headerY, {
        align: "center",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "最佳", dialogX + dialogWidth - inset, headerY, {
        align: "right",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });

      const rowHeight = clamp(26 * scale, 22, 26);
      panel.rows.forEach((row, index) => {
        const rowY = headerY + clamp(18 * scale, 14, 18) + index * rowHeight;
        ctx.strokeStyle = "rgba(67,96,116,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dialogX + inset, rowY + rowHeight / 2);
        ctx.lineTo(dialogX + dialogWidth - inset, rowY + rowHeight / 2);
        ctx.stroke();

        drawText(ctx, row.label, dialogX + inset, rowY, {
          font: `700 ${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#223240",
          baseline: "middle"
        });
        drawText(ctx, String(row.started), dialogX + dialogWidth * 0.54, rowY, {
          align: "center",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
        drawText(ctx, String(row.wins), dialogX + dialogWidth * 0.72, rowY, {
          align: "center",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
        drawText(ctx, row.bestTime, dialogX + dialogWidth - inset, rowY, {
          align: "right",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
      });

      ctx.font = `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`;
      wrapText(ctx, panel.footer, contentWidth).slice(0, 2).forEach((line, index) => {
        drawText(ctx, line, dialogX + inset, dialogY + dialogHeight - clamp(50 * scale, 42, 50) + index * clamp(15 * scale, 13, 15), {
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#647684",
          baseline: "middle"
        });
      });

      const closeWidth = clamp(88 * scale, 78, 88);
      const closeHeight = clamp(34 * scale, 30, 34);
      const closeX = dialogX + dialogWidth - inset - closeWidth;
      const closeY = dialogY + dialogHeight - closeHeight - clamp(10 * scale, 8, 10);
      fillRoundedRect(ctx, closeX, closeY, closeWidth, closeHeight, clamp(14 * scale, 12, 14), "#436074");
      drawText(ctx, "收起统计", closeX + closeWidth / 2, closeY + closeHeight / 2 + 1, {
        align: "center",
        font: `700 ${Math.round(clamp(12 * scale, 11, 12))}px sans-serif`,
        color: "#ffffff",
        baseline: "middle"
      });
      this.interactives.push({ type: "home-action", value: "stats", x: closeX, y: closeY, width: closeWidth, height: closeHeight });
    }
  }

  renderGame(game) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const scale = clamp((height - 20) / 1040, 0.58, 1);
    const side = clamp(18 * scale, 12, 18);
    const gap = clamp(10 * scale, 6, 10);
    const padGap = gap;
    const topY = clamp(24 * scale, 18, 24);
    const titleSize = Math.round(clamp(24 * scale, 18, 24));
    const timeSize = Math.round(clamp(22 * scale, 18, 22));
    const statusHeight = clamp(50 * scale, 38, 50);
    const statusFont = Math.round(clamp(15 * scale, 12, 15));
    const compactActions = height < 760;
    const actionColumns = compactActions ? 4 : 3;
    const actionHeight = clamp(46 * scale, compactActions ? 32 : 36, 46);
    const isMiniBoard = game.gridSize === 4;
    const numberPadColumns = isMiniBoard ? 4 : 3;
    const numberPadRows = Math.ceil(game.numberPad.length / numberPadColumns);
    const numberPadHeight = clamp((isMiniBoard ? 62 : 56) * scale, isMiniBoard ? 44 : 38, isMiniBoard ? 62 : 56);
    const messageHeight = compactActions ? clamp(44 * scale, 36, 44) : clamp(60 * scale, 48, 60);
    const titleBlockWidth = clamp(width * 0.34, 106, 138);
    const titleBlockHeight = clamp(titleBlockWidth * 0.42, 42, 56);

    if (this.assets.titleInk && drawCoverImage(ctx, this.assets.titleInk, side, topY - 4, titleBlockWidth, titleBlockHeight, { alpha: 0.98 })) {
      drawText(ctx, game.difficultyLabel, side + titleBlockWidth + 8, topY + titleBlockHeight / 2 - 1, {
        font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
        color: "#4e6470",
        baseline: "middle"
      });
      drawText(ctx, game.versionLabel, side + titleBlockWidth + 8, topY + titleBlockHeight / 2 - clamp(18 * scale, 12, 18), {
        font: `600 ${Math.round(clamp(11 * scale, 9, 11))}px sans-serif`,
        color: "#7a8892",
        baseline: "middle"
      });
    } else {
      drawText(ctx, `数独 · ${game.versionLabel}`, side + 4, topY + titleBlockHeight / 2 - clamp(10 * scale, 8, 10), {
        font: `700 ${titleSize}px sans-serif`,
        color: "#213240",
        baseline: "middle"
      });
      drawText(ctx, game.difficultyLabel, side + 4, topY + titleBlockHeight / 2 + clamp(14 * scale, 10, 14), {
        font: `600 ${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
        color: "#4e6470",
        baseline: "middle"
      });
    }
    drawText(ctx, game.elapsedLabel, width - side - 4, topY + titleBlockHeight / 2 - 2, {
      align: "right",
      font: `700 ${timeSize}px sans-serif`,
      color: "#436074",
      baseline: "middle"
    });
    const statusY = topY + titleBlockHeight + gap;

    fillRoundedRect(ctx, side, statusY, width - side * 2, statusHeight, clamp(18 * scale, 14, 18), "rgba(255,255,255,0.74)");
    drawText(ctx, `失误 ${game.mistakesLabel} · 当前格 ${game.selectedCellValue}`, side + clamp(16 * scale, 12, 16), statusY + statusHeight / 2, {
      font: `${statusFont}px sans-serif`,
      color: "#5b6a78",
      baseline: "middle"
    });

    const boardY = statusY + statusHeight + gap + clamp(6 * scale, 4, 6);
    const actionRows = Math.ceil(game.actions.length / actionColumns);
    const reservedBelowBoard =
      gap +
      numberPadHeight * numberPadRows +
      padGap * Math.max(0, numberPadRows - 1) +
      gap +
      actionHeight * actionRows +
      gap * Math.max(0, actionRows - 1) +
      gap +
      messageHeight +
      side;
    const boardSize = clamp(
      Math.min(width - side * 2, height - boardY - reservedBelowBoard),
      isMiniBoard ? (compactActions ? 296 : 320) : (compactActions ? 268 : 240),
      width - side * 2
    );
    const boardX = (width - boardSize) / 2;
    const cellSize = boardSize / game.gridSize;

    fillRoundedRect(ctx, boardX - clamp(8 * scale, 6, 8), boardY - clamp(8 * scale, 6, 8), boardSize + clamp(16 * scale, 12, 16), boardSize + clamp(16 * scale, 12, 16), clamp(22 * scale, 16, 22), "rgba(255,255,255,0.64)");
    ctx.fillStyle = "#2f4056";
    ctx.fillRect(boardX, boardY, boardSize, boardSize);

    game.boardCells.forEach((cell) => {
      const row = Math.floor(cell.index / game.gridSize);
      const col = cell.index % game.gridSize;
      const x = boardX + col * cellSize;
      const y = boardY + row * cellSize;
      let fill = "#ffffff";
      if (cell.given) fill = "#edf1f6";
      if (cell.related) fill = "#e4ebe7";
      if (cell.match) fill = "#efe1be";
      if (cell.error) fill = "#fae3e2";
      if (cell.selected) fill = "#d7e8e2";
      ctx.fillStyle = fill;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      if (cell.value) {
        drawText(ctx, cell.value, x + cellSize / 2, y + cellSize / 2 + 1, {
          align: "center",
          baseline: "middle",
          font: `${cell.given ? "700" : "600"} ${Math.round(clamp(cellSize * 0.52, 16, 22))}px sans-serif`,
          color: cell.given ? "#1b2633" : "#345064"
        });
      } else {
        cell.noteRows.forEach((noteRow, rowIndex) => {
          noteRow.forEach((noteText, colIndex) => {
            if (!noteText) return;
            drawText(
              ctx,
              noteText,
              x + cellSize * 0.2 + colIndex * ((cellSize - cellSize * 0.4) / 2),
              y + cellSize * 0.2 + rowIndex * ((cellSize - cellSize * 0.4) / 2),
              {
                font: `${Math.round(clamp(cellSize * 0.22, 8, 10))}px sans-serif`,
                color: "#74818d",
                baseline: "middle"
              }
            );
          });
        });
      }

      this.interactives.push({ type: "cell", value: cell.index, x, y, width: cellSize, height: cellSize });
    });

    ctx.strokeStyle = "#2f4056";
    for (let index = 0; index <= game.gridSize; index += 1) {
      ctx.lineWidth = index % game.boxSize === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(boardX + index * cellSize, boardY);
      ctx.lineTo(boardX + index * cellSize, boardY + boardSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(boardX, boardY + index * cellSize);
      ctx.lineTo(boardX + boardSize, boardY + index * cellSize);
      ctx.stroke();
    }

    const padY = boardY + boardSize + gap;
    const padWidth = (width - side * 2 - padGap * (numberPadColumns - 1)) / numberPadColumns;
    game.numberPad.forEach((number, index) => {
      const row = Math.floor(index / numberPadColumns);
      const col = index % numberPadColumns;
      const x = side + col * (padWidth + padGap);
      const y = padY + row * (numberPadHeight + padGap);
      fillRoundedRect(ctx, x, y, padWidth, numberPadHeight, clamp(18 * scale, 14, 18), number.active ? "#2d4254" : number.complete ? "#efe1be" : "rgba(255,255,255,0.78)");
      drawText(ctx, String(number.value), x + clamp(18 * scale, 14, 18), y + numberPadHeight / 2 + 1, {
        font: `700 ${Math.round(clamp(24 * scale, 18, 24))}px sans-serif`,
        color: number.active ? "#ffffff" : "#223240",
        baseline: "middle"
      });
      drawText(ctx, `剩 ${number.remaining}`, x + padWidth - clamp(14 * scale, 10, 14), y + numberPadHeight / 2 + 1, {
        align: "right",
        font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
        color: number.active ? "rgba(255,255,255,0.8)" : "#687785",
        baseline: "middle"
      });
      this.interactives.push({ type: "number", value: number.value, x, y, width: padWidth, height: numberPadHeight });
    });

    const actionY = padY + numberPadRows * numberPadHeight + Math.max(0, numberPadRows - 1) * padGap + gap;
    const actionWidth = (width - side * 2 - padGap * (actionColumns - 1)) / actionColumns;
    game.actions.forEach((action, index) => {
      const row = Math.floor(index / actionColumns);
      const col = index % actionColumns;
      const x = side + col * (actionWidth + padGap);
      const y = actionY + row * (actionHeight + padGap);
      const isSecondaryAction = action.key === "guide" || action.key === "pause" || action.key === "home";
      fillRoundedRect(ctx, x, y, actionWidth, actionHeight, clamp(16 * scale, 12, 16), isSecondaryAction ? "rgba(248,244,235,0.72)" : "#436074");
      drawText(ctx, action.label, x + actionWidth / 2, y + actionHeight / 2 + 1, {
        align: "center",
        font: `700 ${Math.round(clamp(16 * scale, 11, 16))}px sans-serif`,
        color: isSecondaryAction ? "#213240" : "#ffffff",
        baseline: "middle"
      });
      this.interactives.push({ type: "action", value: action.key, x, y, width: actionWidth, height: actionHeight });
    });

    const messageY = actionY + actionRows * (actionHeight + padGap);
    fillRoundedRect(ctx, side, messageY, width - side * 2, messageHeight, clamp(18 * scale, 14, 18), "rgba(255,255,255,0.72)");
    ctx.font = `${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`;
    wrapText(ctx, game.lastMessage, width - side * 2 - clamp(34 * scale, 24, 34)).slice(0, height < 760 ? 1 : 2).forEach((line, index) => {
      drawText(ctx, line, side + clamp(16 * scale, 12, 16), messageY + clamp(18 * scale, 15, 18) + index * clamp(18 * scale, 15, 18), {
        font: `${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
        color: game.lastMessageTone === "error" ? "#a2453f" : game.lastMessageTone === "success" ? "#2c6a59" : "#556775",
        baseline: "middle"
      });
    });

    if (game.showStats) {
      ctx.fillStyle = "rgba(231,236,232,0.58)";
      ctx.fillRect(0, 0, width, height);
      this.interactives.push({ type: "overlay", x: 0, y: 0, width, height });

      const panel = game.statsPanel;
      const dialogWidth = Math.min(width - side * 2, clamp(boardSize + 40, 300, 388));
      const dialogHeight = Math.min(height - clamp(28 * scale, 20, 28), clamp(height * 0.56, 336, 436));
      const dialogX = (width - dialogWidth) / 2;
      const dialogY = (height - dialogHeight) / 2;
      const inset = clamp(18 * scale, 14, 18);
      const contentWidth = dialogWidth - inset * 2;
      fillRoundedRect(ctx, dialogX, dialogY, dialogWidth, dialogHeight, clamp(26 * scale, 20, 26), "rgba(244,241,236,0.98)");

      drawText(ctx, panel.title, dialogX + inset, dialogY + clamp(28 * scale, 22, 28), {
        font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
        color: "#213240",
        baseline: "middle"
      });
      drawText(ctx, panel.subtitle, dialogX + inset, dialogY + clamp(50 * scale, 40, 50), {
        font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
        color: "#647684",
        baseline: "middle"
      });

      const summaryTop = dialogY + clamp(70 * scale, 56, 70);
      const summaryGap = clamp(8 * scale, 6, 8);
      const summaryColumns = 2;
      const summaryRows = 2;
      const summaryCardWidth = (contentWidth - summaryGap) / summaryColumns;
      const summaryCardHeight = clamp(58 * scale, 48, 58);
      panel.summary.forEach((item, index) => {
        const row = Math.floor(index / summaryColumns);
        const col = index % summaryColumns;
        const x = dialogX + inset + col * (summaryCardWidth + summaryGap);
        const yCard = summaryTop + row * (summaryCardHeight + summaryGap);
        fillRoundedRect(ctx, x, yCard, summaryCardWidth, summaryCardHeight, clamp(16 * scale, 12, 16), "rgba(255,255,255,0.86)");
        drawText(ctx, item.label, x + clamp(14 * scale, 11, 14), yCard + clamp(18 * scale, 15, 18), {
          font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
          color: "#7a8995",
          baseline: "middle"
        });
        drawText(ctx, item.value, x + clamp(14 * scale, 11, 14), yCard + clamp(40 * scale, 33, 40), {
          font: `700 ${Math.round(clamp(18 * scale, 14, 18))}px sans-serif`,
          color: "#223240",
          baseline: "middle"
        });
      });

      const tableTop = summaryTop + summaryRows * summaryCardHeight + (summaryRows - 1) * summaryGap + clamp(18 * scale, 14, 18);
      drawText(ctx, "难度分布", dialogX + inset, tableTop, {
        font: `700 ${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
        color: "#8a6a34",
        baseline: "middle"
      });
      const headerY = tableTop + clamp(20 * scale, 16, 20);
      drawText(ctx, "难度", dialogX + inset, headerY, {
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "开局", dialogX + dialogWidth * 0.54, headerY, {
        align: "center",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "胜局", dialogX + dialogWidth * 0.72, headerY, {
        align: "center",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });
      drawText(ctx, "最佳", dialogX + dialogWidth - inset, headerY, {
        align: "right",
        font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
        color: "#7b8a96",
        baseline: "middle"
      });

      const rowHeight = clamp(26 * scale, 22, 26);
      panel.rows.forEach((row, index) => {
        const rowY = headerY + clamp(18 * scale, 14, 18) + index * rowHeight;
        ctx.strokeStyle = "rgba(67,96,116,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dialogX + inset, rowY + rowHeight / 2);
        ctx.lineTo(dialogX + dialogWidth - inset, rowY + rowHeight / 2);
        ctx.stroke();

        drawText(ctx, row.label, dialogX + inset, rowY, {
          font: `700 ${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#223240",
          baseline: "middle"
        });
        drawText(ctx, String(row.started), dialogX + dialogWidth * 0.54, rowY, {
          align: "center",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
        drawText(ctx, String(row.wins), dialogX + dialogWidth * 0.72, rowY, {
          align: "center",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
        drawText(ctx, row.bestTime, dialogX + dialogWidth - inset, rowY, {
          align: "right",
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#556775",
          baseline: "middle"
        });
      });

      ctx.font = `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`;
      wrapText(ctx, panel.footer, contentWidth).slice(0, 2).forEach((line, index) => {
        drawText(ctx, line, dialogX + inset, dialogY + dialogHeight - clamp(50 * scale, 42, 50) + index * clamp(15 * scale, 13, 15), {
          font: `${Math.round(clamp(12 * scale, 10, 12))}px sans-serif`,
          color: "#647684",
          baseline: "middle"
        });
      });

      const closeWidth = clamp(92 * scale, 80, 92);
      const closeHeight = clamp(34 * scale, 30, 34);
      const closeX = dialogX + dialogWidth - inset - closeWidth;
      const closeY = dialogY + dialogHeight - closeHeight - clamp(10 * scale, 8, 10);
      fillRoundedRect(ctx, closeX, closeY, closeWidth, closeHeight, clamp(14 * scale, 12, 14), "#436074");
      drawText(ctx, game.gameEnded ? "返回结算" : "收起统计", closeX + closeWidth / 2, closeY + closeHeight / 2 + 1, {
        align: "center",
        font: `700 ${Math.round(clamp(12 * scale, 11, 12))}px sans-serif`,
        color: "#ffffff",
        baseline: "middle"
      });
      this.interactives.push({ type: "action", value: "stats", x: closeX, y: closeY, width: closeWidth, height: closeHeight });
    } else if (game.showGuide) {
      ctx.fillStyle = "rgba(231,236,232,0.58)";
      ctx.fillRect(0, 0, width, height);
      this.interactives.push({ type: "overlay", x: 0, y: 0, width, height });

      const dialogWidth = Math.min(width - side * 2, boardSize + clamp(34 * scale, 28, 34));
      const listRowHeight = clamp(28 * scale, 22, 28);
      const overlayGap = clamp(10 * scale, 8, 10);
      const overlayButtonHeight = clamp(40 * scale, 34, 40);
      const headerHeight = clamp(64 * scale, 52, 64);
      const footerHeight = overlayButtonHeight + overlayGap * 2;
      const listHeight = game.guideItems.length * listRowHeight;
      const dialogHeight = Math.min(
        height - topY - clamp(26 * scale, 18, 26),
        headerHeight + listHeight + footerHeight + clamp(16 * scale, 12, 16)
      );
      const dialogX = (width - dialogWidth) / 2;
      const dialogY = Math.max(topY + clamp(10 * scale, 8, 10), (height - dialogHeight) / 2);
      const contentX = dialogX + clamp(18 * scale, 14, 18);
      const contentWidth = dialogWidth - clamp(36 * scale, 28, 36);
      fillRoundedRect(ctx, dialogX, dialogY, dialogWidth, dialogHeight, clamp(24 * scale, 18, 24), "rgba(244,241,236,0.98)");

      drawText(ctx, "对局说明", dialogX + dialogWidth / 2, dialogY + clamp(26 * scale, 22, 26), {
        align: "center",
        font: `700 ${Math.round(clamp(22 * scale, 17, 22))}px sans-serif`,
        color: "#213240",
        baseline: "middle"
      });
      drawText(ctx, "每个按钮都在这里逐条说明。", dialogX + dialogWidth / 2, dialogY + clamp(50 * scale, 42, 50), {
        align: "center",
        font: `${Math.round(clamp(13 * scale, 10, 13))}px sans-serif`,
        color: "#5c6d79",
        baseline: "middle"
      });

      const listTop = dialogY + headerHeight;
      game.guideItems.forEach((item, index) => {
        const rowY = listTop + index * listRowHeight;
        if (index < game.guideItems.length - 1) {
          ctx.strokeStyle = "rgba(67,96,116,0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(contentX, rowY + listRowHeight - 1);
          ctx.lineTo(contentX + contentWidth, rowY + listRowHeight - 1);
          ctx.stroke();
        }

        drawText(ctx, item.label, contentX, rowY + listRowHeight / 2, {
          font: `700 ${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
          color: "#8a6a34",
          baseline: "middle"
        });
        drawText(ctx, item.detail, contentX + clamp(52 * scale, 44, 52), rowY + listRowHeight / 2, {
          font: `${Math.round(clamp(11 * scale, 9, 11))}px sans-serif`,
          color: "#51636f",
          baseline: "middle"
        });
      });

      const buttonWidth = contentWidth;
      const buttonX = contentX;
      const buttonY = dialogY + dialogHeight - overlayButtonHeight - overlayGap;
      fillRoundedRect(ctx, buttonX, buttonY, buttonWidth, overlayButtonHeight, clamp(16 * scale, 12, 16), "#436074");
      drawText(ctx, "知道了", buttonX + buttonWidth / 2, buttonY + overlayButtonHeight / 2 + 1, {
        align: "center",
        font: `700 ${Math.round(clamp(15 * scale, 12, 15))}px sans-serif`,
        color: "#ffffff",
        baseline: "middle"
      });
      this.interactives.push({ type: "action", value: "guide", x: buttonX, y: buttonY, width: buttonWidth, height: overlayButtonHeight });
    } else if (game.paused || game.gameEnded) {
      ctx.fillStyle = "rgba(231,236,232,0.45)";
      ctx.fillRect(0, 0, width, height);
      this.interactives.push({ type: "overlay", x: 0, y: 0, width, height });

      const settlement = game.settlement;
      const dialogWidth = Math.min(boardSize - clamp(28 * scale, 20, 28), width - side * 2 - 8);
      const dialogHeight = game.paused ? clamp(134 * scale, 108, 134) : clamp(266 * scale, 220, 266);
      const dialogX = (width - dialogWidth) / 2;
      const dialogY = boardY + boardSize / 2 - dialogHeight / 2;
      fillRoundedRect(ctx, dialogX, dialogY, dialogWidth, dialogHeight, clamp(24 * scale, 18, 24), "rgba(244,241,236,0.96)");
      drawText(ctx, game.paused ? "已暂停" : settlement.title, dialogX + dialogWidth / 2, dialogY + clamp(34 * scale, 28, 34), {
        align: "center",
        font: `700 ${Math.round(clamp(24 * scale, 18, 24))}px sans-serif`,
        color: "#213240",
        baseline: "middle"
      });
      drawText(ctx, game.paused ? "点“继续”即可回到棋盘" : settlement.subtitle, dialogX + dialogWidth / 2, dialogY + clamp(62 * scale, 52, 62), {
        align: "center",
        font: `${Math.round(clamp(14 * scale, 11, 14))}px sans-serif`,
        color: "#5a6874",
        baseline: "middle"
      });

      if (game.gameEnded && settlement) {
        const statsTop = dialogY + clamp(82 * scale, 68, 82);
        const statsGap = clamp(8 * scale, 6, 8);
        const statsWidth = (dialogWidth - statsGap * 4) / 3;
        const statsHeight = clamp(64 * scale, 54, 64);
        settlement.stats.forEach((item, index) => {
          const x = dialogX + statsGap + index * (statsWidth + statsGap);
          fillRoundedRect(
            ctx,
            x,
            statsTop,
            statsWidth,
            statsHeight,
            clamp(16 * scale, 12, 16),
            settlement.tone === "success" ? "rgba(235,244,240,0.95)" : "rgba(246,238,236,0.95)"
          );
          drawText(ctx, item.label, x + statsWidth / 2, statsTop + clamp(20 * scale, 18, 20), {
            align: "center",
            font: `${Math.round(clamp(11 * scale, 10, 11))}px sans-serif`,
            color: "#70808c",
            baseline: "middle"
          });
          drawText(ctx, item.value, x + statsWidth / 2, statsTop + clamp(44 * scale, 38, 44), {
            align: "center",
            font: `700 ${Math.round(clamp(16 * scale, 13, 16))}px sans-serif`,
            color: settlement.tone === "success" ? "#2f6757" : "#964b43",
            baseline: "middle"
          });
        });

        ctx.font = `${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`;
        wrapText(ctx, settlement.note, dialogWidth - clamp(28 * scale, 22, 28)).slice(0, 2).forEach((line, index) => {
          drawText(ctx, line, dialogX + dialogWidth / 2, statsTop + statsHeight + clamp(22 * scale, 18, 22) + index * clamp(18 * scale, 15, 18), {
            align: "center",
            font: `${Math.round(clamp(13 * scale, 11, 13))}px sans-serif`,
            color: "#667783",
            baseline: "middle"
          });
        });
      }

      const overlayButtons = game.paused
        ? [
            { key: "pause", label: "继续", primary: true },
            { key: "home", label: "返回", primary: false }
          ]
        : [
            { key: settlement.primaryAction.key, label: settlement.primaryAction.label, primary: true },
            { key: settlement.secondaryAction.key, label: settlement.secondaryAction.label, primary: false }
          ];
      const overlayGap = clamp(10 * scale, 8, 10);
      const overlayButtonHeight = clamp(40 * scale, 34, 40);
      const overlayButtonWidth = (dialogWidth - overlayGap * 3) / 2;
      if (game.gameEnded) {
        const statsButtonWidth = dialogWidth - overlayGap * 2;
        const statsButtonX = dialogX + overlayGap;
        const statsButtonY = dialogY + dialogHeight - overlayButtonHeight * 2 - overlayGap * 2;
        fillRoundedRect(ctx, statsButtonX, statsButtonY, statsButtonWidth, overlayButtonHeight, clamp(16 * scale, 12, 16), "rgba(255,255,255,0.88)");
        drawText(ctx, "查看统计", statsButtonX + statsButtonWidth / 2, statsButtonY + overlayButtonHeight / 2 + 1, {
          align: "center",
          font: `700 ${Math.round(clamp(15 * scale, 12, 15))}px sans-serif`,
          color: "#213240",
          baseline: "middle"
        });
        this.interactives.push({ type: "action", value: "stats", x: statsButtonX, y: statsButtonY, width: statsButtonWidth, height: overlayButtonHeight });
      }
      overlayButtons.forEach((button, index) => {
        const x = dialogX + overlayGap + index * (overlayButtonWidth + overlayGap);
        const y = dialogY + dialogHeight - overlayButtonHeight - overlayGap;
        fillRoundedRect(ctx, x, y, overlayButtonWidth, overlayButtonHeight, clamp(16 * scale, 12, 16), button.primary ? "#436074" : "rgba(255,255,255,0.88)");
        drawText(ctx, button.label, x + overlayButtonWidth / 2, y + overlayButtonHeight / 2 + 1, {
          align: "center",
          font: `700 ${Math.round(clamp(15 * scale, 12, 15))}px sans-serif`,
          color: button.primary ? "#ffffff" : "#213240",
          baseline: "middle"
        });
        this.interactives.push({ type: "action", value: button.key, x, y, width: overlayButtonWidth, height: overlayButtonHeight });
      });
    }
  }
}

module.exports = {
  Renderer
};
