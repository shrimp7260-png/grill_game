"use strict";

// まずは画像なしで遊べるよう、絵文字と名前で食材を表現します。
const foods = [
  { name: "生ステーキ", icon: "🥩", speedMin: 27, speedMax: 34, perfectHalf: 3.8, goodHalf: 11, note: "じっくりでも油断禁物" },
  { name: "厚切り魚", icon: "🐟", speedMin: 32, speedMax: 40, perfectHalf: 3.4, goodHalf: 10, note: "少し早めに構える" },
  { name: "ハンバーグ", icon: "🍔", speedMin: 38, speedMax: 48, perfectHalf: 3.1, goodHalf: 9.4, note: "中心だけ狙う" },
  { name: "パンケーキ", icon: "🥞", speedMin: 47, speedMax: 59, perfectHalf: 2.8, goodHalf: 8.4, note: "焦げ目は一瞬" },
  { name: "ソーセージ", icon: "🌭", speedMin: 56, speedMax: 70, perfectHalf: 2.5, goodHalf: 7.6, note: "弾ける前の一瞬" },
  { name: "とうもろこし", icon: "🌽", speedMin: 64, speedMax: 82, perfectHalf: 2.3, goodHalf: 7, note: "一気に焼ける" },
  { name: "トースト", icon: "🍞", speedMin: 76, speedMax: 96, perfectHalf: 2.1, goodHalf: 6.4, note: "すぐ焦げる" },
  { name: "焼きおにぎり", icon: "🍙", speedMin: 92, speedMax: 116, perfectHalf: 1.8, goodHalf: 5.6, note: "ほぼ反射勝負" }
];

const BEST_CENTER = 50;
const ROUND_DELAY = 360;
const FEEDBACK_TIME = 900;

const startScreen = document.querySelector("#startScreen");
const gameScreen = document.querySelector("#gameScreen");
const resultScreen = document.querySelector("#resultScreen");
const scoreText = document.querySelector("#scoreText");
const comboText = document.querySelector("#comboText");
const timerLabel = document.querySelector("#timerLabel");
const timeText = document.querySelector("#timeText");
const modeText = document.querySelector("#modeText");
const foodIcon = document.querySelector("#foodIcon");
const foodName = document.querySelector("#foodName");
const hintText = document.querySelector("#hintText");
const gaugeNeedle = document.querySelector("#gaugeNeedle");
const feedbackText = document.querySelector("#feedbackText");
const grillButton = document.querySelector("#grillButton");
const resultModeText = document.querySelector("#resultModeText");
const resultTitle = document.querySelector("#resultTitle");
const resultScore = document.querySelector("#resultScore");
const resultMaxCombo = document.querySelector("#resultMaxCombo");
const resultSuccess = document.querySelector("#resultSuccess");
const retryButton = document.querySelector("#retryButton");
const backToStartButton = document.querySelector("#backToStartButton");

const game = {
  mode: "time",
  score: 0,
  combo: 0,
  maxCombo: 0,
  successCount: 0,
  timeLeft: 60,
  progress: 0,
  speed: 34,
  roundCount: 0,
  currentFood: null,
  lastTime: 0,
  lastFoodName: "",
  animationId: 0,
  timerId: 0,
  feedbackTimerId: 0,
  isPlaying: false,
  isWaitingNext: false
};

// iPhone Safariの表示高さに合わせ、下部アドレスバーに隠れにくくします。
function setAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

function showScreen(screen) {
  startScreen.classList.toggle("is-hidden", screen !== "start");
  gameScreen.classList.toggle("is-hidden", screen !== "game");
  resultScreen.classList.toggle("is-hidden", screen !== "result");
}

function startGame(mode) {
  stopTimers();

  game.mode = mode;
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.successCount = 0;
  game.timeLeft = 60;
  game.progress = 0;
  game.roundCount = 0;
  game.lastTime = 0;
  game.lastFoodName = "";
  game.isPlaying = true;
  game.isWaitingNext = false;

  modeText.textContent = mode === "time" ? "タイムアタック 60秒" : "エンドレス ミスするまで";
  timerLabel.textContent = mode === "time" ? "時間" : "連続";
  timeText.textContent = mode === "time" ? "60" : "∞";
  hintText.textContent = "緑のゾーンでタップ";

  showScreen("game");
  updateHud();
  showFeedback("");
  nextRound();

  if (mode === "time") {
    game.timerId = setInterval(tickTimer, 1000);
  }
}

function stopTimers() {
  clearInterval(game.timerId);
  clearTimeout(game.feedbackTimerId);
  cancelAnimationFrame(game.animationId);
}

function tickTimer() {
  game.timeLeft -= 1;
  updateHud();

  if (game.timeLeft <= 0) {
    finishGame();
  }
}

