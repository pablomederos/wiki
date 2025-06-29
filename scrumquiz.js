const quizData = [];

const categories = [];

// Elementos del DOM
const categorySelectionScreen = document.getElementById('category-selection-screen');
const quizScreen = document.getElementById('quiz-screen');
const categoryButtonsContainer = document.getElementById('category-buttons');
const allQuestionsBtn = document.getElementById('all-questions-btn');
const backToCategoriesBtn = document.getElementById('back-to-categories-btn');

const quizTitleEl = document.getElementById('quiz-title');
const progressBarEl = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const questionCounterEl = document.getElementById('question-counter');
const scoreCorrectEl = document.getElementById('score-correct');
const scoreIncorrectEl = document.getElementById('score-incorrect');
const questionAreaEl = document.getElementById('question-area');
const questionTypeEl = document.getElementById('question-type');
const questionTextEl = document.getElementById('question-text');
const optionsContainerEl = document.getElementById('options-container');
const resultAreaEl = document.getElementById('result-area');
const resultFeedbackEl = document.getElementById('result-feedback');
const resultTitleEl = document.getElementById('result-title');
const resultExplanationEl = document.getElementById('result-explanation');
const checkBtn = document.getElementById('check-btn');
const nextBtn = document.getElementById('next-btn');
const finalScreenEl = document.getElementById('final-screen');
const finalScoreCorrectEl = document.getElementById('final-score-correct');
const finalScoreIncorrectEl = document.getElementById('final-score-incorrect');
const restartBtn = document.getElementById('restart-btn');

// Estado del cuestionario
let state = {};

function resetState() {
        state = {
        currentQuestionIndex: 0,
        score: { correct: 0, incorrect: 0 },
        selectedAnswers: [],
        activeQuizData: [],
        currentCategory: null,
    };
}

function init() {
    resetState();
    categoryButtonsContainer.innerHTML = '';
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.textContent = category;
        btn.className = 'category-btn w-full bg-slate-200 text-slate-800 font-bold py-3 px-6 rounded-lg hover:bg-slate-300';
        btn.addEventListener('click', () => startQuiz(category));
        categoryButtonsContainer.appendChild(btn);
    });
    categorySelectionScreen.classList.remove('hidden');
    quizScreen.classList.add('hidden');
}

function startQuiz(category) {
    resetState();
    state.currentCategory = category;
    if (category === 'all') {
        state.activeQuizData = quizData;
        quizTitleEl.textContent = 'Todas las Preguntas';
    } else {
        state.activeQuizData = quizData.filter(q => q.category === category);
        quizTitleEl.textContent = category;
    }
    categorySelectionScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    finalScreenEl.classList.add('hidden');
    
    // Mostrar elementos de la UI del quiz
    questionAreaEl.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    progressBarEl.parentElement.classList.remove('hidden');
    
    renderQuestion();
}

function renderQuestion() {
    if (state.currentQuestionIndex >= state.activeQuizData.length) {
        showFinalScreen();
        return;
    }

    questionAreaEl.classList.remove('quiz-card-enter');
    void questionAreaEl.offsetWidth; // Trigger reflow
    questionAreaEl.classList.add('quiz-card-enter');
    
    const question = state.activeQuizData[state.currentQuestionIndex];
    
    // Actualizar progreso
    const progress = ((state.currentQuestionIndex) / state.activeQuizData.length) * 100;
    progressBarEl.style.width = `${progress}%`;
    
    questionCounterEl.textContent = `Pregunta ${state.currentQuestionIndex + 1} de ${state.activeQuizData.length}`;
    questionTypeEl.textContent = question.type;
    questionTextEl.textContent = question.question;
    
    optionsContainerEl.innerHTML = '';
    for (const key in question.options) {
        const optionBtn = document.createElement('button');
        optionBtn.dataset.key = key;
        optionBtn.className = 'option-btn w-full text-left p-4 border-2 border-slate-300 rounded-lg hover:bg-slate-100 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400';
        optionBtn.innerHTML = `<span class="font-bold mr-2">${key}.</span> ${question.options[key]}`;
        optionBtn.addEventListener('click', () => toggleOption(optionBtn, question.type));
        optionsContainerEl.appendChild(optionBtn);
    }
    
    updateScores();
    resetButtons();
    checkBtn.disabled = true;
}

