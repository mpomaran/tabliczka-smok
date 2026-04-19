const MULTIPLICATION_TIME_MS = 10000;
const DIVISION_TIME_MS = 16000;
const FEEDBACK_DELAY_MS = 700;
const WRONG_FEEDBACK_DELAY_MS = 5000;
const MIN_WEIGHT = 0.35;
const MAX_WEIGHT = 6;
const HARD_FACTOR_SET = new Set([6, 7, 8, 9]);
const VERY_HARD_FACTS = new Set([
  '6x8',
  '8x6',
  '6x9',
  '9x6',
  '7x8',
  '8x7',
  '7x6',
  '6x7',
  '7x9',
  '9x7',
  '7x7',
]);

const appShell = document.getElementById('app');
const restartButton = document.getElementById('restart-button');
const playAgainButton = document.getElementById('play-again-button');
const revealedCountNode = document.getElementById('revealed-count');
const correctCountNode = document.getElementById('correct-count');
const wrongCountNode = document.getElementById('wrong-count');
const dragonProgressNode = document.getElementById('dragon-progress');
const dragonCover = document.getElementById('dragon-cover');
const divisionToggle = document.getElementById('division-toggle');
const timeLeftNode = document.getElementById('time-left');
const timerBar = document.getElementById('timer-bar');
const timerFill = document.getElementById('timer-fill');
const questionBoxNode = document.querySelector('.question-box');
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createQuestionBank(includeDivision = false) {
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

      if (includeDivision) {
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
  }

  return bank;
}

function createRevealOrder() {
  return shuffle(Array.from({ length: 100 }, (_, index) => index));
}

function preferenceMetric(question) {
  return question.type === 'division' ? question.left : question.answer;
}

function difficultyPreference(question) {
  const metric = preferenceMetric(question);
  let preference = 0.9;

  if (metric > 50) {
    preference = 4.8;
  } else if (metric > 30) {
    preference = 2.8;
  } else if (metric >= 20) {
    preference = 1.45;
  }

  if (question.type === 'multiplication') {
    const { left, right } = question;

    if (VERY_HARD_FACTS.has(question.id)) {
      preference *= 2.4;
    } else if (HARD_FACTOR_SET.has(left) && HARD_FACTOR_SET.has(right)) {
      preference *= 1.85;
    } else if (HARD_FACTOR_SET.has(left) || HARD_FACTOR_SET.has(right)) {
      preference *= 1.35;
    }
  } else if (HARD_FACTOR_SET.has(question.right) || HARD_FACTOR_SET.has(question.answer)) {
    preference *= 1.2;
  }

  return preference;
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
    effectiveWeight: question.weight * difficultyPreference(question) * recencyFactor(question.id, recentIds),
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

function rankCandidates(values, correct, preferred = []) {
  const preferredSet = new Set(preferred);

  return uniqueCandidates(values, correct).sort((first, second) => {
    const firstPreferred = preferredSet.has(first) ? 1 : 0;
    const secondPreferred = preferredSet.has(second) ? 1 : 0;

    if (firstPreferred !== secondPreferred) {
      return secondPreferred - firstPreferred;
    }

    const diff = Math.abs(first - correct) - Math.abs(second - correct);

    if (diff !== 0) {
      return diff;
    }

    return first - second;
  });
}

function similarMultiplicationValues(left, right) {
  const hardFactors = [6, 7, 8, 9];
  const values = [];

  for (const factor of hardFactors) {
    values.push(left * factor, factor * right);
  }

  values.push(
    left * Math.max(1, right - 1),
    left * Math.min(10, right + 1),
    Math.max(1, left - 1) * right,
    Math.min(10, left + 1) * right,
    Math.max(1, left - 1) * Math.max(1, right - 1),
    Math.min(10, left + 1) * Math.min(10, right + 1),
    Math.max(1, left - 1) * Math.min(10, right + 1),
    Math.min(10, left + 1) * Math.max(1, right - 1),
  );

  return values;
}

function similarDivisionValues(left, right, answer) {
  const hardFactors = [6, 7, 8, 9];
  const values = [];

  for (const factor of hardFactors) {
    if (left % factor === 0) {
      values.push(left / factor);
    }
  }

  values.push(
    Math.max(1, answer - 1),
    Math.min(100, answer + 1),
    Math.max(1, answer - 2),
    Math.min(100, answer + 2),
    Math.max(1, Math.floor(left / Math.max(1, right - 1))),
    Math.max(1, Math.floor(left / Math.min(10, right + 1))),
    Math.max(1, right - 1),
    Math.min(100, right + 1),
    right,
  );

  return values;
}

function createAnswerOptions(question) {
  const { left, right, answer, type } = question;
  const nearbyOffsets = [
    answer - 1,
    answer + 1,
    answer - 2,
    answer + 2,
    answer - 3,
    answer + 3,
    answer - left,
    answer + left,
    answer - right,
    answer + right,
  ];
  let rankedCandidates = [];

  if (type === 'multiplication') {
    const closeProducts = [
      left * Math.max(1, right - 1),
      left * Math.min(10, right + 1),
      Math.max(1, left - 1) * right,
      Math.min(10, left + 1) * right,
    ];
    const patternMistakes = [
      left + right,
      answer + left,
      answer - right,
      answer - left,
      Math.abs(left - right) * 10 || 10,
    ];
    const hardConfusions = similarMultiplicationValues(left, right);

    rankedCandidates = rankCandidates(
      [...hardConfusions, ...closeProducts, ...nearbyOffsets, ...patternMistakes],
      answer,
      hardConfusions,
    );
  } else {
    const hardConfusions = similarDivisionValues(left, right, answer);
    const patternMistakes = [Math.max(1, Math.round(left / 10)), right * 2, Math.max(1, right - 2)];

    rankedCandidates = rankCandidates(
      [...hardConfusions, ...nearbyOffsets, ...patternMistakes],
      answer,
      hardConfusions,
    );
  }

  const wrongAnswers = rankedCandidates.slice(0, 3);

  if (wrongAnswers.length < 3) {
    const fallback = rankCandidates(
      [
        ...rankedCandidates,
        answer + 4,
        answer - 4,
        answer + 5,
        answer - 5,
        answer + 6,
        answer - 6,
        answer + 7,
        answer - 7,
      ],
      answer,
    );

    for (const candidate of fallback) {
      if (wrongAnswers.length >= 3) {
        break;
      }

      if (!wrongAnswers.includes(candidate)) {
        wrongAnswers.push(candidate);
      }
    }
  }

  return shuffle([
    { value: answer, isCorrect: true },
    ...wrongAnswers.slice(0, 3).map((value) => ({ value, isCorrect: false })),
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
  questionsServed: 0,
  scheduledRepeats: [],
  revealAnswerInQuestion: false,
  divisionEnabled: false,
  feedbackType: 'idle',
  selectedOptionValue: null,
  locked: false,
  finished: false,
};

function formatQuestionText(question, revealAnswer = false) {
  if (!revealAnswer) {
    return question.prompt;
  }

  if (question.type === 'division') {
    return `${question.left} : ${question.right} = ${question.answer}`;
  }

  return `${question.left} x ${question.right} = ${question.answer}`;
}

function scheduleRepeat(questionId) {
  const delay = randomInt(2, 5);
  const dueAt = state.questionsServed + delay;
  const expireAt = state.questionsServed + 5;

  state.scheduledRepeats = state.scheduledRepeats.filter((entry) => entry.questionId !== questionId);
  state.scheduledRepeats.push({ questionId, dueAt, expireAt });
}

function pickScheduledRepeatQuestion() {
  const activeEntries = state.scheduledRepeats
    .filter((entry) => entry.expireAt >= state.questionsServed)
    .sort((first, second) => first.dueAt - second.dueAt);

  state.scheduledRepeats = activeEntries;

  const eligibleEntry = activeEntries.find(
    (entry) => entry.dueAt <= state.questionsServed && !state.recentIds.includes(entry.questionId),
  );

  if (!eligibleEntry) {
    return null;
  }

  state.scheduledRepeats = state.scheduledRepeats.filter(
    (entry) => entry.questionId !== eligibleEntry.questionId,
  );

  return state.questionBank.find((question) => question.id === eligibleEntry.questionId) ?? null;
}

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
  state.feedbackType = type;
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
  questionBoxNode.classList.toggle('question-box--solved', state.revealAnswerInQuestion);
}

function renderStats() {
  revealedCountNode.textContent = `${state.revealedCount}/100`;
  dragonProgressNode.textContent = `${state.revealedCount}/100`;
  correctCountNode.textContent = String(state.correctCount);
  wrongCountNode.textContent = String(state.wrongCount);
}

function renderQuestion() {
  questionTextNode.textContent = formatQuestionText(
    state.currentQuestion,
    state.revealAnswerInQuestion,
  );
  questionTextNode.classList.toggle('question-text--solved', state.revealAnswerInQuestion);
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
      handleResult(false);
    }
  }, 100);
}

