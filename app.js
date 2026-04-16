const MULTIPLICATION_TIME_MS = 5000;
const DIVISION_TIME_MS = 8000;
const FEEDBACK_DELAY_MS = 700;
const WRONG_FEEDBACK_DELAY_MS = 5000;
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
const divisionToggle = document.getElementById('division-toggle');
const timeLeftNode = document.getElementById('time-left');
const timerBar = document.getElementById('timer-bar');
const timerFill = document.getElementById('timer-fill');
const questionBoxNode = document.querySelector('.question-box');
const questionTextNode = document.getElementById('question-text');
const hintTextNode = document.getElementById('hint-text');
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

  if (metric > 50) {
    return 4.8;
  }

  if (metric > 30) {
    return 2.8;
  }

  if (metric >= 20) {
    return 1.45;
  }

  return 0.9;
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

function buildHintText(question) {
  const { left, right, answer, type } = question;
  const promptText = `${left} x ${right}`;

  if (type === 'division') {
    if (right === 10) {
      return 'Przy dzieleniu przez 10 skreśl jedno zero.';
    }

  if (right === 5) {
      return 'Przy dzieleniu przez 5 pomyśl, jaka liczba pomnożona przez 5 da wynik.';
    }

    if (right === 2) {
      return 'Dzielenie przez 2 to wzięcie połowy.';
    }

    return `Pomyśl wspak: ${answer} x ${right} = ${left}.`;
  }

  const bigger = Math.max(left, right);
  const smaller = Math.min(left, right);

  if (smaller === 1) {
    return `${promptText}: mnożenie przez 1 nic nie zmienia.`;
  }

  if (smaller === 2) {
    return `${promptText}: mnożenie przez 2 to podwajanie.`;
  }

  if (smaller === 10) {
    return `${promptText}: przy mnożeniu przez 10 dopisz zero.`;
  }

  if (smaller === 5) {
    return `${promptText}: wynik mnożenia przez 5 to połowa wyniku mnożenia przez 10.`;
  }

  if (smaller === 9) {
    return `${promptText}: mnożenie przez 9 to jak przez 10, tylko minus jeden czynnik, czyli ${bigger} x 10 - ${bigger}.`;
  }

  if (smaller === 4) {
    return `${promptText}: przy mnożeniu przez 4 warto liczyć spokojnie krok po kroku.`;
  }

  if (answer > 50) {
    return `${promptText}: duży wynik łatwiej policzyć krok po kroku.`;
  }

  if (answer > 30) {
    return `${promptText}: zacznij od podobnego działania, które już pamiętasz.`;
  }

  return `${promptText}: zamiana miejsc się nie zmienia, bo ${left} x ${right} to tyle samo co ${right} x ${left}.`;
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
  hintTextNode.textContent = buildHintText(state.currentQuestion);
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