function toggleOption(button, type) {
    const key = button.dataset.key;
    if (type === 'Opción Múltiple' || type === 'Verdadero/Falso') {
        document.querySelectorAll('.option-btn.selected').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        state.selectedAnswers = [key];
    } else { // Selección Múltiple
        button.classList.toggle('selected');
        state.selectedAnswers = [...document.querySelectorAll('.option-btn.selected')].map(btn => btn.dataset.key);
    }
    checkBtn.disabled = state.selectedAnswers.length === 0;
}

function checkAnswer() {
    const question = state.activeQuizData[state.currentQuestionIndex];
    const correctAnswers = question.correct.sort();
    const selectedAnswers = state.selectedAnswers.sort();

    const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(selectedAnswers);
    
    if (isCorrect) {
        state.score.correct++;
        resultTitleEl.textContent = "¡Correcto!";
        resultFeedbackEl.className = 'p-4 rounded-lg bg-green-100 text-green-800';
        resultExplanationEl.textContent = question.explanation;
    } else {
        state.score.incorrect++;
        resultTitleEl.textContent = "Incorrecto";
        resultFeedbackEl.className = 'p-4 rounded-lg bg-red-100 text-red-800';
        resultExplanationEl.textContent = `La(s) respuesta(s) correcta(s) era(n) ${question.correct.join(', ')}. ${question.explanation}`;
    }

    highlightAnswers(question);
    updateScores();
    showResult();
}

function highlightAnswers(question) {
    document.querySelectorAll('.option-btn').forEach(btn => {
        const key = btn.dataset.key;
        btn.disabled = true;
        if (question.correct.includes(key)) {
            btn.classList.add('correct');
            btn.classList.remove('selected');
        } else if (state.selectedAnswers.includes(key)) {
            btn.classList.add('incorrect');
        }
    });
}

function updateScores() {
    scoreCorrectEl.textContent = `Correctas: ${state.score.correct}`;
    scoreIncorrectEl.textContent = `Incorrectas: ${state.score.incorrect}`;
}

function showResult() {
    resultAreaEl.classList.remove('hidden');
    checkBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
}

function resetButtons() {
    resultAreaEl.classList.add('hidden');
    checkBtn.classList.remove('hidden');
    nextBtn.classList.add('hidden');
    checkBtn.disabled = true;
    state.selectedAnswers = [];
}

function goToNextQuestion() {
    state.currentQuestionIndex++;
        const progress = ((state.currentQuestionIndex) / state.activeQuizData.length) * 100;
    progressBarEl.style.width = `${progress}%`;
    
    if (state.currentQuestionIndex >= state.activeQuizData.length) {
        showFinalScreen();
    } else {
        renderQuestion();
    }
}

function showFinalScreen() {
    questionAreaEl.classList.add('hidden');
    progressContainer.classList.add('hidden');
    checkBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    progressBarEl.parentElement.classList.add('hidden');

    finalScoreCorrectEl.textContent = `Correctas: ${state.score.correct}`;
    finalScoreIncorrectEl.textContent = `Incorrectas: ${state.score.incorrect}`;
    finalScreenEl.classList.remove('hidden');
}

// Event Listeners
allQuestionsBtn.addEventListener('click', () => startQuiz('all'));
backToCategoriesBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
checkBtn.addEventListener('click', checkAnswer);
nextBtn.addEventListener('click', goToNextQuestion);

// Init app

fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        // Asignar los datos del cuestionario
        quizData.push(...data);
        categories.push(...new Set(quizData.map(q => q.category)));
        init();
    })
    .catch(error => console.error('Error al cargar el cuestionario:', error));