function nextRound() {
  if (state.revealedCount >= 100) {
    showWinState();
    return;
  }

  state.currentQuestion = pickScheduledRepeatQuestion()
    ?? pickNextQuestion(state.questionBank, state.recentIds);
  state.currentOptions = createAnswerOptions(state.currentQuestion);
  state.questionsServed += 1;
  state.revealAnswerInQuestion = false;
  state.selectedOptionValue = null;
  state.locked = false;
  renderQuestion();
  setFeedback('idle', 'Wybierz odpowiedź');
  startTimer();
}

function handleResult(isCorrect) {
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
    state.revealAnswerInQuestion = true;
  } else {
    state.wrongCount += 1;
    scheduleRepeat(currentQuestionId);
    state.revealAnswerInQuestion = true;
  }

  state.recentIds = [currentQuestionId, ...state.recentIds].slice(0, 4);
  renderStats();
  renderDragonTiles();
  setFeedback(
    isCorrect ? 'success' : 'error',
    isCorrect ? 'Brawo!' : `Poprawna odpowiedź: ${state.currentQuestion.answer}`,
  );
  renderQuestion();

  clearTimeout(state.timeoutId);
  state.timeoutId = window.setTimeout(() => {
    nextRound();
  }, isCorrect ? FEEDBACK_DELAY_MS : WRONG_FEEDBACK_DELAY_MS);
}

function handleAnswer(option) {
  state.selectedOptionValue = option.value;
  handleResult(option.isCorrect);
}

function resetGame() {
  clearInterval(state.timerId);
  clearTimeout(state.timeoutId);

  state.questionBank = createQuestionBank(state.divisionEnabled);
  state.revealOrder = createRevealOrder();
  state.revealedCount = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.recentIds = [];
  state.currentQuestion = null;
  state.currentOptions = [];
  state.questionsServed = 0;
  state.scheduledRepeats = [];
  state.revealAnswerInQuestion = false;
  state.feedbackType = 'idle';
  state.selectedOptionValue = null;
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
divisionToggle.addEventListener('change', (event) => {
  state.divisionEnabled = event.target.checked;
  resetGame();
});
divisionToggle.checked = false;
resetGame();

