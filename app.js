const MULTIPLICATION_TIME_MS = 5000;
const DIVISION_TIME_MS = 8000;
const FEEDBACK_DELAY_MS = 700;
const MIN_WEIGHT = 0.35;
const MAX_WEIGHT = 6;

const appShell = document.getElementById('app');
const restartButton = document.getElementById('restart-button');
const playAgainButton = document.getElementById('play-again-button');
const revealedCountNode = document.getElementById('revealed-count');
const correctCountNode = document.getElementById('correct-count');
const wrongCountNode = document.getElementById('wrong-count');
const dragonProgressNode = document.getElementById('dragon-progress');
const dragonCover = document.getElementById('dragon-cover');
const timeLeftNode = document.getElementById('time-left');
const timerBar = document.getElementById('timer-bar');
const timerFill = document.getElementById('timer-fill');
const questionTextNode = document.getElementById('question-text');
const feedbackBadge = document.getElementById('feedback-badge');
const answersGrid = document.getElementById('answers-grid');
const quizCard = document.getElementById('quiz-card');
const successCard = document.getElementById('success-card');

function shuffle(array) {
  const clone = [...array];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

function createQuestionBank() {
  const bank = [];

  for (let left = 1; left <= 10; left += 1) {
    for (let right = 1; right <= 10; right += 1) {
      bank.push({
        id: `${left}x${right}`,
        left,
        right,
        answer: left * right,
        prompt: `${left} x ${right} = ?`,
        type: 'multiplication',
        correctCount: 0,
        wrongCount: 0,
        weight: 1,
      });

      bank.push({
        id: `${left * right}:${right}`,
        left: left * right,
        right,
        answer: left,
        prompt: `${left * right} : ${right} = ?`,
        type: 'division',
        correctCount: 0,
        wrongCount: 0,
        weight: 1,
      });
    }
  }

  return bank;
}

function createRevealOrder() {
  return shuffle(Array.from({ length: 100 }, (_, index) => index));
}

function recencyFactor(questionId, recentIds) {
  const lastIndex = recentIds.indexOf(questionId);

  if (lastIndex === -1) {
    return 1;
  }

  if (lastIndex === 0) {
    return 0.12;
  }

  if (lastIndex === 1) {
    return 0.35;
  }

  if (lastIndex === 2) {
    return 0.55;
  }

  return 0.8;
}

function pickNextQuestion(questionBank, recentIds) {
  const entries = questionBank.map((question) => ({
    question,
    effectiveWeight: question.weight * recencyFactor(question.id, recentIds),
  }));

  const totalWeight = entries.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
  let cursor = Math.random() * totalWeight;

  for (const entry of entries) {
    cursor -= entry.effectiveWeight;
    if (cursor <= 0) {
      return entry.question;
    }
  }

  return entries[entries.length - 1].question;
}

function uniqueCandidates(values, correct) {
  return [...new Set(values)].filter((value) => value !== correct && value >= 1 && value <= 100);
}

function createAnswerOptions(question) {
  const { left, right, answer, type } = question;
  const nearbyOffsets = [answer - 1, answer + 1, answer - 2, answer + 2, answer - 3, answer + 3];
  let candidates = [];

  if (type === 'multiplication') {
    const neighborProducts = [
      left * Math.max(1, right - 1),
      left * Math.min(10, right + 1),
      Math.max(1, left - 1) * right,
      Math.min(10, left + 1) * right,
    ];
    const patternMistakes = [
      left + right,
      answer + left,
      answer - right,
      Math.abs(left - right) * 10 || 10,
    ];

    candidates = uniqueCandidates(
      [...neighborProducts, ...nearbyOffsets, ...patternMistakes].sort(
        (first, second) => Math.abs(first - answer) - Math.abs(second - answer),
      ),
      answer,
    );
  } else {
    const divisorNeighbors = [
      Math.max(1, Math.floor(left / Math.max(1, right - 1))),
      Math.max(1, Math.floor(left / Math.min(10, right + 1))),
      Math.max(1, answer + 1),
      Math.max(1, answer - 1),
    ];
    const patternMistakes = [
      right,
      Math.max(1, right - 1),
      Math.min(100, right + 1),
      Math.max(1, Math.round(left / 10)),
    ];

    candidates = uniqueCandidates(
      [...divisorNeighbors, ...nearbyOffsets, ...patternMistakes].sort(
        (first, second) => Math.abs(first - answer) - Math.abs(second - answer),
      ),
      answer,
    );
  }

  const wrongAnswer = candidates[0] ?? Math.max(1, Math.min(100, answer + 1));

  return shuffle([
    { value: answer, isCorrect: true },
    { value: wrongAnswer, isCorrect: false },
  ]);
}

function updateQuestionStats(questionBank, questionId, isCorrect) {
  return questionBank.map((question) => {
    if (question.id !== questionId) {
      return question;
    }

    if (isCorrect) {
      return {
        ...question,
        correctCount: question.correctCount + 1,
        weight: Math.max(MIN_WEIGHT, Number((question.weight * 0.88).toFixed(2))),
      };
    }

    return {
      ...question,
      wrongCount: question.wrongCount + 1,
      weight: Math.min(MAX_WEIGHT, Number((question.weight + 0.85).toFixed(2))),
    };
  });
}

const state = {
  questionBank: [],
  revealOrder: [],
  revealedCount: 0,
  correctCount: 0,
  wrongCount: 0,
  recentIds: [],
  currentQuestion: null,
  currentOptions: [],
  timerId: null,
  timeoutId: null,
  startedAt: 0,
  locked: false,
  finished: false,
};

function buildDragonCover() {
  dragonCover.innerHTML = '';

  for (let index = 0; index < 100; index += 1) {
    const tile = document.createElement('div');
    tile.className = 'dragon-tile';
    tile.dataset.index = String(index);
    dragonCover.appendChild(tile);
  }
}

function renderDragonTiles() {
  const revealedSet = new Set(state.revealOrder.slice(0, state.revealedCount));
  const tiles = dragonCover.children;

  for (let index = 0; index < tiles.length; index += 1) {
    tiles[index].classList.toggle('dragon-tile--revealed', revealedSet.has(index));
  }
}

function setFeedback(type, message) {
  feedbackBadge.textContent = message;
  feedbackBadge.className = 'feedback-badge';
  if (type !== 'idle') {
    feedbackBadge.classList.add(`feedback-badge--${type}`);
  }

  appShell.classList.remove('app-shell--success', 'app-shell--error');
  timerBar.classList.toggle('timer-bar--paused', type !== 'idle');

  if (type === 'success') {
    appShell.classList.add('app-shell--success');
  }

  if (type === 'error') {
    appShell.classList.add('app-shell--error');
  }
}

function renderStats() {
  revealedCountNode.textContent = `${state.revealedCount}/100`;
  dragonProgressNode.textContent = `${state.revealedCount}/100`;
  correctCountNode.textContent = String(state.correctCount);
  wrongCountNode.textContent = String(state.wrongCount);
}

function renderQuestion() {
  questionTextNode.textContent = state.currentQuestion.prompt;
  answersGrid.innerHTML = '';

  state.currentOptions.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.textContent = String(option.value);
    button.disabled = state.locked || state.finished;
    button.addEventListener('click', () => handleAnswer(option));
    answersGrid.appendChild(button);
  });
}

