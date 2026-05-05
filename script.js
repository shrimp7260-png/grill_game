"use strict";

// まずは画像なしで遊べるよう、絵文字と名前で食材を表現します。
const foods = [
  { name: "生ステーキ", icon: "🥩", speedMin: 20, speedMax: 25, perfectHalf: 6, goodHalf: 18, note: "じっくり焼く" },
  { name: "厚切り魚", icon: "🐟", speedMin: 24, speedMax: 30, perfectHalf: 5, goodHalf: 16, note: "少しゆっくり" },
  { name: "ハンバーグ", icon: "🍔", speedMin: 28, speedMax: 35, perfectHalf: 5, goodHalf: 15, note: "中まで火を通す" },
  { name: "パンケーキ", icon: "🥞", speedMin: 34, speedMax: 42, perfectHalf: 4, goodHalf: 13, note: "焦げ目を狙う" },
  { name: "ソーセージ", icon: "🌭", speedMin: 40, speedMax: 50, perfectHalf: 4, goodHalf: 12, note: "弾ける前に" },
  { name: "とうもろこし", icon: "🌽", speedMin: 44, speedMax: 56, perfectHalf: 3.5, goodHalf: 11, note: "一気に焼ける" },
  { name: "トースト", icon: "🍞", speedMin: 52, speedMax: 66, perfectHalf: 3.5, goodHalf: 10, note: "すぐ色づく" },
  { name: "焼きおにぎり", icon: "🍙", speedMin: 64, speedMax: 78, perfectHalf: 3, goodHalf: 9, note: "超シビア" }
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
  const candidates = foods.filter((food) => food.name !== game.lastFoodName);
  const nextFood = candidates[Math.floor(Math.random() * candidates.length)];
  game.currentFood = nextFood;
  game.speed = nextFood.speedMin + Math.random() * (nextFood.speedMax - nextFood.speedMin);
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