function nextRound() {
  if (!game.isPlaying) {
    return;
  }

  game.progress = 0;
  game.lastTime = 0;
  game.isWaitingNext = false;
  game.roundCount += 1;
  const candidates = foods.filter((food) => food.name !== game.lastFoodName);
  const nextFood = candidates[Math.floor(Math.random() * candidates.length)];
  game.currentFood = nextFood;
  const baseSpeed = nextFood.speedMin + Math.random() * (nextFood.speedMax - nextFood.speedMin);
  const pressureBonus = Math.min(22, Math.floor(game.roundCount / 4) * 2);
  game.speed = baseSpeed + pressureBonus;
  game.lastFoodName = nextFood.name;
  foodName.textContent = nextFood.name;
  foodIcon.textContent = nextFood.icon;
  gaugeNeedle.style.left = "0%";
  hintText.textContent = nextFood.note;
  updatePerfectZone(nextFood);

  cancelAnimationFrame(game.animationId);
  game.animationId = requestAnimationFrame(animateGauge);
}

function animateGauge(timestamp) {
  if (!game.isPlaying || game.isWaitingNext) {
    return;
  }

  if (game.lastTime === 0) {
    game.lastTime = timestamp;
  }

  const elapsedSeconds = (timestamp - game.lastTime) / 1000;
  game.lastTime = timestamp;
  game.progress += game.speed * elapsedSeconds;

  if (game.progress >= 100) {
    judgeCurrentTiming(true);
    return;
  }

  gaugeNeedle.style.left = `${game.progress}%`;
  game.animationId = requestAnimationFrame(animateGauge);
}

function judgeCurrentTiming(isOvercooked = false) {
  if (!game.isPlaying || game.isWaitingNext) {
    return;
  }

  game.isWaitingNext = true;
  cancelAnimationFrame(game.animationId);
  gaugeNeedle.style.left = `${Math.min(game.progress, 100)}%`;

  const result = getJudge(isOvercooked);
  applyJudge(result);

  if (game.mode === "endless" && result.name === "MISS") {
    window.setTimeout(finishGame, ROUND_DELAY);
    return;
  }

  window.setTimeout(nextRound, ROUND_DELAY);
}

function getJudge(isOvercooked) {
  const perfectStart = BEST_CENTER - game.currentFood.perfectHalf;
  const perfectEnd = BEST_CENTER + game.currentFood.perfectHalf;
  const goodStart = BEST_CENTER - game.currentFood.goodHalf;
  const goodEnd = BEST_CENTER + game.currentFood.goodHalf;

  if (!isOvercooked && game.progress >= perfectStart && game.progress <= perfectEnd) {
    return { name: "PERFECT", point: 2, isMiss: false };
  }

  if (!isOvercooked && game.progress >= goodStart && game.progress <= goodEnd) {
    return { name: "GOOD", point: 1, isMiss: false };
  }

  return { name: "MISS", point: 0, isMiss: true };
}

function applyJudge(result) {
  if (result.isMiss) {
    game.combo = 0;
    const goodStart = BEST_CENTER - game.currentFood.goodHalf;
    hintText.textContent = game.progress < goodStart ? "早すぎ" : "焼きすぎ";
  } else {
    game.score += result.point;
    game.combo += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.successCount += 1;
    hintText.textContent = result.name === "PERFECT" ? "+2点" : "+1点";
  }

  showFeedback(result.name, result.isMiss);
  updateHud();
}

function updatePerfectZone(food) {
  const perfectStart = BEST_CENTER - food.perfectHalf;
  const perfectEnd = BEST_CENTER + food.perfectHalf;
  const perfectWidth = food.perfectHalf * 2;
  document.documentElement.style.setProperty("--perfect-left", `${perfectStart}%`);
  document.documentElement.style.setProperty("--perfect-width", `${perfectWidth}%`);
  document.documentElement.style.setProperty("--perfect-right", `${perfectEnd}%`);
}

function showFeedback(message, isMiss = false) {
  clearTimeout(game.feedbackTimerId);
  feedbackText.textContent = message;
  feedbackText.classList.toggle("is-miss", isMiss);
  feedbackText.classList.toggle("is-visible", message.length > 0);

  if (message.length > 0) {
    game.feedbackTimerId = window.setTimeout(() => {
      feedbackText.classList.remove("is-visible");
    }, FEEDBACK_TIME);
  }
}

function updateHud() {
  scoreText.textContent = game.score;
  comboText.textContent = game.combo;

  if (game.mode === "time") {
    timeText.textContent = Math.max(0, game.timeLeft);
  } else {
    timeText.textContent = game.successCount;
  }
}

function finishGame() {
  stopTimers();
  game.isPlaying = false;
  game.isWaitingNext = false;

  resultModeText.textContent = game.mode === "time" ? "タイムアタック結果" : "エンドレス結果";
  resultTitle.textContent = game.mode === "time" ? "時間切れ" : "焼きすぎました";
  resultScore.textContent = game.score;
  resultMaxCombo.textContent = game.maxCombo;
  resultSuccess.textContent = game.successCount;
  showScreen("result");
}

document.querySelectorAll("[data-start-mode]").forEach((button) => {
  button.addEventListener("click", () => startGame(button.dataset.startMode));
});

grillButton.addEventListener("click", () => judgeCurrentTiming(false));

// 画面中央付近をタップしても判定できます。ボタンや結果画面の操作は邪魔しません。
gameScreen.addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    return;
  }

  judgeCurrentTiming(false);
});

retryButton.addEventListener("click", () => startGame(game.mode));
backToStartButton.addEventListener("click", () => {
  stopTimers();
  game.isPlaying = false;
  showScreen("start");
});

window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);
setAppHeight();