function renderTimer(timeLeftMs) {
  const clamped = Math.max(0, timeLeftMs);
  const totalMs = state.currentQuestion?.type === 'division' ? DIVISION_TIME_MS : MULTIPLICATION_TIME_MS;
  timeLeftNode.textContent = `${(clamped / 1000).toFixed(1)} s`;
  timerFill.style.width = `${(clamped / totalMs) * 100}%`;
}

function showWinState() {
  state.finished = true;
  state.locked = true;
  clearInterval(state.timerId);
  clearTimeout(state.timeoutId);
  quizCard.classList.add('hidden');
  successCard.classList.remove('hidden');
  setFeedback('success', 'Brawo!');
}

function startTimer() {
  clearInterval(state.timerId);
  state.startedAt = Date.now();
  const totalMs = state.currentQuestion.type === 'division' ? DIVISION_TIME_MS : MULTIPLICATION_TIME_MS;
  renderTimer(totalMs);

  state.timerId = window.setInterval(() => {
    const elapsed = Date.now() - state.startedAt;
    const timeLeftMs = Math.max(0, totalMs - elapsed);
    renderTimer(timeLeftMs);

    if (timeLeftMs === 0) {
      clearInterval(state.timerId);
      handleResult(false, 'Ups! Czas minął.');
    }
  }, 100);
}

function nextRound() {
  if (state.revealedCount >= 100) {
    showWinState();
    return;
  }

  state.currentQuestion = pickNextQuestion(state.questionBank, state.recentIds);
  state.currentOptions = createAnswerOptions(state.currentQuestion);
  state.locked = false;
  renderQuestion();
  setFeedback('idle', 'Wybierz odpowiedź');
  startTimer();
}

function handleResult(isCorrect, message) {
  if (state.locked || state.finished) {
    return;
  }

  state.locked = true;
  clearInterval(state.timerId);
  renderTimer(0);

  const currentQuestionId = state.currentQuestion.id;
  state.questionBank = updateQuestionStats(state.questionBank, currentQuestionId, isCorrect);

  if (isCorrect) {
    state.correctCount += 1;
    state.revealedCount = Math.min(100, state.revealedCount + 1);
  } else {
    state.wrongCount += 1;
  }

  state.recentIds = [currentQuestionId, ...state.recentIds].slice(0, 4);
  renderStats();
  renderDragonTiles();
  setFeedback(isCorrect ? 'success' : 'error', message);
  renderQuestion();

  clearTimeout(state.timeoutId);
  state.timeoutId = window.setTimeout(() => {
    nextRound();
  }, FEEDBACK_DELAY_MS);
}

function handleAnswer(option) {
  handleResult(option.isCorrect, option.isCorrect ? 'Brawo!' : 'To nie ta odpowiedź.');
}

function resetGame() {
  clearInterval(state.timerId);
  clearTimeout(state.timeoutId);

  state.questionBank = createQuestionBank();
  state.revealOrder = createRevealOrder();
  state.revealedCount = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.recentIds = [];
  state.currentQuestion = null;
  state.currentOptions = [];
  state.locked = false;
  state.finished = false;

  quizCard.classList.remove('hidden');
  successCard.classList.add('hidden');
  renderStats();
  renderDragonTiles();
  nextRound();
}

buildDragonCover();
restartButton.addEventListener('click', resetGame);
playAgainButton.addEventListener('click', resetGame);
resetGame();
