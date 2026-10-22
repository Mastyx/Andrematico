/* ==========================================================================
   AndreMatico — un'avventura matematica in bicicletta
   200 domande · 20 compiti a partita · mappa esplorabile · finale con impennata
   ========================================================================== */
(() => {
  'use strict';

  // ======================= COSTANTI E DATI =======================

  const WORLD = { w: 2200, h: 1700 };
  const TAU = Math.PI * 2;
  const SPAWN = { x: 1100, y: 900 };
  const STEP = 1 / 60;
  const PLAYER_SPEED = 292;
  const INTERACT_DIST = 100;

  const ZONES = {
    numeri: {
      id: 'numeri',
      name: 'Prato dei Numeri',
      icon: '🔢',
      color: '#e9a62c',
      dark: '#8d5c0d',
      soft: '#f6df9c',
      center: { x: 500, y: 470 },
      radius: 335
    },
    forme: {
      id: 'forme',
      name: 'Bosco delle Forme',
      icon: '📐',
      color: '#4f9b6a',
      dark: '#265f3e',
      soft: '#b5ddba',
      center: { x: 1710, y: 470 },
      radius: 335
    },
    problemi: {
      id: 'problemi',
      name: 'Collina dei Problemi',
      icon: '📖',
      color: '#dd7652',
      dark: '#8d3f26',
      soft: '#f6cbb8',
      center: { x: 500, y: 1220 },
      radius: 335
    },
    logica: {
      id: 'logica',
      name: 'Lago della Logica',
      icon: '💡',
      color: '#538fbc',
      dark: '#2e5c82',
      soft: '#b9d9ea',
      center: { x: 1710, y: 1220 },
      radius: 335
    }
  };

  // ======================= ARCHIVIO DOMANDE =======================

  const TOPIC_META = {
    numeri: { label: 'Numeri' },
    calcolo: { label: 'Calcolo' },
    geometria: { label: 'Geometria' },
    problemi: { label: 'Problemi e misure' },
    logica: { label: 'Logica' }
  };

  const BANK_RAW = window.QUESTION_BANK || {};
  const BANK_BY_TOPIC = {};
  let BANK_TOTAL = 0;

  (function normalizeQuestionBank() {
    for (const topic of Object.keys(TOPIC_META)) {
      const rawList = Array.isArray(BANK_RAW[topic]) ? BANK_RAW[topic] : [];
      const normalized = [];
      rawList.forEach((item, index) => {
        if (!item || !item.t || !Array.isArray(item.o) || item.o.length !== 4 ||
            !item.o.includes(item.a) || new Set(item.o).size !== 4) {
          console.warn(`Domanda non valida nell'archivio: ${topic}[${index}]`);
          return;
        }
        normalized.push({
          id: `${topic}-${index + 1}`,
          category: topic,
          topic: TOPIC_META[topic].label,
          text: item.t,
          options: item.o.slice(),
          answer: item.a,
          hint: item.h || 'Rileggi la domanda e ragiona un passaggio alla volta.',
          explanation: item.e || `La risposta corretta è ${item.a}.`,
          diagram: item.d || null
        });
      });
      BANK_BY_TOPIC[topic] = normalized;
      BANK_TOTAL += normalized.length;
    }
  })();

  const ZONE_TOPIC_POOLS = {
    numeri: ['numeri', 'calcolo'],
    forme: ['geometria'],
    problemi: ['problemi'],
    logica: ['logica']
  };

  // ======================= POSIZIONI E COMPITI =======================

  const TASK_ZONE_ORDER = [
    'numeri', 'numeri', 'numeri', 'numeri', 'numeri',
    'forme', 'forme', 'forme', 'forme', 'forme',
    'problemi', 'problemi', 'problemi', 'problemi', 'problemi',
    'logica', 'logica', 'logica', 'logica', 'logica'
  ];

  const TASK_POSITIONS = [
    { x: 335, y: 335 }, { x: 515, y: 245 }, { x: 680, y: 350 }, { x: 345, y: 575 }, { x: 630, y: 600 },
    { x: 1545, y: 300 }, { x: 1740, y: 245 }, { x: 1915, y: 430 }, { x: 1535, y: 555 }, { x: 1790, y: 610 },
    { x: 300, y: 1155 }, { x: 515, y: 1075 }, { x: 705, y: 1190 }, { x: 340, y: 1375 }, { x: 605, y: 1430 },
    { x: 1510, y: 1150 }, { x: 1730, y: 1065 }, { x: 1915, y: 1210 }, { x: 1560, y: 1390 }, { x: 1840, y: 1425 }
  ];

  const TASKS = TASK_POSITIONS.map((pos, i) => ({
    id: i + 1,
    x: pos.x,
    y: pos.y,
    zone: TASK_ZONE_ORDER[i],
    done: false,
    attempts: 0,
    stars: 0
  }));

  function drawFromBank(topic, count, used, avoid = new Set()) {
    const all = BANK_BY_TOPIC[topic] || [];
    let available = all.filter(q => !used.has(q.id) && !avoid.has(q.id));
    // Se l'archivio di un argomento è quasi esaurito, riammette le domande già viste.
    if (available.length < count) available = all.filter(q => !used.has(q.id));
    return shuffle(available).slice(0, count);
  }

  function pickRunQuestions() {
    const used = new Set();
    const picks = {};

    // Il Prato dei Numeri mescola sempre numeri e calcolo.
    const numeriCount = Math.random() < 0.5 ? 2 : 3;
    picks.numeri = shuffle([
      ...drawFromBank('numeri', numeriCount, used, state.lastRunIds),
      ...drawFromBank('calcolo', 5 - numeriCount, used, state.lastRunIds)
    ]);
    picks.forme = drawFromBank('geometria', 5, used, state.lastRunIds);
    picks.problemi = drawFromBank('problemi', 5, used, state.lastRunIds);
    picks.logica = drawFromBank('logica', 5, used, state.lastRunIds);

    const cursors = { numeri: 0, forme: 0, problemi: 0, logica: 0 };
    return TASKS.map(task => {
      const q = picks[task.zone][cursors[task.zone]++];
      return { ...q, zone: task.zone };
    });
  }

  function prepareRunQuestions() {
    let selected = [];
    let signature = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      selected = pickRunQuestions();
      signature = selected.map(q => q.id).join('|');
      if (signature !== state.runSignature) break;
    }
    state.runQuestions = selected;
    state.runSignature = signature;
    state.lastRunIds = new Set(selected.map(q => q.id));
  }

  const PATHS = [
    [{ x: 1100, y: 900 }, { x: 960, y: 850 }, { x: 815, y: 775 }, { x: 665, y: 705 }, { x: 575, y: 615 }, { x: 500, y: 505 }],
    [{ x: 1100, y: 900 }, { x: 1235, y: 840 }, { x: 1405, y: 765 }, { x: 1550, y: 690 }, { x: 1645, y: 590 }, { x: 1710, y: 500 }],
    [{ x: 1100, y: 900 }, { x: 1030, y: 1010 }, { x: 905, y: 1090 }, { x: 775, y: 1145 }, { x: 645, y: 1190 }, { x: 530, y: 1215 }],
    [{ x: 1100, y: 900 }, { x: 1205, y: 995 }, { x: 1365, y: 1075 }, { x: 1510, y: 1145 }, { x: 1635, y: 1195 }, { x: 1710, y: 1225 }]
  ];

  const POND = { x: 1105, y: 280, rx: 136, ry: 92 };
  const CROP_FIELD = { x: 785, y: 225, w: 188, h: 255 };

  // ======================= RIFERIMENTI DOM =======================

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const dom = {
    app: $('#app'),
    stage: $('#stage'),
    canvas: $('#gameCanvas'),
    minimap: $('#minimap'),
    minimapCount: $('#minimapCount'),
    hudDone: $('#hudDone'),
    hudStars: $('#hudStars'),
    hudScore: $('#hudScore'),
    hudBar: $('#hudBar'),
    zoneChip: $('#zoneChip'),
    zoneChipIcon: $('#zoneChipIcon'),
    zoneChipName: $('#zoneChipName'),
    interactPrompt: $('#interactPrompt'),
    promptZone: $('#promptZone'),
    promptText: $('#promptText'),
    touchAction: $('#touchAction'),
    toast: $('#toast'),
    startScreen: $('#startScreen'),
    startBtn: $('#startBtn'),
    startHelpBtn: $('#startHelpBtn'),
    bankPill: $('#bankPill'),
    bestNote: $('#bestNote'),
    victoryScreen: $('#victoryScreen'),
    victoryStars: $('#victoryStars'),
    victoryScore: $('#victoryScore'),
    victoryRecord: $('#victoryRecord'),
    replayBtn: $('#replayBtn'),
    exploreBtn: $('#exploreBtn'),
    quizModal: $('#quizModal'),
    quizCard: $('.quiz-card'),
    quizBackdrop: $('#quizBackdrop'),
    quizAccent: $('#quizAccent'),
    quizZoneIcon: $('#quizZoneIcon'),
    quizZoneName: $('#quizZoneName'),
    quizNumber: $('#quizNumber'),
    quizGlobalBar: $('#quizGlobalBar'),
    quizTopic: $('#quizTopic'),
    quizQuestion: $('#quizQuestion'),
    quizDiagram: $('#quizDiagram'),
    quizAnswers: $('#quizAnswers'),
    quizFeedback: $('#quizFeedback'),
    quizTries: $('#quizTries'),
    quizContinue: $('#quizContinue'),
    quizClose: $('#quizClose'),
    speakBtn: $('#speakBtn'),
    helpModal: $('#helpModal'),
    helpClose: $('#helpClose'),
    helpPlayBtn: $('#helpPlayBtn'),
    helpBtn: $('#helpBtn'),
    restartBtn: $('#restartBtn'),
    soundBtn: $('#soundBtn'),
    soundIcon: $('#soundIcon'),
    confettiLayer: $('#confettiLayer')
  };

  const ctx = dom.canvas.getContext('2d');
  const mctx = dom.minimap.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ======================= STATO =======================

  const state = {
    started: false,
    mode: 'map',
    quizOpen: false,
    helpOpen: false,
    victory: false,
    preview: false,
    dpr: 1,
    viewW: 1,
    viewH: 1,
    lastTime: 0,
    time: 0,
    completed: 0,
    stars: 0,
    score: 0,
    runQuestions: [],
    runSignature: '',
    lastRunIds: new Set(),
    bankTotal: BANK_TOTAL,
    activeTask: null,
    attempts: 0,
    answered: false,
    quizOptions: [],
    currentCorrectIndex: -1,
    solvedActive: false,
    player: {
      x: SPAWN.x,
      y: SPAWN.y,
      vx: 0,
      vy: 0,
      speed: 0,
      facing: 1
    },
    cam: { x: 0, y: 0 },
    keys: new Set(),
    touchKeys: new Set(),
    nearTask: null,
    currentZone: null,
    announcedZones: new Set(),
    wheelAngle: 0,
    pedal: 0,
    dustTimer: 0,
    dust: [],
    victoryStart: 0,
    victorySparks: [],
    victoryConfettiTimer: null,
    toastTimer: null,
    soundMuted: false,
    best: 0,
    audioReady: false
  };

  let baseWorld = null;
  let props = [];
  let pathSamples = [];
  let lastZoneToastAt = 0;
  let lastPromptTask = null;

  // ======================= UTILITÀ =======================

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rnd(rng, min, max) {
    return min + rng() * (max - min);
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function roundedRect(g, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + radius, y);
    g.arcTo(x + w, y, x + w, y + h, radius);
    g.arcTo(x + w, y + h, x, y + h, radius);
    g.arcTo(x, y + h, x, y, radius);
    g.arcTo(x, y, x + w, y, radius);
    g.closePath();
  }

  function catmullPoint(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function smoothPath(g, pts) {
    if (!pts.length) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      g.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
  }

  function samplePath(pts, step = 12) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const n = Math.max(3, Math.ceil(dist(p1, p2) / step));
      for (let j = 0; j < n; j++) {
        out.push(catmullPoint(p0, p1, p2, p3, j / n));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function minDistToPath(x, y) {
    let best = Infinity;
    for (const p of pathSamples) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  function pointNearTask(x, y, radius = 95) {
    return TASKS.some(t => Math.hypot(t.x - x, t.y - y) < radius);
  }

  function inPond(x, y, margin = 1.2) {
    return ((x - POND.x) / (POND.rx * margin)) ** 2 + ((y - POND.y) / (POND.ry * margin)) ** 2 < 1;
  }

  function inField(x, y, margin = 18) {
    return x > CROP_FIELD.x - margin && x < CROP_FIELD.x + CROP_FIELD.w + margin &&
      y > CROP_FIELD.y - margin && y < CROP_FIELD.y + CROP_FIELD.h + margin;
  }

  function findTask(id) {
    return TASKS.find(t => t.id === id);
  }

  function resetTaskState() {
    for (const t of TASKS) {
      t.done = false;
      t.attempts = 0;
      t.stars = 0;
    }
    state.completed = 0;
    state.stars = 0;
    state.score = 0;
    state.activeTask = null;
    state.nearTask = null;
    state.announcedZones.clear();
  }

  // ======================= AUDIO =======================

  const Audio = {
    api: null,
    master: null,
    init() {
      if (state.audioReady) {
        if (this.api && this.api.state === 'suspended') this.api.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.api = new Ctx();
        this.master = this.api.createGain();
        this.master.gain.value = state.soundMuted ? 0 : 0.24;
        this.master.connect(this.api.destination);
        state.audioReady = true;
      } catch (e) {
        state.audioReady = false;
      }
    },
    note(freq, duration = 0.16, type = 'sine', delay = 0, volume = 1) {
      if (!this.api || state.soundMuted) return;
      const t = this.api.currentTime + delay;
      const osc = this.api.createOscillator();
      const gain = this.api.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.45 * volume, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    },
    slide(from, to, duration = 0.22, type = 'sine', volume = 0.8) {
      if (!this.api || state.soundMuted) return;
      const t = this.api.currentTime;
      const osc = this.api.createOscillator();
      const gain = this.api.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + duration);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    },
    click() {
      this.init();
      this.note(620, 0.06, 'triangle', 0, 0.6);
    },
    open() {
      this.init();
      this.slide(330, 760, 0.18, 'sine', 0.65);
      this.note(900, 0.1, 'triangle', 0.12, 0.5);
    },
    wrong() {
      this.init();
      this.slide(220, 135, 0.24, 'square', 0.35);
    },
    correct() {
      this.init();
      this.note(523.25, 0.14, 'triangle', 0, 0.8);
      this.note(659.25, 0.14, 'triangle', 0.1, 0.8);
      this.note(783.99, 0.22, 'triangle', 0.2, 0.9);
    },
    complete() {
      this.init();
      this.note(659.25, 0.12, 'sine', 0, 0.7);
      this.note(783.99, 0.12, 'sine', 0.1, 0.7);
      this.note(1046.5, 0.24, 'sine', 0.2, 0.8);
    },
    win() {
      this.init();
      const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => this.note(f, i === seq.length - 1 ? 0.55 : 0.18, 'triangle', i * 0.13, 0.75));
      this.note(261.63, 0.7, 'sine', 0, 0.35);
      this.note(392, 0.7, 'sine', 0.35, 0.3);
    }
  };

  // ======================= COSTRUZIONE MONDO =======================

  pathSamples = PATHS.flatMap(pts => samplePath(pts, 10));

  function drawZoneGround(g, rng) {
    for (const zone of Object.values(ZONES)) {
      const { x, y } = zone.center;
      const radius = 320;
      const grad = g.createRadialGradient(x, y, 30, x, y, radius);
      grad.addColorStop(0, hexA(zone.soft, 0.64));
      grad.addColorStop(0.55, hexA(zone.soft, 0.28));
      grad.addColorStop(1, hexA(zone.soft, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, radius, 0, TAU);
      g.fill();

      g.save();
      g.strokeStyle = hexA(zone.color, 0.42);
      g.lineWidth = 3;
      g.setLineDash([4, 17]);
      g.beginPath();
      g.arc(x, y, radius * 0.83, 0, TAU);
      g.stroke();
      g.setLineDash([]);

      // piccoli fiori sul bordo della radura
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + rng() * 0.13;
        const rr = radius * (0.81 + rng() * 0.06);
        drawFlower(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, pick(rng, ['#fff5cf', '#f6b7c0', '#c8b4ea', '#f6de78']), 1.1);
      }
      g.restore();
    }
  }

  function drawFlower(g, x, y, color, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.strokeStyle = '#4f843e';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 7);
    g.stroke();
    g.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.beginPath();
      g.ellipse(Math.cos(a) * 2.5, Math.sin(a) * 2.5 - 2, 2.3, 2.3, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#f1b93b';
    g.beginPath();
    g.arc(0, -2, 1.7, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawGrassTuft(g, x, y, scale = 1) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = 'rgba(54, 107, 47, .55)';
    g.lineWidth = 1.35;
    g.lineCap = 'round';
    const blades = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < blades; i++) {
      const dx = (i - (blades - 1) / 2) * 2.8;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(dx * 0.8, -4 * scale, dx, -7 * scale - Math.random() * 4);
      g.stroke();
    }
    g.restore();
  }

  function drawPath(g, pts) {
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(126, 100, 57, .4)';
    g.lineWidth = 76;
    smoothPath(g, pts);
    g.stroke();
    g.strokeStyle = '#c7a46c';
    g.lineWidth = 64;
    smoothPath(g, pts);
    g.stroke();
    g.strokeStyle = '#e8ca94';
    g.lineWidth = 55;
    smoothPath(g, pts);
    g.stroke();
    g.strokeStyle = 'rgba(255, 242, 205, .35)';
    g.lineWidth = 38;
    smoothPath(g, pts);
    g.stroke();

    // sassolini e texture del sentiero
    const rng = mulberry32(pts[0].x + pts[0].y + pts.length * 91);
    for (const p of samplePath(pts, 17)) {
      if (rng() < 0.46) {
        g.fillStyle = `rgba(158, 120, 70, ${0.12 + rng() * 0.18})`;
        g.beginPath();
        g.ellipse(p.x + rnd(rng, -20, 20), p.y + rnd(rng, -20, 20), rnd(rng, 1, 3.6), rnd(rng, 1, 2.2), rng() * TAU, 0, TAU);
        g.fill();
      }
      if (rng() < 0.18) {
        g.fillStyle = 'rgba(255, 247, 219, .42)';
        g.beginPath();
        g.arc(p.x + rnd(rng, -17, 17), p.y + rnd(rng, -17, 17), rnd(rng, 1, 2.3), 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function drawPond(g) {
    const { x, y, rx, ry } = POND;
    g.save();

    // riva
    g.fillStyle = 'rgba(91, 126, 60, .36)';
    g.beginPath();
    g.ellipse(x, y + 6, rx + 20, ry + 15, -0.04, 0, TAU);
    g.fill();

    const water = g.createRadialGradient(x - 26, y - 18, 6, x, y, rx);
    water.addColorStop(0, '#86d3dc');
    water.addColorStop(0.55, '#55b0c8');
    water.addColorStop(1, '#3b8cac');
    g.fillStyle = water;
    g.beginPath();
    g.ellipse(x, y, rx, ry, -0.04, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(37, 107, 120, .4)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, y, rx - 3, ry - 3, -0.04, 0, TAU);
    g.stroke();

    // onde e riflessi
    g.strokeStyle = 'rgba(239, 255, 245, .55)';
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ox = x - 72 + (i % 4) * 45;
      const oy = y - 35 + Math.floor(i / 4) * 56 + (i % 2) * 7;
      g.beginPath();
      g.arc(ox, oy, 15 + (i % 3) * 5, 0.1, Math.PI - 0.2);
      g.stroke();
    }

    // ninfee
    const pads = [[-55, -18, 11], [35, -34, 9], [64, 22, 12], [-22, 35, 8], [105, 8, 7]];
    for (const [dx, dy, r] of pads) {
      g.fillStyle = '#5d9a4b';
      g.beginPath();
      g.ellipse(x + dx, y + dy, r, r * 0.66, -0.2, 0, TAU);
      g.fill();
      g.fillStyle = '#7ab85d';
      g.beginPath();
      g.ellipse(x + dx - 2, y + dy - 2, r * 0.62, r * 0.4, -0.2, 0, TAU);
      g.fill();
      if (r > 8) {
        g.fillStyle = '#f7b4c5';
        g.beginPath();
        g.arc(x + dx + 3, y + dy - 2, 3.2, 0, TAU);
        g.fill();
      }
    }

    // canne
    g.strokeStyle = '#5f8a39';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const bx = x + side * (rx - 3) + (i % 5) * 5 * side;
      const by = y + (i % 3) * 18 - 34;
      g.beginPath();
      g.moveTo(bx, by + 32);
      g.quadraticCurveTo(bx + side * 3, by + 8, bx + side * 6 + (i % 2) * 3, by - 12);
      g.stroke();
    }
    g.restore();
  }

  function drawCropField(g, rng) {
    const f = CROP_FIELD;
    g.save();
    g.fillStyle = '#8e6b3f';
    roundedRect(g, f.x, f.y, f.w, f.h, 12);
    g.fill();
    g.strokeStyle = '#75562f';
    g.lineWidth = 3;
    g.stroke();

    for (let row = 0; row < 7; row++) {
      const yy = f.y + 22 + row * 33;
      g.strokeStyle = '#a9814c';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(f.x + 10, yy + 2);
      g.quadraticCurveTo(f.x + f.w / 2, yy - 3, f.x + f.w - 10, yy + 2);
      g.stroke();
      for (let col = 0; col < 6; col++) {
        const xx = f.x + 20 + col * 29 + (row % 2) * 7;
        g.fillStyle = row % 2 ? '#7aae50' : '#6da244';
        g.beginPath();
        g.ellipse(xx, yy - 3, 6, 4, rng() * 0.4, 0, TAU);
        g.fill();
        g.fillStyle = '#d1d85e';
        g.beginPath();
        g.arc(xx + 3, yy - 6, 1.4, 0, TAU);
        g.fill();
      }
    }

    // piccolo cartello del campo
    g.fillStyle = '#70512e';
    g.fillRect(f.x + f.w - 26, f.y + f.h - 22, 4, 30);
    g.fillStyle = '#f1dfae';
    roundedRect(g, f.x + f.w - 46, f.y + f.h - 35, 43, 20, 4);
    g.fill();
    g.strokeStyle = '#70512e';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#715a34';
    g.font = '600 8px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.fillText('ORTO', f.x + f.w - 24.5, f.y + f.h - 21);
    g.restore();
  }

  function drawWireFence(g, x1, y1, x2, y2, lengthPx = 1) {
    g.save();
    g.translate(x1, y1);
    g.rotate(Math.atan2(y2 - y1, x2 - x1));
    const length = Math.hypot(x2 - x1, y2 - y1) * lengthPx;
    const postEvery = 78;
    const posts = Math.max(2, Math.floor(length / postEvery));

    // fili
    g.strokeStyle = 'rgba(72, 77, 67, .55)';
    g.lineWidth = 1.4;
    for (let w = 0; w < 3; w++) {
      g.beginPath();
      g.moveTo(0, -12 - w * 15);
      g.quadraticCurveTo(length / 2, -8 - w * 15 + 4, length, -12 - w * 15);
      g.stroke();
    }

    // pali
    for (let i = 0; i <= posts; i++) {
      const x = (i / posts) * length;
      g.fillStyle = '#795c36';
      g.fillRect(x - 3.5, -57, 7, 62);
      g.fillStyle = '#a37c47';
      g.fillRect(x - 2.5, -56, 3, 59);
      g.fillStyle = '#5f472b';
      g.beginPath();
      g.arc(x, -58, 4, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function drawStartPlaza(g) {
    const grad = g.createRadialGradient(SPAWN.x, SPAWN.y, 10, SPAWN.x, SPAWN.y, 120);
    grad.addColorStop(0, 'rgba(240, 211, 155, .85)');
    grad.addColorStop(0.7, 'rgba(220, 185, 123, .62)');
    grad.addColorStop(1, 'rgba(210, 174, 112, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(SPAWN.x, SPAWN.y, 120, 0, TAU);
    g.fill();

    g.save();
    g.translate(SPAWN.x, SPAWN.y + 18);
    g.rotate(-0.07);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f8efd0' : '#3f4b3d';
      g.fillRect(i * 12 - 48, 0, 12, 8);
      g.fillStyle = i % 2 ? '#3f4b3d' : '#f8efd0';
      g.fillRect(i * 12 - 48, 8, 12, 8);
    }
    g.restore();
  }

  function drawWorldBorder(g) {
    const edge = 54;
    const grads = [
      [0, 0, WORLD.w, edge, '#376b3c'],
      [0, WORLD.h - edge, WORLD.w, edge, '#376b3c'],
      [0, 0, edge, WORLD.h, '#376b3c'],
      [WORLD.w - edge, 0, edge, WORLD.h, '#376b3c']
    ];
    for (const [x, y, w, h, color] of grads) {
      g.fillStyle = color;
      g.fillRect(x, y, w, h);
    }

    const rng = mulberry32(8441);
    for (let i = 0; i < 130; i++) {
      let x, y;
      if (i < 40) { x = rnd(rng, 0, WORLD.w); y = rnd(rng, 4, 46); }
      else if (i < 80) { x = rnd(rng, 0, WORLD.w); y = rnd(rng, WORLD.h - 46, WORLD.h - 2); }
      else if (i < 105) { x = rnd(rng, 2, 45); y = rnd(rng, 0, WORLD.h); }
      else { x = rnd(rng, WORLD.w - 45, WORLD.w - 2); y = rnd(rng, 0, WORLD.h); }
      g.fillStyle = pick(rng, ['#4b8345', '#5d9650', '#3e743d']);
      g.beginPath();
      g.arc(x, y, rnd(rng, 9, 25), 0, TAU);
      g.fill();
    }
  }

  function hexA(hex, alpha) {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(v, 16);
    const r = (num >> 16) & 255;
    const gg = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${gg}, ${b}, ${alpha})`;
  }

  function buildWorldBase() {
    const c = document.createElement('canvas');
    c.width = WORLD.w;
    c.height = WORLD.h;
    const g = c.getContext('2d');
    const rng = mulberry32(1937);

    const grad = g.createLinearGradient(0, 0, WORLD.w, WORLD.h);
    grad.addColorStop(0, '#97c76c');
    grad.addColorStop(0.35, '#86b95f');
    grad.addColorStop(0.7, '#7fb45a');
    grad.addColorStop(1, '#8fbe63');
    g.fillStyle = grad;
    g.fillRect(0, 0, WORLD.w, WORLD.h);

    // macchie di prato
    for (let i = 0; i < 120; i++) {
      const x = rnd(rng, 0, WORLD.w);
      const y = rnd(rng, 0, WORLD.h);
      const rx = rnd(rng, 45, 210);
      const ry = rnd(rng, 22, 100);
      g.fillStyle = pick(rng, [
        'rgba(170, 208, 106, .12)', 'rgba(101, 152, 67, .1)', 'rgba(212, 226, 135, .1)',
        'rgba(69, 130, 61, .07)', 'rgba(247, 233, 153, .09)'
      ]);
      g.beginPath();
      g.ellipse(x, y, rx, ry, rng() * TAU, 0, TAU);
      g.fill();
    }

    // filari di erba
    g.strokeStyle = 'rgba(62, 119, 46, .1)';
    g.lineWidth = 2;
    for (let i = 0; i < 38; i++) {
      const x = rnd(rng, 0, WORLD.w);
      const y = rnd(rng, 0, WORLD.h);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + rnd(rng, -60, 60), y - 60, x + rnd(rng, -80, 80), y - 120);
      g.stroke();
    }

    drawZoneGround(g, rng);
    drawCropField(g, rng);

    for (const pts of PATHS) drawPath(g, pts);

    drawStartPlaza(g);

    // radura iniziale e bordura
    drawPond(g);

    drawWireFence(g, 75, 145, 705, 132);
    drawWireFence(g, 1510, 154, 2120, 139);
    drawWireFence(g, 72, 1605, 690, 1587);

    // cespugli di erba e fiorellini sparsi
    let flowers = 0;
    let guard = 0;
    while (flowers < 420 && guard < 3000) {
      guard++;
      const x = rnd(rng, 70, WORLD.w - 70);
      const y = rnd(rng, 65, WORLD.h - 65);
      if (minDistToPath(x, y) < 30 || inPond(x, y, 1.08) || inField(x, y, 10)) continue;
      if (rng() < 0.33) {
        drawFlower(g, x, y, pick(rng, ['#fff7d2', '#f6b4c2', '#d6c5f0', '#f4dc70', '#f3a783']), rnd(rng, 0.7, 1.25));
      } else {
        drawGrassTuft(g, x, y, rnd(rng, 0.8, 1.6));
      }
      flowers++;
    }

    // sassi sparsi
    for (let i = 0; i < 80; i++) {
      const x = rnd(rng, 80, WORLD.w - 80);
      const y = rnd(rng, 80, WORLD.h - 80);
      if (minDistToPath(x, y) < 38 || inPond(x, y) || inField(x, y)) continue;
      g.fillStyle = pick(rng, ['#9a9a7c', '#b3ad8e', '#8e9278']);
      g.beginPath();
      g.ellipse(x, y, rnd(rng, 2, 6), rnd(rng, 1.5, 3.4), rng() * TAU, 0, TAU);
      g.fill();
    }

    drawWorldBorder(g);

    // ombra morbida sopra i bordi
    const vg = g.createRadialGradient(WORLD.w / 2, WORLD.h / 2, 500, WORLD.w / 2, WORLD.h / 2, 1450);
    vg.addColorStop(0, 'rgba(25, 57, 30, 0)');
    vg.addColorStop(1, 'rgba(25, 57, 30, .2)');
    g.fillStyle = vg;
    g.fillRect(0, 0, WORLD.w, WORLD.h);

    return c;
  }

  function generateProps() {
    const rng = mulberry32(6157);
    const list = [];
    const reserved = Object.values(ZONES).map(z => ({ x: z.center.x, y: z.center.y, r: 110 }));

    function canPlace(x, y, radius) {
      if (x < 115 || x > WORLD.w - 115 || y < 115 || y > WORLD.h - 115) return false;
      if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 150) return false;
      if (minDistToPath(x, y) < 58 + radius * 0.12) return false;
      if (pointNearTask(x, y, 105)) return false;
      if (inPond(x, y, 1.2)) return false;
      if (inField(x, y, 26)) return false;
      for (const r of reserved) if (Math.hypot(x - r.x, y - r.y) < r.r) return false;
      return true;
    }

    let attempts = 0;
    let trees = 0;
    while (trees < 64 && attempts < 1800) {
      attempts++;
      const x = rnd(rng, 100, WORLD.w - 100);
      const y = rnd(rng, 100, WORLD.h - 100);
      if (!canPlace(x, y, 40)) continue;
      const tall = rng() < 0.46;
      list.push({
        type: tall ? 'treeTall' : 'tree',
        x, y,
        scale: rnd(rng, 0.75, 1.28),
        seed: rnd(rng, 0, 100),
        variant: Math.floor(rng() * 3)
      });
      trees++;
    }

    let bushes = 0;
    attempts = 0;
    while (bushes < 34 && attempts < 900) {
      attempts++;
      const x = rnd(rng, 90, WORLD.w - 90);
      const y = rnd(rng, 90, WORLD.h - 90);
      if (!canPlace(x, y, 28)) continue;
      list.push({ type: 'bush', x, y, scale: rnd(rng, 0.7, 1.2), seed: rnd(rng, 0, 100), variant: Math.floor(rng() * 3) });
      bushes++;
    }

    let rocks = 0;
    attempts = 0;
    while (rocks < 18 && attempts < 500) {
      attempts++;
      const x = rnd(rng, 110, WORLD.w - 110);
      const y = rnd(rng, 110, WORLD.h - 110);
      if (!canPlace(x, y, 16)) continue;
      list.push({ type: 'rock', x, y, scale: rnd(rng, 0.7, 1.25), seed: rnd(rng, 0, 100) });
      rocks++;
    }

    let mushrooms = 0;
    attempts = 0;
    while (mushrooms < 16 && attempts < 400) {
      attempts++;
      const x = rnd(rng, 100, WORLD.w - 100);
      const y = rnd(rng, 100, WORLD.h - 100);
      if (!canPlace(x, y, 14) || minDistToPath(x, y) < 74) continue;
      list.push({ type: 'mushroom', x, y, scale: rnd(rng, 0.6, 1), seed: rnd(rng, 0, 100) });
      mushrooms++;
    }

    // cartelli delle zone + arredi fissi
    for (const zone of Object.values(ZONES)) {
      list.push({ type: 'zoneSign', x: zone.center.x, y: zone.center.y + 6, zone, seed: 0, scale: 1 });
    }

    list.push({ type: 'startSign', x: 1202, y: 902, scale: 1 });
    list.push({ type: 'scarecrow', x: 875, y: 1345, scale: 1 });
    list.push({ type: 'haybale', x: 1345, y: 735, scale: 1 });
    list.push({ type: 'haybale', x: 1381, y: 759, scale: 0.9 });

    return list;
  }

  // ======================= DISEGNO SCENA =======================

  function drawTree(g, p, t) {
    const sway = reducedMotion ? 0 : Math.sin(t * 0.0012 + p.seed) * 1.8;
    const s = p.scale;
    g.save();
    g.translate(p.x, p.y);
    g.scale(s, s);

    // ombra
    g.fillStyle = 'rgba(37, 71, 34, .22)';
    g.beginPath();
    g.ellipse(0, 3, 35, 10, 0, 0, TAU);
    g.fill();

    g.fillStyle = '#7a5430';
    g.beginPath();
    g.moveTo(-5, 0);
    g.quadraticCurveTo(-4, -36, -1, -61);
    g.lineTo(5, -61);
    g.quadraticCurveTo(5, -32, 6, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#9a6d3d';
    g.fillRect(-1.5, -56, 2.4, 48);
    g.strokeStyle = '#6a4729';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(2, -50);
    g.quadraticCurveTo(12, -54, 17, -65);
    g.stroke();

    g.translate(sway, 0);
    if (p.type === 'treeTall') {
      const grad = g.createLinearGradient(-30, -135, 38, -45);
      grad.addColorStop(0, '#4d8f46');
      grad.addColorStop(0.55, '#6ba54d');
      grad.addColorStop(1, '#3c7b3b');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, -99, 34, 55, -0.05, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(155, 197, 105, .38)';
      g.beginPath();
      g.ellipse(-10, -118, 17, 29, 0.3, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(35, 94, 48, .3)';
      g.beginPath();
      g.ellipse(18, -76, 15, 26, -0.2, 0, TAU);
      g.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.fillStyle = i % 2 ? 'rgba(111, 168, 88, .72)' : 'rgba(67, 125, 60, .55)';
        g.beginPath();
        g.arc(Math.cos(a) * 23, -98 + Math.sin(a) * 39, 8 + (i % 3) * 2, 0, TAU);
        g.fill();
      }
    } else {
      const grad = g.createRadialGradient(-12, -80, 6, 0, -64, 54);
      grad.addColorStop(0, '#a9cb6c');
      grad.addColorStop(0.42, '#74ab51');
      grad.addColorStop(1, '#447f3b');
      g.fillStyle = grad;
      const blobs = [
        [0, -64, 35], [-24, -53, 22], [25, -52, 21], [-17, -82, 23],
        [19, -82, 22], [0, -94, 24], [-35, -73, 15], [35, -69, 14]
      ];
      for (const [bx, by, br] of blobs) {
        g.beginPath();
        g.arc(bx, by, br, 0, TAU);
        g.fill();
      }
      g.fillStyle = 'rgba(191, 218, 123, .32)';
      g.beginPath();
      g.ellipse(-13, -83, 20, 12, 0.4, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(46, 103, 44, .26)';
      g.beginPath();
      g.ellipse(18, -55, 18, 10, -0.2, 0, TAU);
      g.fill();
      if (p.variant === 1) {
        for (let i = 0; i < 8; i++) {
          const a = i * 2.3;
          g.fillStyle = '#e27b54';
          g.beginPath();
          g.arc(Math.cos(a) * 22, -67 + Math.sin(a) * 17, 2.4, 0, TAU);
          g.fill();
        }
      }
    }
    g.restore();
  }

  function drawBush(g, p, t) {
    const s = p.scale;
    const sway = reducedMotion ? 0 : Math.sin(t * 0.0017 + p.seed) * 0.7;
    g.save();
    g.translate(p.x + sway, p.y);
    g.scale(s, s);
    g.fillStyle = 'rgba(37, 71, 34, .18)';
    g.beginPath();
    g.ellipse(0, 2, 25, 7, 0, 0, TAU);
    g.fill();
    const tones = ['#4e8b43', '#67a24e', '#3f773c'];
    const blobs = [[-13, -9, 13], [0, -16, 17], [15, -10, 12], [5, -6, 14], [-5, -5, 11]];
    blobs.forEach((b, i) => {
      g.fillStyle = tones[i % tones.length];
      g.beginPath();
      g.arc(b[0], b[1], b[2], 0, TAU);
      g.fill();
    });
    g.fillStyle = 'rgba(183, 213, 119, .35)';
    g.beginPath();
    g.ellipse(-5, -18, 9, 5, -0.3, 0, TAU);
    g.fill();
    if (p.variant === 2) {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#ec7c72';
        g.beginPath();
        g.arc(-10 + i * 5, -13 + (i % 2) * 6, 2.3, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function drawRock(g, p) {
    const s = p.scale;
    g.save();
    g.translate(p.x, p.y);
    g.scale(s, s);
    g.fillStyle = 'rgba(42, 67, 37, .18)';
    g.beginPath();
    g.ellipse(0, 2, 20, 5.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#a4a68c';
    g.beginPath();
    g.moveTo(-16, 0);
    g.quadraticCurveTo(-14, -15, -3, -18);
    g.quadraticCurveTo(10, -20, 16, -7);
    g.quadraticCurveTo(18, 0, 13, 2);
    g.lineTo(-13, 2);
    g.closePath();
    g.fill();
    g.fillStyle = '#c2c0a3';
    g.beginPath();
    g.moveTo(-10, -4);
    g.quadraticCurveTo(-6, -15, 1, -15);
    g.quadraticCurveTo(7, -14, 9, -7);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(107, 111, 91, .6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(3, -16);
    g.lineTo(6, -6);
    g.stroke();
    g.restore();
  }

  function drawMushroom(g, p) {
    const s = p.scale;
    g.save();
    g.translate(p.x, p.y);
    g.scale(s, s);
    g.fillStyle = 'rgba(44, 72, 37, .16)';
    g.beginPath();
    g.ellipse(0, 1, 8, 3, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#f3e8cf';
    g.fillRect(-2, -8, 4, 8);
    g.fillStyle = '#d95c48';
    g.beginPath();
    g.arc(0, -10, 7.5, Math.PI, 0);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255, 245, 222, .8)';
    g.beginPath();
    g.arc(-3, -12, 1.2, 0, TAU);
    g.arc(3, -13, 1.3, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawHaybale(g, p) {
    const s = p.scale;
    g.save();
    g.translate(p.x, p.y);
    g.scale(s, s);
    g.fillStyle = 'rgba(42, 66, 35, .18)';
    g.beginPath();
    g.ellipse(0, 2, 25, 7, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#d9b75f';
    roundedRect(g, -23, -20, 46, 21, 6);
    g.fill();
    g.strokeStyle = '#b08c3c';
    g.lineWidth = 2;
    for (let i = -14; i < 16; i += 9) {
      g.beginPath();
      g.moveTo(i, -18);
      g.lineTo(i + 3, -2);
      g.stroke();
    }
    g.fillStyle = '#f0d27c';
    roundedRect(g, -18, -18, 16, 6, 3);
    g.fill();
    g.restore();
  }

  function drawScarecrow(g, p) {
    g.save();
    g.translate(p.x, p.y);
    g.fillStyle = 'rgba(42, 68, 35, .18)';
    g.beginPath();
    g.ellipse(0, 2, 24, 7, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#76512d';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -75);
    g.moveTo(-25, -50);
    g.lineTo(25, -50);
    g.stroke();
    g.fillStyle = '#d8b067';
    g.beginPath();
    g.ellipse(0, -52, 15, 18, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#a76c3e';
    g.beginPath();
    g.arc(0, -77, 11, 0, TAU);
    g.fill();
    g.fillStyle = '#7c5835';
    g.beginPath();
    g.ellipse(0, -86, 17, 4, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(0, -89, 7, Math.PI, TAU);
    g.fill();
    g.strokeStyle = '#5b3a22';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-5, -78);
    g.lineTo(-1, -78);
    g.moveTo(3, -78);
    g.lineTo(7, -78);
    g.moveTo(-3, -72);
    g.quadraticCurveTo(0, -69, 4, -72);
    g.stroke();
    g.fillStyle = '#d8b067';
    g.fillRect(-24, -51, 9, 20);
    g.fillRect(15, -51, 9, 20);
    g.restore();
  }

  function drawZoneSign(g, p) {
    const zone = p.zone;
    g.save();
    g.translate(p.x, p.y);
    g.fillStyle = 'rgba(38, 65, 34, .2)';
    g.beginPath();
    g.ellipse(0, 2, 55, 11, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#795a34';
    g.fillRect(-42, -60, 7, 62);
    g.fillRect(35, -60, 7, 62);
    g.fillStyle = '#a07744';
    g.fillRect(-40, -60, 3, 59);
    g.fillRect(37, -60, 3, 59);

    g.fillStyle = '#f8eed0';
    roundedRect(g, -70, -101, 140, 49, 11);
    g.fill();
    g.strokeStyle = zone.dark;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = zone.color;
    roundedRect(g, -70, -101, 31, 49, 10);
    g.fill();
    g.fillStyle = '#fffdf3';
    g.font = '600 20px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(zone.icon, -54.5, -77);
    g.fillStyle = zone.dark;
    g.font = '650 12.5px Fredoka, sans-serif';
    g.textAlign = 'left';
    const words = zone.name.toUpperCase().split(' ');
    let line = '';
    const lines = [];
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 14 && line) { lines.push(line); line = w; }
      else line = (line + ' ' + w).trim();
    }
    if (line) lines.push(line);
    const startY = lines.length > 1 ? -86 : -77;
    lines.forEach((l, i) => g.fillText(l, -30, startY + i * 14));
    g.restore();
  }

  function drawStartSign(g, p) {
    g.save();
    g.translate(p.x, p.y);
    g.fillStyle = 'rgba(39, 68, 35, .18)';
    g.beginPath();
    g.ellipse(0, 2, 29, 7, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#7a5731';
    g.fillRect(-3, -62, 6, 64);
    g.fillStyle = '#f8eed0';
    g.beginPath();
    g.moveTo(-28, -72);
    g.lineTo(34, -72);
    g.lineTo(44, -58);
    g.lineTo(34, -44);
    g.lineTo(-28, -44);
    g.closePath();
    g.fill();
    g.strokeStyle = '#3f6e45';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#365e3c';
    g.font = '650 11px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PARTENZA', 1, -57);
    g.fillStyle = '#5a8f4e';
    g.beginPath();
    g.moveTo(-3, -62);
    g.lineTo(-17, -71);
    g.lineTo(-17, -53);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawProps(g, t) {
    for (const p of props) {
      switch (p.type) {
        case 'tree':
        case 'treeTall': drawTree(g, p, t); break;
        case 'bush': drawBush(g, p, t); break;
        case 'rock': drawRock(g, p); break;
        case 'mushroom': drawMushroom(g, p); break;
        case 'haybale': drawHaybale(g, p); break;
        case 'scarecrow': drawScarecrow(g, p); break;
        case 'zoneSign': drawZoneSign(g, p); break;
        case 'startSign': drawStartSign(g, p); break;
      }
    }
  }

  function drawTaskMarker(g, task, t) {
    const zone = ZONES[task.zone];
    const isNear = state.nearTask === task;
    const bob = isNear && !task.done
      ? Math.sin(t * 0.009) * 4
      : Math.sin(t * 0.0028 + task.id * 1.7) * 1.2;

    g.save();
    g.translate(task.x, task.y);

    // ombra
    g.fillStyle = 'rgba(38, 64, 37, .23)';
    g.beginPath();
    g.ellipse(0, 2, 31, 8, 0, 0, TAU);
    g.fill();

    // alone di interazione
    if (!task.done) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.0034 + task.id);
      g.strokeStyle = hexA(zone.color, 0.22 + pulse * 0.25);
      g.lineWidth = 3;
      g.setLineDash([5, 8]);
      g.beginPath();
      g.arc(0, 1, 38 + pulse * 6, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = hexA(zone.color, 0.06 + pulse * 0.06);
      g.beginPath();
      g.arc(0, 1, 42, 0, TAU);
      g.fill();
    }

    // palo
    g.fillStyle = '#72542f';
    g.fillRect(-4, -56 + bob, 8, 58);
    g.fillStyle = '#a27a45';
    g.fillRect(-2, -54 + bob, 3, 54);

    const boardY = -105 + bob;
    const boardW = 60;
    const boardH = 61;

    // bandierina
    g.fillStyle = zone.color;
    g.beginPath();
    g.moveTo(3, boardY - 3);
    g.lineTo(22, boardY - 12);
    g.lineTo(22, boardY + 6);
    g.closePath();
    g.fill();

    // pannello
    g.fillStyle = task.done ? '#e5f3d5' : '#fff9e6';
    roundedRect(g, -boardW / 2, boardY, boardW, boardH, 12);
    g.fill();
    g.strokeStyle = task.done ? '#4f975c' : zone.color;
    g.lineWidth = 4;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 2;
    roundedRect(g, -boardW / 2 + 4, boardY + 4, boardW - 8, boardH - 8, 9);
    g.stroke();

    if (task.done) {
      g.fillStyle = '#3f8d52';
      g.beginPath();
      g.arc(0, boardY + 23, 16, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-7, boardY + 23);
      g.lineTo(-1, boardY + 29);
      g.lineTo(9, boardY + 16);
      g.stroke();
      g.fillStyle = '#3f7e4b';
      g.font = '650 8.5px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('FATTO', 0, boardY + 47);
      // stellina
      drawStar(g, 25, boardY + 2, 7, 3.4, '#f5c542', '#a97c1b');
    } else {
      g.fillStyle = zone.color;
      g.beginPath();
      g.arc(0, boardY + 19, 14, 0, TAU);
      g.fill();
      g.fillStyle = '#fffdf3';
      g.font = '650 17px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(task.id), 0, boardY + 19.5);
      g.fillStyle = zone.dark;
      g.font = '600 9px Fredoka, sans-serif';
      g.letterSpacing = '0.7px';
      g.fillText('COMPITO', 0, boardY + 41);
      g.letterSpacing = '0px';
      g.fillStyle = hexA(zone.color, 0.18);
      roundedRect(g, -15, boardY + 48, 30, 5, 2.5);
      g.fill();
    }

    // indicatore "vieni qui"
    if (isNear && !task.done) {
      const ay = boardY - 22 + Math.sin(t * 0.01) * 3;
      g.fillStyle = '#fff8dd';
      g.strokeStyle = '#2f583a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, ay + 9);
      g.lineTo(-8, ay);
      g.lineTo(8, ay);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function drawStar(g, x, y, outer, inner, fill, stroke) {
    g.save();
    g.translate(x, y);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + (i / 10) * TAU;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 1.2;
      g.stroke();
    }
    g.restore();
  }

  // ======================= PERSONAGGIO =======================

  function solveKnee(hip, foot, l1, l2, bend = 1) {
    let dx = foot.x - hip.x;
    let dy = foot.y - hip.y;
    let d = Math.hypot(dx, dy);
    d = clamp(d, Math.abs(l1 - l2) + 0.1, l1 + l2 - 0.1);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / (Math.hypot(dx, dy) || 1);
    const uy = dy / (Math.hypot(dx, dy) || 1);
    const mx = hip.x + ux * a;
    const my = hip.y + uy * a;
    return {
      x: mx - uy * h * bend,
      y: my + ux * h * bend
    };
  }

  function drawWheel(g, cx, cy, radius, angle, reflector = true) {
    g.save();
    g.translate(cx, cy);

    g.beginPath();
    g.arc(0, 0, radius + 2.7, 0, TAU);
    g.strokeStyle = '#20261f';
    g.lineWidth = 5.3;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, radius + 0.6, 0, TAU);
    g.strokeStyle = 'rgba(142, 150, 137, .5)';
    g.lineWidth = 1;
    g.stroke();

    g.rotate(angle);
    g.strokeStyle = 'rgba(192, 201, 187, .8)';
    g.lineWidth = 1.1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
      g.lineTo(Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2));
      g.stroke();
    }
    g.strokeStyle = '#7f897d';
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(0, 0, radius - 1.4, 0, TAU);
    g.stroke();
    g.fillStyle = '#aeb5a9';
    g.beginPath();
    g.arc(0, 0, 2.5, 0, TAU);
    g.fill();

    if (reflector) {
      g.fillStyle = '#f19b30';
      g.beginPath();
      g.ellipse(radius - 4, 1, 2.4, 1.7, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function drawLeg(g, hip, foot, pedalAngle, near, t) {
    // Il ginocchio deve stare davanti alla linea anca-pedale: è così che
    // la gamba appare piegata nel verso giusto mentre pedala.
    const knee = solveKnee(hip, foot, 25, 29, -0.68);
    const skin = near ? '#e7a35c' : '#c88749';
    const shade = near ? '#bd7a3e' : '#9d6537';
    const shorts = near ? '#3b4240' : '#2c322f';

    const shortEnd = {
      x: hip.x + (knee.x - hip.x) * 0.43,
      y: hip.y + (knee.y - hip.y) * 0.43
    };
    const sock = {
      x: knee.x + (foot.x - knee.x) * 0.82,
      y: knee.y + (foot.y - knee.y) * 0.82
    };

    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (!near) g.globalAlpha = 0.88;

    // Pantaloncino: copre la parte alta della coscia.
    g.strokeStyle = shorts;
    g.lineWidth = near ? 12.5 : 10.5;
    g.beginPath();
    g.moveTo(hip.x, hip.y);
    g.quadraticCurveTo(
      hip.x + (shortEnd.x - hip.x) * 0.55 + 1,
      hip.y + (shortEnd.y - hip.y) * 0.55,
      shortEnd.x, shortEnd.y
    );
    g.stroke();

    // Orlo del pantaloncino.
    g.strokeStyle = near ? '#555e58' : '#414945';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(shortEnd.x - 1, shortEnd.y - 5);
    g.lineTo(shortEnd.x + 5, shortEnd.y + 2.5);
    g.stroke();

    // Coscia.
    g.strokeStyle = skin;
    g.lineWidth = near ? 9.6 : 8.2;
    g.beginPath();
    g.moveTo(shortEnd.x, shortEnd.y);
    g.quadraticCurveTo(
      shortEnd.x + (knee.x - shortEnd.x) * 0.45 + 2,
      shortEnd.y + (knee.y - shortEnd.y) * 0.55,
      knee.x, knee.y
    );
    g.stroke();
    g.strokeStyle = shade;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(shortEnd.x + 2, shortEnd.y + 1);
    g.quadraticCurveTo(
      shortEnd.x + (knee.x - shortEnd.x) * 0.45 + 4,
      shortEnd.y + (knee.y - shortEnd.y) * 0.55 + 1,
      knee.x + 1, knee.y + 1
    );
    g.stroke();

    // Polpaccio.
    g.strokeStyle = skin;
    g.lineWidth = near ? 7.8 : 6.7;
    g.beginPath();
    g.moveTo(knee.x, knee.y);
    g.quadraticCurveTo(
      knee.x + (foot.x - knee.x) * 0.35 + 2,
      knee.y + (foot.y - knee.y) * 0.55,
      sock.x, sock.y
    );
    g.stroke();

    // Calzino bianco.
    g.strokeStyle = '#f4efe2';
    g.lineWidth = near ? 7.2 : 6.4;
    g.beginPath();
    g.moveTo(sock.x, sock.y);
    g.lineTo(foot.x, foot.y);
    g.stroke();
    g.strokeStyle = '#d8d0bf';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(sock.x, sock.y - 2.5);
    g.lineTo(sock.x + 1.5, sock.y + 2.5);
    g.stroke();

    // Scarpa.
    g.save();
    g.translate(foot.x + 2, foot.y + 2);
    const tilt = Math.sin(pedalAngle) * 0.14;
    g.rotate(tilt);
    g.fillStyle = '#2b312e';
    roundedRect(g, -7, -3.8, 15.5, 8, 3.2);
    g.fill();
    g.strokeStyle = '#151b18';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#f2eee0';
    g.beginPath();
    g.ellipse(1, 4.4, 7.4, 1.9, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#e97242';
    g.fillRect(-5, -2.7, 2.2, 1.5);
    g.fillStyle = 'rgba(255, 255, 255, .35)';
    g.fillRect(2, -2.7, 4.5, 1.1);
    g.restore();

    g.restore();
  }

  function drawRider(g, opts = {}) {
    const {
      wheelAngle = 0,
      pedal = 0,
      time = 0,
      shadow = true,
      dust = false,
      speed = 0
    } = opts;

    const R = 16;
    const rear = { x: -26, y: -R };
    const front = { x: 25, y: -R };
    const crank = { x: 0, y: -18 };
    const seat = { x: -9, y: -55 };
    const bar = { x: 24, y: -62 };
    const hip = { x: -8, y: -56 };
    const shoulder = { x: 8, y: -82 };
    const head = { x: 14, y: -92 };

    g.save();

    if (shadow) {
      g.fillStyle = 'rgba(31, 55, 30, .28)';
      g.beginPath();
      g.ellipse(0, 2, 47, 9, 0, 0, TAU);
      g.fill();
    }

    // polvere dietro la ruota
    if (dust) {
      for (let i = 0; i < 3; i++) {
        const a = time * 0.004 + i * 2.1;
        g.fillStyle = `rgba(220, 197, 150, ${0.25 - i * 0.05})`;
        g.beginPath();
        g.arc(-38 - i * 11 - Math.sin(a) * 2, -4 - i * 3, 5 + i * 2, 0, TAU);
        g.fill();
      }
    }

    // ruote
    drawWheel(g, rear.x, rear.y, R, wheelAngle, true);
    drawWheel(g, front.x, front.y, R, wheelAngle * 1.02, true);

    // pedali
    const nearPedalAngle = pedal;
    const farPedalAngle = pedal + Math.PI;
    const pedalNear = { x: crank.x + Math.cos(nearPedalAngle) * 8.5, y: crank.y + Math.sin(nearPedalAngle) * 8.5 };
    const pedalFar = { x: crank.x + Math.cos(farPedalAngle) * 8.5, y: crank.y + Math.sin(farPedalAngle) * 8.5 };

    g.strokeStyle = '#2a332c';
    g.lineWidth = 2.3;
    g.beginPath();
    g.moveTo(crank.x, crank.y);
    g.lineTo(pedalFar.x, pedalFar.y);
    g.stroke();
    g.fillStyle = '#353e36';
    g.fillRect(pedalFar.x - 4, pedalFar.y - 1.5, 8, 3);

    // gamba lontana
    drawLeg(g, { x: hip.x - 2, y: hip.y + 1 }, pedalFar, farPedalAngle, false, time);

    // telaio
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#1f2b21';
    g.lineWidth = 3.7;
    const frame = [
      [rear.x, rear.y, crank.x, crank.y],
      [crank.x, crank.y, seat.x, seat.y],
      [seat.x, seat.y, rear.x, rear.y],
      [crank.x, crank.y, bar.x, bar.y],
      [seat.x, seat.y, bar.x, bar.y],
      [bar.x, bar.y, front.x, front.y]
    ];
    for (const [x1, y1, x2, y2] of frame) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }

    // dettagli verdi del telaio
    g.strokeStyle = '#8acb47';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-2, -17);
    g.lineTo(20, -60);
    g.stroke();
    g.beginPath();
    g.moveTo(seat.x + 2, seat.y + 1);
    g.lineTo(bar.x - 2, bar.y + 1);
    g.stroke();
    g.fillStyle = '#8acb47';
    g.beginPath();
    g.moveTo(-26, -16);
    g.lineTo(-18, -20);
    g.lineTo(-19, -13);
    g.closePath();
    g.fill();

    // movimento centrale, corona e catena
    g.fillStyle = '#b4b8a8';
    g.beginPath();
    g.arc(crank.x, crank.y, 5.5, 0, TAU);
    g.fill();
    g.strokeStyle = '#6b7268';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(crank.x, crank.y, 5.5, 0, TAU);
    g.stroke();
    g.strokeStyle = '#303830';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(-26, -22);
    g.stroke();

    // sella
    g.fillStyle = '#252d27';
    g.beginPath();
    g.ellipse(-10, -57, 9.5, 3.4, -0.1, 0, TAU);
    g.fill();

    // manubrio
    g.strokeStyle = '#252d27';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(23, -63);
    g.quadraticCurveTo(28, -65, 29, -60);
    g.stroke();
    g.fillStyle = '#3c453d';
    roundedRect(g, 26, -63, 6, 4, 2);
    g.fill();

    // busto
    const bob = Math.sin(pedal * 2) * 0.7;
    g.save();
    g.translate(0, bob);

    g.fillStyle = '#dd3f2c';
    g.strokeStyle = '#a62b1f';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-9, -56);
    g.quadraticCurveTo(-7, -70, 1, -78);
    g.quadraticCurveTo(8, -86, 15, -82);
    g.lineTo(17, -73);
    g.quadraticCurveTo(13, -63, 7, -57);
    g.quadraticCurveTo(-1, -51, -9, -56);
    g.closePath();
    g.fill();
    g.stroke();

    // pannello nero sul petto
    g.fillStyle = '#262b2b';
    g.beginPath();
    g.moveTo(-2, -64);
    g.lineTo(2, -78);
    g.lineTo(10, -82);
    g.lineTo(8, -68);
    g.closePath();
    g.fill();

    // tre strisce sulla manica
    g.strokeStyle = '#252c2c';
    g.lineWidth = 2.2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(8 + i * 3, -80);
      g.lineTo(15 + i * 3, -77);
      g.stroke();
    }

    // pantaloncini
    g.fillStyle = '#343b38';
    g.strokeStyle = '#222825';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(-10, -58);
    g.quadraticCurveTo(-3, -57, 5, -54);
    g.quadraticCurveTo(10, -51, 8, -46);
    g.quadraticCurveTo(2, -42.5, -5, -44);
    g.quadraticCurveTo(-11, -48, -10, -58);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#59615b';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-7, -50);
    g.quadraticCurveTo(0, -47.5, 6, -49.5);
    g.stroke();

    // collo
    g.fillStyle = '#d89452';
    g.beginPath();
    g.ellipse(13, -82, 4.5, 3.4, 0.2, 0, TAU);
    g.fill();

    // testa
    g.fillStyle = '#e3a05c';
    g.beginPath();
    g.ellipse(head.x, head.y, 9.8, 10.8, 0.05, 0, TAU);
    g.fill();

    // orecchio
    g.fillStyle = '#cf8c4b';
    g.beginPath();
    g.ellipse(6.2, -92, 2.2, 3, 0, 0, TAU);
    g.fill();

    // capelli
    g.fillStyle = '#3b2b20';
    g.beginPath();
    g.arc(9, -94, 8.5, Math.PI * 0.58, Math.PI * 1.62);
    g.fill();
    g.beginPath();
    g.ellipse(6.5, -96, 4, 7, -0.2, 0, TAU);
    g.fill();

    // occhiali da sole blu
    const lensGrad = g.createLinearGradient(12, -99, 23, -87);
    lensGrad.addColorStop(0, '#7fd8ef');
    lensGrad.addColorStop(0.5, '#3a82b9');
    lensGrad.addColorStop(1, '#1f4e80');
    g.fillStyle = lensGrad;
    roundedRect(g, 10, -98, 14, 7.5, 3.2);
    g.fill();
    g.strokeStyle = '#223d4f';
    g.lineWidth = 1.1;
    g.stroke();
    g.strokeStyle = '#263e4a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(10, -95);
    g.lineTo(6, -94);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.ellipse(14.5, -96.5, 2.5, 1.2, -0.35, 0, TAU);
    g.fill();

    // sorriso
    g.strokeStyle = '#8f4d28';
    g.lineWidth = 1.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(16, -89.5, 3.7, 0.25, Math.PI * 0.72);
    g.stroke();

    // naso
    g.fillStyle = '#d28d4d';
    g.beginPath();
    g.moveTo(23, -93.5);
    g.quadraticCurveTo(25, -91.8, 23, -90.6);
    g.closePath();
    g.fill();

    // casco blu
    const helmetGrad = g.createLinearGradient(4, -105, 25, -89);
    helmetGrad.addColorStop(0, '#8ec3db');
    helmetGrad.addColorStop(0.55, '#5e94b3');
    helmetGrad.addColorStop(1, '#3d6c8d');
    g.fillStyle = helmetGrad;
    g.strokeStyle = '#315873';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(4, -97);
    g.quadraticCurveTo(2, -108, 13, -108.5);
    g.quadraticCurveTo(26, -108, 27, -96);
    g.quadraticCurveTo(19, -91, 8, -93);
    g.closePath();
    g.fill();
    g.stroke();

    // prese d'aria
    g.fillStyle = '#345a73';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(10 + i * 5.5, -102 + i * 0.7, 1.5, 3.2, -0.25, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#2d4d61';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(8, -93);
    g.quadraticCurveTo(12, -86, 17, -87);
    g.stroke();

    // braccio
    g.strokeStyle = '#e3a05c';
    g.lineWidth = 5.7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(10, -79);
    g.quadraticCurveTo(19, -73, 27, -63);
    g.stroke();
    g.strokeStyle = '#d18d4c';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(11, -78);
    g.quadraticCurveTo(19, -72, 26, -62);
    g.stroke();

    // mano
    g.fillStyle = '#d89452';
    g.beginPath();
    g.arc(28, -62, 3.3, 0, TAU);
    g.fill();

    g.restore();

    // pedale vicino: deve stare sotto la scarpa, non sopra
    g.strokeStyle = '#2a332c';
    g.lineWidth = 2.3;
    g.beginPath();
    g.moveTo(crank.x, crank.y);
    g.lineTo(pedalNear.x, pedalNear.y);
    g.stroke();
    g.fillStyle = '#434b43';
    g.fillRect(pedalNear.x - 4, pedalNear.y - 1.5, 8, 3);

    // gamba vicina, sopra al telaio
    drawLeg(g, hip, pedalNear, nearPedalAngle, true, time);

    g.restore();
  }

  function drawPlayer(g, t) {
    const p = state.player;
    const moving = p.speed > 25;
    const bob = moving ? Math.sin(state.pedal * 2) * 0.9 : Math.sin(t * 0.0022) * 0.5;
    g.save();
    g.translate(p.x, p.y + bob);
    g.scale(p.facing * 0.94, 0.94);
    drawRider(g, {
      wheelAngle: state.wheelAngle,
      pedal: state.pedal,
      time: t,
      shadow: true,
      dust: moving,
      speed: p.speed
    });
    g.restore();
  }

  // ======================= PARTICELLE =======================

  function spawnDust() {
    const p = state.player;
    for (let i = 0; i < 2; i++) {
      state.dust.push({
        x: p.x - p.facing * (28 + Math.random() * 12),
        y: p.y - 3 + (Math.random() - 0.5) * 8,
        vx: -p.facing * (12 + Math.random() * 22),
        vy: -8 - Math.random() * 15,
        life: 0.55 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 4
      });
    }
  }

  function updateDust(dt) {
    for (const d of state.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.94;
      d.vy -= 6 * dt;
      d.life -= dt;
    }
    state.dust = state.dust.filter(d => d.life > 0);
  }

  function drawDust(g) {
    for (const d of state.dust) {
      const a = clamp(d.life / d.maxLife, 0, 1);
      g.fillStyle = `rgba(224, 203, 158, ${a * 0.52})`;
      g.beginPath();
      g.arc(d.x, d.y, d.size * (1.25 - a * 0.35), 0, TAU);
      g.fill();
    }
  }

  // ======================= MINIMAPPA =======================

  function resizeMinimap() {
    const rect = dom.minimap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dom.minimap.width = Math.round(rect.width * dpr);
    dom.minimap.height = Math.round(rect.height * dpr);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx._w = rect.width;
    mctx._h = rect.height;
  }

  function drawMinimap() {
    const w = mctx._w || dom.minimap.getBoundingClientRect().width;
    const h = mctx._h || dom.minimap.getBoundingClientRect().height;
    if (!w || !h) return;
    mctx.clearRect(0, 0, w, h);

    const pad = 7;
    const scale = Math.min((w - pad * 2) / WORLD.w, (h - pad * 2) / WORLD.h);
    const ox = (w - WORLD.w * scale) / 2;
    const oy = (h - WORLD.h * scale) / 2;

    mctx.save();
    mctx.translate(ox, oy);
    mctx.fillStyle = '#8fbd67';
    mctx.fillRect(0, 0, WORLD.w * scale, WORLD.h * scale);

    // macchie delle zone
    for (const zone of Object.values(ZONES)) {
      mctx.fillStyle = hexA(zone.color, 0.3);
      mctx.beginPath();
      mctx.arc(zone.center.x * scale, zone.center.y * scale, zone.radius * scale, 0, TAU);
      mctx.fill();
    }

    // sentieri
    mctx.strokeStyle = 'rgba(246, 229, 184, .75)';
    mctx.lineWidth = Math.max(2, 34 * scale);
    mctx.lineCap = 'round';
    for (const pts of PATHS) {
      smoothPath(mctx, pts.map(p => ({ x: p.x * scale, y: p.y * scale })));
      mctx.stroke();
    }

    // laghetto
    mctx.fillStyle = 'rgba(76, 157, 190, .8)';
    mctx.beginPath();
    mctx.ellipse(POND.x * scale, POND.y * scale, POND.rx * scale, POND.ry * scale, 0, 0, TAU);
    mctx.fill();

    // compiti
    const r = Math.max(1.8, Math.min(3.2, w / 58));
    for (const task of TASKS) {
      const zone = ZONES[task.zone];
      mctx.fillStyle = task.done ? '#64b56d' : '#fff7dd';
      mctx.strokeStyle = task.done ? '#2e713b' : zone.dark;
      mctx.lineWidth = 1;
      mctx.beginPath();
      mctx.arc(task.x * scale, task.y * scale, r, 0, TAU);
      mctx.fill();
      mctx.stroke();
      if (task.done) {
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 1;
        mctx.beginPath();
        mctx.moveTo(task.x * scale - 1.4, task.y * scale);
        mctx.lineTo(task.x * scale - 0.2, task.y * scale + 1.2);
        mctx.lineTo(task.x * scale + 1.6, task.y * scale - 1.3);
        mctx.stroke();
      }
    }

    // giocatore
    const px = state.player.x * scale;
    const py = state.player.y * scale;
    mctx.fillStyle = 'rgba(39, 95, 134, .25)';
    mctx.beginPath();
    mctx.arc(px, py, 7, 0, TAU);
    mctx.fill();
    mctx.fillStyle = '#2f6ea4';
    mctx.strokeStyle = '#fffdf2';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(px + 4.7, py);
    mctx.lineTo(px - 3.8, py - 4.2);
    mctx.lineTo(px - 1.8, py);
    mctx.lineTo(px - 3.8, py + 4.2);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();

    // bordo
    mctx.strokeStyle = 'rgba(49, 83, 48, .4)';
    mctx.lineWidth = 1.5;
    mctx.strokeRect(0.75, 0.75, WORLD.w * scale - 1.5, WORLD.h * scale - 1.5);
    mctx.restore();

    dom.minimapCount.textContent = `${state.completed}/20`;
  }

  // ======================= RENDERING MAPPA =======================

  function resize() {
    const rect = dom.stage.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.viewW = w;
    state.viewH = h;
    state.dpr = dpr;
    dom.canvas.width = Math.round(w * dpr);
    dom.canvas.height = Math.round(h * dpr);
    dom.canvas.style.width = w + 'px';
    dom.canvas.style.height = h + 'px';
    resizeMinimap();
  }

  function cameraTarget() {
    const p = state.player;
    const viewW = state.viewW;
    const viewH = state.viewH;
    const maxX = Math.max(0, WORLD.w - viewW);
    const maxY = Math.max(0, WORLD.h - viewH);
    return {
      x: clamp(p.x - viewW / 2 + p.facing * 25, 0, maxX),
      y: clamp(p.y - viewH / 2 - 20, 0, maxY)
    };
  }

  function snapCamera() {
    const target = cameraTarget();
    state.cam.x = target.x;
    state.cam.y = target.y;
  }

  function updateCamera(dt) {
    const target = cameraTarget();
    const k = 1 - Math.exp(-5.2 * dt);
    state.cam.x = lerp(state.cam.x, target.x, k);
    state.cam.y = lerp(state.cam.y, target.y, k);
  }

  function drawMap(t) {
    const g = ctx;
    const { viewW, viewH, cam } = state;
    g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    g.clearRect(0, 0, viewW, viewH);

    g.save();
    g.translate(-cam.x, -cam.y);

    if (baseWorld) g.drawImage(baseWorld, 0, 0);

    drawDust(g);

    const renderables = [];
    for (const p of props) {
      renderables.push({ y: p.y, type: 'prop', data: p });
    }
    for (const task of TASKS) {
      renderables.push({ y: task.y, type: 'task', data: task });
    }
    renderables.push({ y: state.player.y, type: 'player' });
    renderables.sort((a, b) => a.y - b.y);

    for (const item of renderables) {
      if (item.type === 'prop') {
        const p = item.data;
        switch (p.type) {
          case 'tree':
          case 'treeTall': drawTree(g, p, t); break;
          case 'bush': drawBush(g, p, t); break;
          case 'rock': drawRock(g, p); break;
          case 'mushroom': drawMushroom(g, p); break;
          case 'haybale': drawHaybale(g, p); break;
          case 'scarecrow': drawScarecrow(g, p); break;
          case 'zoneSign': drawZoneSign(g, p); break;
          case 'startSign': drawStartSign(g, p); break;
        }
      } else if (item.type === 'task') {
        drawTaskMarker(g, item.data, t);
      } else {
        drawPlayer(g, t);
      }
    }

    g.restore();

    // vignettatura e luce calda
    const vg = g.createRadialGradient(viewW * 0.5, viewH * 0.45, Math.min(viewW, viewH) * 0.35, viewW * 0.5, viewH * 0.45, Math.max(viewW, viewH) * 0.75);
    vg.addColorStop(0, 'rgba(255, 246, 206, 0)');
    vg.addColorStop(1, 'rgba(27, 54, 31, .18)');
    g.fillStyle = vg;
    g.fillRect(0, 0, viewW, viewH);
  }

  // ======================= VITTORIA =======================

  function drawVictoryBackground(g, tSec) {
    const w = state.viewW;
    const h = state.viewH;
    const horizon = h * 0.69;

    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#79c3df');
    sky.addColorStop(0.5, '#bfe5df');
    sky.addColorStop(1, '#ffe2a0');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon + 2);

    // sole
    const sunX = w * 0.79;
    const sunY = h * 0.2;
    const sunR = Math.min(w, h) * 0.12;
    const halo = g.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.3);
    halo.addColorStop(0, 'rgba(255, 243, 165, .95)');
    halo.addColorStop(0.35, 'rgba(255, 222, 115, .35)');
    halo.addColorStop(1, 'rgba(255, 215, 100, 0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(sunX, sunY, sunR * 2.4, 0, TAU);
    g.fill();
    g.fillStyle = '#fff2a6';
    g.beginPath();
    g.arc(sunX, sunY, sunR, 0, TAU);
    g.fill();

    // nuvole stilizzate
    g.fillStyle = 'rgba(255, 253, 240, .7)';
    const clouds = [
      [w * 0.15, h * 0.13, 1.1, 0.8],
      [w * 0.43, h * 0.09, 0.7, 0.75],
      [w * 0.65, h * 0.18, 0.55, 0.55]
    ];
    for (const [cx, cy, cs, ca] of clouds) {
      g.globalAlpha = ca;
      g.beginPath();
      g.ellipse(cx, cy, 58 * cs, 17 * cs, 0, 0, TAU);
      g.ellipse(cx - 30 * cs, cy + 5 * cs, 28 * cs, 13 * cs, 0, 0, TAU);
      g.ellipse(cx + 35 * cs, cy + 6 * cs, 31 * cs, 14 * cs, 0, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // colline
    g.fillStyle = '#9ec477';
    g.beginPath();
    g.moveTo(0, horizon);
    g.quadraticCurveTo(w * 0.16, horizon - h * 0.14, w * 0.34, horizon);
    g.quadraticCurveTo(w * 0.54, horizon - h * 0.19, w * 0.76, horizon);
    g.quadraticCurveTo(w * 0.9, horizon - h * 0.1, w, horizon);
    g.lineTo(w, h * 0.8);
    g.lineTo(0, h * 0.8);
    g.closePath();
    g.fill();

    g.fillStyle = '#6ba654';
    g.beginPath();
    g.moveTo(0, horizon + 18);
    g.quadraticCurveTo(w * 0.2, horizon - 18, w * 0.44, horizon + 16);
    g.quadraticCurveTo(w * 0.7, horizon + 48, w, horizon + 8);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();

    // prato
    const grass = g.createLinearGradient(0, horizon, 0, h);
    grass.addColorStop(0, '#76ae55');
    grass.addColorStop(1, '#4d873f');
    g.fillStyle = grass;
    g.fillRect(0, horizon + 20, w, h - horizon);

    // strada/arena
    const roadY = h * 0.765;
    g.fillStyle = 'rgba(186, 148, 89, .28)';
    g.beginPath();
    g.ellipse(w * 0.5, roadY + 14, w * 0.52, h * 0.12, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(230, 199, 139, .65)';
    g.beginPath();
    g.ellipse(w * 0.5, roadY + 10, w * 0.44, h * 0.085, 0, 0, TAU);
    g.fill();

    // fili d'erba in primo piano
    g.strokeStyle = 'rgba(40, 89, 41, .4)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * w + ((i * 73) % 23);
      const base = h - ((i * 47) % 26);
      g.beginPath();
      g.moveTo(x, base);
      g.quadraticCurveTo(x + 5, base - 18, x + ((i % 3) - 1) * 8, base - 30 - (i % 4) * 4);
      g.stroke();
    }

    // bandierine
    g.strokeStyle = 'rgba(255, 251, 234, .65)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w * 0.06, h * 0.31);
    g.quadraticCurveTo(w * 0.28, h * 0.26, w * 0.46, h * 0.3);
    g.stroke();
    const flagColors = ['#f5c542', '#e96a48', '#5aa86c', '#fff4d0'];
    for (let i = 0; i < 8; i++) {
      const x = w * 0.08 + i * w * 0.046;
      const y = h * 0.306 + Math.sin(i * 0.8) * h * 0.008;
      g.fillStyle = flagColors[i % flagColors.length];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 16, y + 4);
      g.lineTo(x + 2, y + 16);
      g.closePath();
      g.fill();
    }

    // raggi del sole animati
    g.save();
    g.globalAlpha = 0.14;
    g.translate(sunX, sunY);
    g.rotate(tSec * 0.02);
    g.strokeStyle = '#fffbe0';
    g.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      g.rotate(TAU / 12);
      g.beginPath();
      g.moveTo(sunR * 1.25, 0);
      g.lineTo(sunR * 2.1, 0);
      g.stroke();
    }
    g.restore();
  }

  function drawVictoryScene(t) {
    const g = ctx;
    const w = state.viewW;
    const h = state.viewH;
    const elapsed = (t - state.victoryStart) / 1000;
    const scale = Math.min(4.2, Math.max(2.2, Math.min(w / 450, h / 205)));
    const groundY = h * 0.74;
    const cx = w * 0.5;

    g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    drawVictoryBackground(g, elapsed);

    // riflettore
    const spot = g.createRadialGradient(cx, groundY - 120, 10, cx, groundY - 100, 260 * scale / 3);
    spot.addColorStop(0, 'rgba(255, 249, 200, .25)');
    spot.addColorStop(1, 'rgba(255, 249, 200, 0)');
    g.fillStyle = spot;
    g.fillRect(0, 0, w, h);

    // ombra a terra
    g.fillStyle = 'rgba(26, 61, 31, .3)';
    g.beginPath();
    g.ellipse(cx - 65 * scale / 3, groundY + 7, 80 * scale / 3, 20 * scale / 3, 0, 0, TAU);
    g.fill();

    // polvere e scintille dietro la ruota
    for (let i = 0; i < 9; i++) {
      const ph = (elapsed * 1.6 + i * 0.37) % 1;
      const px = cx - 65 * scale / 3 - ph * 115 * scale / 3;
      const py = groundY - 8 - ph * 28 + Math.sin(i * 2.7) * 6;
      g.fillStyle = `rgba(232, 207, 156, ${(1 - ph) * 0.4})`;
      g.beginPath();
      g.arc(px, py, (3 + ph * 9) * scale / 3, 0, TAU);
      g.fill();
    }

    // disegno del ciclista in impennata
    const wheelie = 0.51 + Math.sin(elapsed * 1.9) * 0.028;
    const bounce = Math.sin(elapsed * 3.2) * 2.5;
    g.save();
    g.translate(cx, groundY + bounce);
    g.scale(scale, scale);
    g.translate(-26, 0);
    g.rotate(-wheelie);
    g.translate(26, 0);
    drawRider(g, {
      wheelAngle: elapsed * 13.5,
      pedal: elapsed * 9.5,
      time: t,
      shadow: false,
      dust: false,
      speed: 300
    });
    g.restore();

    // scia velocità alla ruota posteriore
    const rearX = cx - 65 * scale / 3;
    const rearY = groundY - 16 * scale + 5;
    g.strokeStyle = 'rgba(255, 247, 209, .55)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = elapsed * 2.5 + i * 2.1;
      g.globalAlpha = 0.35 + (i % 2) * 0.2;
      g.beginPath();
      g.arc(rearX, rearY, (30 + i * 13) * scale / 3, a, a + 1.1);
      g.stroke();
    }
    g.globalAlpha = 1;

    // scintille dorate
    for (const sp of state.victorySparks) {
      const a = clamp(sp.life / sp.maxLife, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = sp.color;
      g.save();
      g.translate(sp.x, sp.y);
      g.rotate(sp.rot);
      g.fillRect(-sp.size / 2, -sp.size / 4, sp.size, sp.size / 2);
      g.restore();
    }
    g.globalAlpha = 1;

    // alone attorno al campione
    g.strokeStyle = 'rgba(255, 246, 183, .2)';
    g.lineWidth = 2;
    g.setLineDash([6, 18]);
    g.beginPath();
    g.arc(cx, groundY - 150, 180 * scale / 3, 0, TAU);
    g.stroke();
    g.setLineDash([]);

    // vignettatura
    const vg = g.createRadialGradient(w * 0.5, h * 0.55, h * 0.3, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(12, 34, 18, 0)');
    vg.addColorStop(1, 'rgba(12, 34, 18, .3)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);

    // update sparks
    for (const sp of state.victorySparks) {
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.12;
      sp.vx *= 0.995;
      sp.rot += sp.vr;
      sp.life -= 1;
    }
    state.victorySparks = state.victorySparks.filter(sp => sp.life > 0);

    if (!reducedMotion && Math.random() < 0.6 && state.victorySparks.length < 80) {
      const sparkColors = ['#ffe382', '#ffb45c', '#fff8d3', '#e96a48', '#9bd7a2'];
      state.victorySparks.push({
        x: rearX + (Math.random() - 0.5) * 80,
        y: rearY + (Math.random() - 0.5) * 60,
        vx: -1.5 - Math.random() * 3,
        vy: -1 - Math.random() * 3,
        size: 4 + Math.random() * 6,
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 0.2,
        life: 50 + Math.random() * 40,
        maxLife: 90
      });
    }
  }

  // ======================= HUD E PROMPT =======================

  function updateHUD() {
    dom.hudDone.textContent = state.completed;
    dom.hudStars.textContent = state.stars;
    dom.hudScore.textContent = state.score;
    dom.hudBar.style.width = `${(state.completed / 20) * 100}%`;
    dom.quizGlobalBar.style.width = `${(state.completed / 20) * 100}%`;
    drawMinimap();
  }

  function updateZoneChip(zone, force = false) {
    if (zone === state.currentZone && !force) return;
    state.currentZone = zone || null;
    if (zone) {
      dom.zoneChipIcon.textContent = zone.icon;
      dom.zoneChipName.textContent = zone.name;
      dom.zoneChip.style.setProperty('--zone-color', zone.color);
      if (!state.announcedZones.has(zone.id) && state.started) {
        state.announcedZones.add(zone.id);
        if (performance.now() - lastZoneToastAt > 4500) {
          lastZoneToastAt = performance.now();
          const zoneTasks = TASKS.filter(t => t.zone === zone.id);
          const done = zoneTasks.filter(t => t.done).length;
          showToast(`${zone.icon} ${zone.name} · ${done}/${zoneTasks.length} compiti`, 2600);
        }
      }
    } else {
      dom.zoneChipIcon.textContent = '🧭';
      dom.zoneChipName.textContent = 'In esplorazione';
      dom.zoneChip.style.setProperty('--zone-color', '#79a85d');
    }
    dom.zoneChip.classList.remove('bump');
    void dom.zoneChip.offsetWidth;
    dom.zoneChip.classList.add('bump');
  }

  function getZoneAt(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const zone of Object.values(ZONES)) {
      const d = Math.hypot(x - zone.center.x, y - zone.center.y);
      if (d < zone.radius && d < bestD) {
        best = zone;
        bestD = d;
      }
    }
    return best;
  }

  function getNearestTask() {
    let best = null;
    let bestD = INTERACT_DIST * INTERACT_DIST;
    for (const task of TASKS) {
      if (task.done) continue;
      const d = (task.x - state.player.x) ** 2 + (task.y - 8 - state.player.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = task;
      }
    }
    return best;
  }

  function updatePrompt(force = false) {
    const near = state.nearTask;
    if (near && !state.quizOpen && state.started && state.mode === 'map' && !state.victory) {
      if (force || lastPromptTask !== near) {
        const zone = ZONES[near.zone];
        dom.promptZone.textContent = `${zone.icon} ${zone.name}`;
        dom.promptText.textContent = `Compito ${near.id} · rispondi!`;
        dom.interactPrompt.setAttribute('aria-label', `Apri il compito ${near.id} della zona ${zone.name}`);
        lastPromptTask = near;
      }
      dom.interactPrompt.classList.add('visible');
    } else {
      dom.interactPrompt.classList.remove('visible');
      lastPromptTask = null;
    }
  }

  function showToast(message, duration = 2600) {
    dom.toast.innerHTML = message;
    dom.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => dom.toast.classList.remove('show'), duration);
  }

  // ======================= AGGIORNAMENTO =======================

  function updatePlayer(dt) {
    if (!state.started || state.quizOpen || state.victory || state.helpOpen) {
      state.player.vx *= 0.82;
      state.player.vy *= 0.82;
      state.player.speed = 0;
      return;
    }

    let dx = 0;
    let dy = 0;
    const keys = state.keys;
    const touch = state.touchKeys;
    if (keys.has('ArrowLeft') || keys.has('KeyA') || touch.has('left')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD') || touch.has('right')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW') || touch.has('up')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS') || touch.has('down')) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    const targetVx = dx * PLAYER_SPEED;
    const targetVy = dy * PLAYER_SPEED;
    const accel = 1 - Math.exp(-13 * dt);
    state.player.vx = lerp(state.player.vx, targetVx, accel);
    state.player.vy = lerp(state.player.vy, targetVy, accel);

    if (Math.abs(state.player.vx) < 2) state.player.vx = 0;
    if (Math.abs(state.player.vy) < 2) state.player.vy = 0;

    const p = state.player;
    p.x = clamp(p.x + p.vx * dt, 88, WORLD.w - 88);
    p.y = clamp(p.y + p.vy * dt, 120, WORLD.h - 96);

    if (Math.abs(p.vx) > 12) p.facing = p.vx > 0 ? 1 : -1;
    p.speed = Math.hypot(p.vx, p.vy);

    const moving = p.speed > 20;
    if (moving) {
      state.wheelAngle += (p.speed * dt) / 16;
      state.pedal += dt * (6 + p.speed / 46);
      state.dustTimer -= dt;
      if (state.dustTimer <= 0 && !reducedMotion) {
        state.dustTimer = 0.075;
        spawnDust();
      }
    } else {
      state.pedal += dt * 0.55;
      state.dustTimer = 0;
    }

    const zone = getZoneAt(p.x, p.y);
    updateZoneChip(zone);

    const near = getNearestTask();
    if (near !== state.nearTask) {
      state.nearTask = near;
      updatePrompt(true);
    }
  }

  function gameLoop(now) {
    const t = now || performance.now();
    if (!state.lastTime) state.lastTime = t;
    let dt = (t - state.lastTime) / 1000;
    state.lastTime = t;
    dt = clamp(dt, 0, 0.05);
    state.time = t;

    if (state.mode === 'victory') {
      drawVictoryScene(t);
    } else {
      updatePlayer(dt);
      updateDust(dt);
      updateCamera(dt);
      drawMap(t);
      drawMinimap();
    }

    requestAnimationFrame(gameLoop);
  }

  // ======================= QUIZ =======================

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderDiagram(type) {
    const common = 'font-family="Fredoka, sans-serif" fill="#4b5c49" text-anchor="middle"';
    switch (type) {
      case 'rectangle':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Rettangolo con base 6 centimetri e altezza 3 centimetri">
          <rect x="88" y="34" width="184" height="72" rx="5" fill="#ffe7a5" stroke="#a97521" stroke-width="3"/>
          <path d="M88 34h184M88 106h184" stroke="#d3ae55" stroke-width="1" stroke-dasharray="4 4"/>
          <text x="180" y="24" ${common} font-size="15" font-weight="600">6 cm</text>
          <text x="292" y="75" ${common} font-size="15" font-weight="600">3 cm</text>
          <text x="180" y="124" ${common} font-size="11" fill="#7d886f">Perimetro = giro completo</text>
        </svg>`;
      case 'square':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Quadrato con lato di 5 centimetri">
          <rect x="127" y="18" width="94" height="94" rx="4" fill="#cfe6b4" stroke="#4c8b52" stroke-width="3"/>
          <path d="M127 18h94v94H127z" fill="none" stroke="#e6f4d1" stroke-width="1.5" stroke-dasharray="5 5"/>
          <text x="174" y="12" ${common} font-size="15" font-weight="600">5 cm</text>
          <text x="238" y="70" ${common} font-size="15" font-weight="600">5 cm</text>
          <text x="174" y="126" ${common} font-size="11" fill="#7d886f">Quanti quadratini da 1 cm²?</text>
        </svg>`;
      case 'hexagon':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Un esagono">
          <polygon points="155,16 205,16 230,66 205,116 155,116 130,66" fill="#cfe6b4" stroke="#4c8b52" stroke-width="3"/>
          <circle cx="130" cy="66" r="3" fill="#3b7f44"/><circle cx="155" cy="16" r="3" fill="#3b7f44"/>
          <circle cx="205" cy="16" r="3" fill="#3b7f44"/><circle cx="230" cy="66" r="3" fill="#3b7f44"/>
          <circle cx="205" cy="116" r="3" fill="#3b7f44"/><circle cx="155" cy="116" r="3" fill="#3b7f44"/>
          <text x="180" y="71" ${common} font-size="18" font-weight="650" fill="#2d5f36">?</text>
        </svg>`;
      case 'shapes':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Un quadrato, un rettangolo, un triangolo e un cerchio">
          <rect x="30" y="28" width="66" height="66" rx="3" fill="#ffe7a5" stroke="#a97521" stroke-width="2.5"/>
          <rect x="119" y="40" width="72" height="48" rx="3" fill="#cfe6b4" stroke="#4c8b52" stroke-width="2.5"/>
          <polygon points="238,92 272,30 306,92" fill="#f5c8b6" stroke="#b35a3b" stroke-width="2.5"/>
          <circle cx="92" cy="72" r="9" fill="none" stroke="#547e99" stroke-width="2.5"/>
          <text x="63" y="119" ${common} font-size="10.5">quadrato</text>
          <text x="155" y="119" ${common} font-size="10.5">rettangolo</text>
          <text x="272" y="119" ${common} font-size="10.5">triangolo</text>
          <circle cx="330" cy="72" r="17" fill="#f2e6bc" stroke="#a68a3b" stroke-width="2.5"/>
        </svg>`;
      case 'triangle':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Triangolo con lati 4, 4 e 6 centimetri">
          <polygon points="180,21 255,108 105,108" fill="#f7d1c1" stroke="#b65d3c" stroke-width="3"/>
          <text x="143" y="60" ${common} font-size="14" font-weight="600">4 cm</text>
          <text x="219" y="60" ${common} font-size="14" font-weight="600">4 cm</text>
          <text x="180" y="124" ${common} font-size="14" font-weight="600">6 cm</text>
        </svg>`;
      case 'coins':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Sei monete da 2 euro">
          ${[0, 1, 2, 3, 4, 5].map(i => {
            const x = 45 + (i % 3) * 93;
            const y = 42 + Math.floor(i / 3) * 53;
            return `<g><circle cx="${x}" cy="${y}" r="23" fill="#f4cf64" stroke="#a97d21" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#d7ac3b" stroke-width="1.4"/><text x="${x}" y="${y + 6}" ${common} font-size="16" font-weight="650" fill="#7d5c16">2 €</text></g>`;
          }).join('')}
        </svg>`;
      case 'change':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Una moneta da un euro e una matita da 60 centesimi">
          <circle cx="112" cy="66" r="36" fill="#f4cf64" stroke="#a97d21" stroke-width="3"/>
          <text x="112" y="74" ${common} font-size="23" font-weight="650" fill="#7d5c16">1 €</text>
          <text x="178" y="74" ${common} font-size="25" font-weight="600" fill="#637a5b">−</text>
          <g transform="translate(224 36) rotate(28)">
            <rect x="0" y="10" width="83" height="18" rx="4" fill="#f2a84d" stroke="#a9681f" stroke-width="2.5"/>
            <polygon points="83,10 103,19 83,28" fill="#e7c59a" stroke="#a9681f" stroke-width="2.5"/>
            <rect x="-10" y="10" width="12" height="18" rx="3" fill="#e57f8e"/>
          </g>
          <text x="256" y="104" ${common} font-size="13" font-weight="600" fill="#7d5c16">60 centesimi</text>
        </svg>`;
      case 'clock':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Orologio che segna le nove">
          <circle cx="180" cy="66" r="51" fill="#fff8e4" stroke="#3f7752" stroke-width="3"/>
          <circle cx="180" cy="66" r="44" fill="none" stroke="#d8ccb0" stroke-width="1.5"/>
          ${Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const x1 = 180 + Math.cos(a) * 39;
            const y1 = 66 + Math.sin(a) * 39;
            const x2 = 180 + Math.cos(a) * 44;
            const y2 = 66 + Math.sin(a) * 44;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f8c79" stroke-width="1.5"/>`;
          }).join('')}
          <line x1="180" y1="66" x2="151" y2="66" stroke="#3e5d48" stroke-width="4" stroke-linecap="round"/>
          <line x1="180" y1="66" x2="180" y2="33" stroke="#3e5d48" stroke-width="3" stroke-linecap="round"/>
          <circle cx="180" cy="66" r="4" fill="#3e5d48"/>
          <text x="180" y="128" ${common} font-size="12" font-weight="600" fill="#6c7d65">9:00 + 45 minuti = ?</text>
        </svg>`;
      case 'sequence':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Sequenza di numeri: 2, 4, 8, 16, punto interrogativo">
          ${[2, 4, 8, 16].map((n, i) => `<g><rect x="${24 + i * 76}" y="39" width="54" height="52" rx="14" fill="#d8e8f2" stroke="#4b83a6" stroke-width="2.5"/><text x="${51 + i * 76}" y="72" ${common} font-size="24" font-weight="650" fill="#275676">${n}</text></g>`).join('')}
          <text x="330" y="71" ${common} font-size="17" fill="#66849a">→</text>
          <text x="180" y="26" ${common} font-size="11" fill="#6d8375">Ogni numero raddoppia</text>
          <text x="180" y="116" ${common} font-size="14" font-weight="600" fill="#557267">2, 4, 8, 16, ?</text>
        </svg>`;
      case 'cube':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Un cubo">
          <g stroke="#3f7752" stroke-width="2.5" stroke-linejoin="round">
            <polygon points="142,39 216,26 257,53 183,66" fill="#cfe6b4"/>
            <polygon points="142,39 183,66 183,113 142,100" fill="#8dc17b"/>
            <polygon points="183,66 257,53 257,98 183,113" fill="#6ca85d"/>
          </g>
          <text x="180" y="124" ${common} font-size="11" fill="#6d8375">Pensa a un dado…</text>
        </svg>`;
      case 'lineup':
        return `<svg viewBox="0 0 360 132" role="img" aria-label="Tre bambini in fila: Anna, Bruno e Carla">
          ${[
            { x: 74, name: 'Anna', color: '#f3c0c9', hair: '#5a3a2a' },
            { x: 180, name: 'Bruno', color: '#b9d9ea', hair: '#3a2a23' },
            { x: 286, name: 'Carla', color: '#f3d795', hair: '#70442b' }
          ].map((p, i) => `<g>
              <line x1="${p.x}" y1="100" x2="${p.x}" y2="83" stroke="#8d9d7d" stroke-width="2"/>
              <circle cx="${p.x}" cy="54" r="21" fill="${p.color}" stroke="#5d6c58" stroke-width="2"/>
              <path d="M${p.x - 20} 52 a20 20 0 0 1 40 0 q-10 -13 -20 -12 q-12 0 -20 12z" fill="${p.hair}"/>
              <circle cx="${p.x - 7}" cy="55" r="2" fill="#3b3b30"/><circle cx="${p.x + 7}" cy="55" r="2" fill="#3b3b30"/>
              <path d="M${p.x - 6} 63 q6 5 12 0" fill="none" stroke="#8b5c46" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="${p.x - 16}" y="79" width="32" height="25" rx="8" fill="${p.color}" opacity=".9"/>
              <text x="${p.x}" y="122" ${common} font-size="13" font-weight="600">${p.name}</text>
            </g>`).join('')}
          <text x="18" y="27" ${common} font-size="11" fill="#6d8375">davanti</text>
          <text x="342" y="27" ${common} font-size="11" fill="#6d8375">dietro</text>
        </svg>`;
      default:
        return '';
    }
  }

  function openQuiz(taskId) {
    const task = findTask(taskId);
    if (!task || task.done || state.quizOpen || !state.started) return;
    const q = state.runQuestions[task.id - 1];
    const zone = ZONES[task.zone];
    if (!q) return;
    state.activeTask = task;
    state.attempts = 0;
    state.answered = false;
    state.solvedActive = false;
    state.quizOptions = shuffle(q.options);
    state.currentCorrectIndex = state.quizOptions.indexOf(q.answer);
    state.quizOpen = true;
    state.keys.clear();
    state.touchKeys.clear();
    $$('.dpad-btn').forEach(b => b.classList.remove('pressed'));

    dom.quizCard.style.setProperty('--zone-color', zone.color);
    dom.quizAccent.style.background = zone.color;
    dom.quizZoneIcon.textContent = zone.icon;
    dom.quizZoneName.textContent = zone.name;
    dom.quizNumber.textContent = String(task.id);
    dom.quizTopic.textContent = q.topic;
    dom.quizQuestion.textContent = q.text;
    dom.quizFeedback.className = 'feedback';
    dom.quizFeedback.innerHTML = '';
    dom.quizTries.innerHTML = '<b>Primo tentativo</b> · vale 3 stelle';
    dom.quizContinue.hidden = true;
    dom.quizGlobalBar.style.width = `${(state.completed / 20) * 100}%`;

    if (q.diagram) {
      dom.quizDiagram.innerHTML = renderDiagram(q.diagram);
      dom.quizDiagram.hidden = false;
    } else {
      dom.quizDiagram.innerHTML = '';
      dom.quizDiagram.hidden = true;
    }

    dom.quizAnswers.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    state.quizOptions.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer-btn';
      btn.dataset.index = String(index);
      btn.innerHTML = `<span class="answer-letter" aria-hidden="true">${letters[index]}</span><span class="answer-text">${option}</span>`;
      btn.setAttribute('aria-label', `Risposta ${letters[index]}: ${option}`);
      btn.addEventListener('click', () => answerQuestion(index));
      dom.quizAnswers.appendChild(btn);
    });

    dom.quizModal.classList.add('open');
    dom.quizModal.setAttribute('aria-hidden', 'false');
    dom.interactPrompt.classList.remove('visible');
    Audio.open();
    setTimeout(() => {
      const first = dom.quizAnswers.querySelector('.answer-btn');
      if (first) first.focus({ preventScroll: true });
    }, 180);
  }

  function answerQuestion(index) {
    if (!state.quizOpen || state.answered || !state.activeTask) return;
    const task = state.activeTask;
    const q = state.runQuestions[task.id - 1];
    if (!q) return;
    const buttons = $$('.answer-btn', dom.quizAnswers);
    const btn = buttons[index];
    if (!btn || btn.disabled) return;
    const option = state.quizOptions[index];

    if (option !== q.answer) {
      state.attempts++;
      btn.classList.add('wrong');
      btn.disabled = true;
      Audio.wrong();
      dom.quizCard.classList.remove('shake');
      void dom.quizCard.offsetWidth;
      dom.quizCard.classList.add('shake');

      if (state.attempts >= 2) {
        const correctBtn = buttons[state.currentCorrectIndex];
        if (correctBtn) correctBtn.classList.add('reveal');
        dom.quizFeedback.className = 'feedback show error';
        dom.quizFeedback.innerHTML = `<span class="feedback-icon" aria-hidden="true">💡</span><div><b>Quasi!</b> ${q.hint}<br><span>La risposta giusta è quella evidenziata in giallo: toccala per completare il compito.</span></div>`;
        dom.quizTries.innerHTML = '<b>Ultimo tentativo</b> · vale 1 stella';
      } else {
        dom.quizFeedback.className = 'feedback show tip';
        dom.quizFeedback.innerHTML = `<span class="feedback-icon" aria-hidden="true">💡</span><div><b>Piccolo aiuto:</b> ${q.hint}</div>`;
        dom.quizTries.innerHTML = '<b>Secondo tentativo</b> · vale 2 stelle';
      }
      return;
    }

    // Risposta corretta
    state.answered = true;
    state.solvedActive = true;
    const stars = state.attempts === 0 ? 3 : state.attempts === 1 ? 2 : 1;
    const points = state.attempts === 0 ? 100 : state.attempts === 1 ? 70 : 50;
    task.done = true;
    task.attempts = state.attempts;
    task.stars = stars;
    state.completed++;
    state.stars += stars;
    state.score += points;
    state.nearTask = null;
    updateHUD();
    updatePrompt(true);

    buttons.forEach(b => { b.disabled = true; });
    buttons.forEach(b => b.classList.remove('reveal'));
    btn.classList.add('correct');
    btn.classList.remove('wrong');

    dom.quizFeedback.className = 'feedback show success';
    dom.quizFeedback.innerHTML = `<span class="feedback-icon" aria-hidden="true">${state.completed === 20 ? '🏆' : '⭐'}</span><div><b>${state.completed === 20 ? 'Fantastico, ultimo compito completato!' : 'Esatto!'}</b> ${q.explanation}<br><span class="points">+${points} punti · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></div>`;
    dom.quizTries.innerHTML = `<b>Compito ${task.id} completato</b> · ${state.completed}/20`;
    dom.quizContinue.hidden = false;
    dom.quizContinue.innerHTML = state.completed === 20
      ? 'Gran finale! <span aria-hidden="true">🏁</span>'
      : 'Continua <span aria-hidden="true">→</span>';
    dom.quizGlobalBar.style.width = `${(state.completed / 20) * 100}%`;

    Audio.correct();
    if (state.completed === 20) {
      setTimeout(() => Audio.complete(), 450);
    }
    burstConfetti(window.innerWidth / 2, 0, state.completed === 20 ? 90 : 46);

    setTimeout(() => {
      if (state.quizOpen) dom.quizContinue.focus({ preventScroll: true });
    }, 220);
  }

  function closeQuiz(triggeredByContinue = false) {
    if (!state.quizOpen) return;
    const wasSolved = state.solvedActive;
    const allDone = state.completed === 20;
    dom.quizModal.classList.remove('open');
    dom.quizModal.setAttribute('aria-hidden', 'true');
    state.quizOpen = false;
    state.activeTask = null;
    state.answered = false;
    state.solvedActive = false;
    stopSpeaking();

    if (allDone) {
      setTimeout(() => startVictory(), 420);
    } else if (wasSolved && triggeredByContinue) {
      const remaining = 20 - state.completed;
      showToast(`Compito completato! ${remaining === 1 ? 'Ne resta 1' : `Ne restano ${remaining}`}.`, 2300);
    }
  }

  function continueQuiz() {
    if (!state.answered) return;
    Audio.click();
    closeQuiz(true);
  }

  // ======================= VITTORIA / RESET =======================

  function startVictory(instant = false) {
    if (state.victory) return;
    if (state.completed !== 20) return;
    state.victory = true;
    state.mode = 'victory';
    state.victoryStart = performance.now();
    state.victorySparks = [];
    state.keys.clear();
    state.touchKeys.clear();
    closeHelp();
    dom.quizModal.classList.remove('open');
    dom.quizModal.setAttribute('aria-hidden', 'true');
    state.quizOpen = false;
    state.activeTask = null;

    const previousBest = state.best;
    dom.victoryStars.textContent = state.stars;
    dom.victoryScore.textContent = state.score;
    dom.victoryRecord.hidden = state.preview || state.score <= previousBest;
    if (!state.preview && state.score > state.best) {
      state.best = state.score;
      try { localStorage.setItem('andrematico-best', String(state.score)); } catch (e) { /* noop */ }
      dom.victoryRecord.hidden = false;
      refreshBestNote();
    }

    dom.app.classList.add('victory-mode');
    dom.victoryScreen.hidden = false;
    requestAnimationFrame(() => {
      resize();
      state.lastTime = performance.now();
    });
    Audio.win();
    startVictoryConfetti();
    setTimeout(() => dom.exploreBtn.focus({ preventScroll: true }), instant ? 80 : 950);
  }

  function startVictoryConfetti() {
    stopVictoryConfetti();
    burstConfetti(window.innerWidth / 2, 0, 100);
    state.victoryConfettiTimer = setInterval(() => {
      if (state.mode === 'victory') burstConfetti(window.innerWidth / 2, 0, 36);
    }, 2400);
  }

  function stopVictoryConfetti() {
    if (state.victoryConfettiTimer) {
      clearInterval(state.victoryConfettiTimer);
      state.victoryConfettiTimer = null;
    }
  }

  function exitVictory() {
    if (!state.victory) return;
    Audio.click();
    state.victory = false;
    state.mode = 'map';
    state.started = true;
    dom.victoryScreen.hidden = true;
    dom.app.classList.remove('victory-mode');
    stopVictoryConfetti();
    requestAnimationFrame(() => {
      resize();
      snapCamera();
      state.lastTime = performance.now();
    });
    showToast('Hai completato tutti i compiti! Esplora la mappa o premi ↻ per ricominciare.', 4200);
  }

  function resetGame() {
    resetTaskState();
    prepareRunQuestions();
    state.player = { x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, speed: 0, facing: 1 };
    state.wheelAngle = 0;
    state.pedal = 0;
    state.dust = [];
    state.victorySparks = [];
    state.keys.clear();
    state.touchKeys.clear();
    state.nearTask = null;
    state.currentZone = null;
    lastPromptTask = null;
    stopVictoryConfetti();
    closeHelp();
    dom.quizModal.classList.remove('open');
    dom.quizModal.setAttribute('aria-hidden', 'true');
    state.quizOpen = false;
    state.answered = false;
    state.solvedActive = false;
    state.activeTask = null;
    state.victory = false;
    state.mode = 'map';
    state.started = false;
    dom.victoryScreen.hidden = true;
    dom.app.classList.remove('victory-mode');
    dom.interactPrompt.classList.remove('visible');
    dom.toast.classList.remove('show');
    dom.confettiLayer.innerHTML = '';
    updateHUD();
    requestAnimationFrame(() => {
      resize();
      snapCamera();
    });
  }

  function showStartScreen() {
    dom.startScreen.hidden = false;
    dom.startScreen.classList.remove('closing');
    dom.startScreen.setAttribute('aria-hidden', 'false');
    refreshBestNote();
    setTimeout(() => dom.startBtn.focus({ preventScroll: true }), 80);
  }

  function refreshBestNote() {
    if (state.best > 0) {
      dom.bestNote.textContent = `Il tuo record: ${state.best} punti su 2000 · allenati e migliora!`;
    } else {
      dom.bestNote.textContent = 'Nessuna fretta: puoi riprovare tutte le risposte.';
    }
  }

  function startGame(instant = false) {
    if (state.started) return;
    if (state.runQuestions.length !== 20) prepareRunQuestions();
    Audio.init();
    Audio.click();
    state.started = true;
    state.mode = 'map';
    state.keys.clear();
    state.touchKeys.clear();
    dom.startScreen.classList.add('closing');
    dom.startScreen.setAttribute('aria-hidden', 'true');
    if (instant) {
      dom.startScreen.hidden = true;
      dom.startScreen.classList.remove('closing');
    } else {
      setTimeout(() => { dom.startScreen.hidden = true; }, 470);
    }
    snapCamera();
    state.lastTime = performance.now();
    setTimeout(() => {
      showToast('🧭 Segui i sentieri e raggiungi i cartelli numerati!', 3200);
      updatePrompt(true);
    }, instant ? 100 : 650);
  }

  // ======================= AIUTO =======================

  function openHelp() {
    if (state.helpOpen) return;
    state.helpOpen = true;
    state.keys.clear();
    state.touchKeys.clear();
    dom.helpModal.classList.add('open');
    dom.helpModal.setAttribute('aria-hidden', 'false');
    Audio.click();
    setTimeout(() => dom.helpClose.focus({ preventScroll: true }), 120);
  }

  function closeHelp() {
    if (!state.helpOpen) return;
    state.helpOpen = false;
    dom.helpModal.classList.remove('open');
    dom.helpModal.setAttribute('aria-hidden', 'true');
  }

  // ======================= VOCE =======================

  let speakingUtterance = null;

  function speakQuestion() {
    if (!state.quizOpen || !state.activeTask) return;
    if (!('speechSynthesis' in window)) {
      showToast('La lettura vocale non è disponibile su questo browser.', 2500);
      return;
    }
    stopSpeaking();
    const q = state.runQuestions[state.activeTask.id - 1];
    if (!q) return;
    speakingUtterance = new SpeechSynthesisUtterance(q.text);
    speakingUtterance.lang = 'it-IT';
    speakingUtterance.rate = 0.92;
    speakingUtterance.pitch = 1.03;
    speakingUtterance.onend = () => dom.speakBtn.classList.remove('is-speaking');
    speakingUtterance.onerror = () => dom.speakBtn.classList.remove('is-speaking');
    dom.speakBtn.classList.add('is-speaking');
    window.speechSynthesis.speak(speakingUtterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    dom.speakBtn.classList.remove('is-speaking');
    speakingUtterance = null;
  }

  // ======================= CONFETTI =======================

  const CONFETTI_COLORS = ['#f5c542', '#e96a48', '#5aa86c', '#538fbc', '#f2a1b5', '#fff1b8', '#a9cd6b'];

  function burstConfetti(originX = window.innerWidth / 2, originY = 0, count = 50) {
    if (reducedMotion) count = Math.min(count, 12);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const left = clamp(originX + (Math.random() - 0.5) * window.innerWidth * 0.65, 0, window.innerWidth - 12);
      const duration = 1.9 + Math.random() * 1.8;
      piece.style.left = left + 'px';
      piece.style.top = `${originY - Math.random() * 160}px`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.width = `${6 + Math.random() * 7}px`;
      piece.style.height = `${9 + Math.random() * 11}px`;
      piece.style.borderRadius = Math.random() < 0.3 ? '50%' : '2px';
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 220}px`);
      piece.style.setProperty('--spin', `${(Math.random() * 900 - 450) | 0}deg`);
      piece.style.setProperty('--fall-duration', `${duration}s`);
      piece.style.setProperty('--fall-delay', `${Math.random() * 0.5}s`);
      frag.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + 0.8) * 1000);
    }
    dom.confettiLayer.appendChild(frag);
  }

  // ======================= INPUT =======================

  const MOVE_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD'
  ]);

  function onKeyDown(e) {
    if (e.code === 'Escape') {
      if (state.helpOpen) { closeHelp(); return; }
      if (state.quizOpen) { closeQuiz(false); return; }
    }

    if (state.helpOpen) {
      if (e.code === 'Enter' && !state.started) { closeHelp(); startGame(); }
      return;
    }

    if (!state.started && !state.quizOpen && !state.victory) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        startGame();
      }
      return;
    }

    if (state.victory) {
      if (e.code === 'Enter') {
        e.preventDefault();
        exitVictory();
      }
      return;
    }

    if (state.quizOpen) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); answerQuestion(0); return; }
      if (e.code === 'Digit2' || e.code === 'Numpad2') { e.preventDefault(); answerQuestion(1); return; }
      if (e.code === 'Digit3' || e.code === 'Numpad3') { e.preventDefault(); answerQuestion(2); return; }
      if (e.code === 'Digit4' || e.code === 'Numpad4') { e.preventDefault(); answerQuestion(3); return; }
      if (e.code === 'Enter' && state.answered) { e.preventDefault(); continueQuiz(); return; }
      return;
    }

    if (MOVE_KEYS.has(e.code)) {
      e.preventDefault();
      state.keys.add(e.code);
      return;
    }

    if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && state.nearTask) {
      e.preventDefault();
      if (!e.repeat) openQuiz(state.nearTask.id);
    }
  }

  function onKeyUp(e) {
    if (MOVE_KEYS.has(e.code)) {
      state.keys.delete(e.code);
      if (state.started && !state.quizOpen && !state.victory) e.preventDefault();
    }
  }

  function setupTouchControls() {
    $$('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.move;
      const press = e => {
        e.preventDefault();
        state.touchKeys.add(dir);
        btn.classList.add('pressed');
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      };
      const release = e => {
        if (e) e.preventDefault();
        state.touchKeys.delete(dir);
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', e => {
        if (e.buttons === 0) release(e);
      });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    dom.touchAction.addEventListener('click', () => {
      if (state.quizOpen || state.victory || !state.started) return;
      const near = state.nearTask;
      if (near) openQuiz(near.id);
      else showToast('Avvicinati a un cartello numerato per rispondere!', 1900);
    });
  }

  // ======================= INIZIALIZZAZIONE =======================

  function attachEvents() {
    window.addEventListener('resize', () => {
      resize();
      if (!state.started) snapCamera();
    });
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => {
      state.keys.clear();
      state.touchKeys.clear();
      $$('.dpad-btn').forEach(b => b.classList.remove('pressed'));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.keys.clear();
        state.touchKeys.clear();
        stopSpeaking();
      }
    });

    dom.startBtn.addEventListener('click', () => startGame());
    dom.startHelpBtn.addEventListener('click', openHelp);
    dom.helpBtn.addEventListener('click', openHelp);
    dom.helpClose.addEventListener('click', closeHelp);
    dom.helpPlayBtn.addEventListener('click', () => {
      closeHelp();
      if (!state.started) startGame();
    });
    $$('[data-close-help]').forEach(el => el.addEventListener('click', closeHelp));

    dom.soundBtn.addEventListener('click', () => {
      state.soundMuted = !state.soundMuted;
      dom.soundBtn.setAttribute('aria-pressed', String(!state.soundMuted));
      dom.soundBtn.setAttribute('aria-label', state.soundMuted ? 'Attiva i suoni' : 'Disattiva i suoni');
      dom.soundIcon.textContent = state.soundMuted ? '🔇' : '🔊';
      try { localStorage.setItem('andrematico-muted', state.soundMuted ? '1' : '0'); } catch (e) { /* noop */ }
      if (!state.soundMuted) {
        Audio.init();
        Audio.click();
      }
    });

    dom.restartBtn.addEventListener('click', () => {
      if (state.victory) {
        resetGame();
        showStartScreen();
        return;
      }
      if (!state.started) {
        showStartScreen();
        return;
      }
      if (window.confirm('Vuoi ricominciare l’avventura da capo? I compiti completati verranno azzerati.')) {
        resetGame();
        showStartScreen();
      }
    });

    dom.interactPrompt.addEventListener('click', () => {
      if (state.nearTask) openQuiz(state.nearTask.id);
    });

    dom.quizClose.addEventListener('click', () => closeQuiz(false));
    dom.quizContinue.addEventListener('click', continueQuiz);
    dom.quizBackdrop.addEventListener('click', () => closeQuiz(false));
    dom.speakBtn.addEventListener('click', speakQuestion);

    dom.replayBtn.addEventListener('click', () => {
      Audio.click();
      resetGame();
      showStartScreen();
    });
    dom.exploreBtn.addEventListener('click', exitVictory);

    // blocco del focus dentro il quiz
    dom.quizModal.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focusables = $$('button:not([disabled]):not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])', dom.quizModal)
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function loadPrefs() {
    try {
      const best = parseInt(localStorage.getItem('andrematico-best') || localStorage.getItem('andematica-best') || '0', 10);
      state.best = Number.isFinite(best) ? best : 0;
      state.soundMuted = (localStorage.getItem('andrematico-muted') ?? localStorage.getItem('andematica-muted')) === '1';
    } catch (e) {
      state.best = 0;
      state.soundMuted = false;
    }
    dom.soundIcon.textContent = state.soundMuted ? '🔇' : '🔊';
    dom.soundBtn.setAttribute('aria-pressed', String(!state.soundMuted));
    dom.soundBtn.setAttribute('aria-label', state.soundMuted ? 'Attiva i suoni' : 'Disattiva i suoni');
    refreshBestNote();
  }

  function applyPreview() {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('preview');
    if (!preview) return;
    state.preview = true;
    if (preview === 'map') {
      startGame(true);
    } else if (preview === 'quiz') {
      startGame(true);
      const id = clamp(parseInt(params.get('task') || '1', 10), 1, 20);
      setTimeout(() => openQuiz(id), 120);
    } else if (preview === 'victory') {
      startGame(true);
      TASKS.forEach(t => { t.done = true; t.stars = 3; });
      state.completed = 20;
      state.stars = 60;
      state.score = 2000;
      updateHUD();
      setTimeout(() => startVictory(true), 60);
    } else if (preview === 'help') {
      openHelp();
    }
  }

  function init() {
    loadPrefs();
    prepareRunQuestions();
    if (dom.bankPill) dom.bankPill.textContent = `📚 ${BANK_TOTAL} domande`;
    baseWorld = buildWorldBase();
    props = generateProps();
    resize();
    snapCamera();
    updateHUD();
    updateZoneChip(getZoneAt(SPAWN.x, SPAWN.y), true);
    updatePrompt(true);
    attachEvents();
    setupTouchControls();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { resizeMinimap(); });
    }
    applyPreview();
    requestAnimationFrame(gameLoop);

    // API di test / debug (utile anche per la didattica)
    window.AndreMatico = {
      state,
      tasks: TASKS,
      get questions() { return state.runQuestions; },
      questionBank: BANK_BY_TOPIC,
      bankTotal: BANK_TOTAL,
      start: startGame,
      openTask: id => openQuiz(id),
      win: () => {
        TASKS.forEach(t => { t.done = true; t.stars = 3; });
        state.completed = 20;
        state.stars = 60;
        state.score = state.score || 2000;
        updateHUD();
        startVictory();
      },
      reset: resetGame,
      showStart: showStartScreen
    };
  }

  init();
})();
