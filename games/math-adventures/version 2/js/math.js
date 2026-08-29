// ===================================================================
// math.js -- grade-4 math question & puzzle generators
// ===================================================================

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeChoices(correct, wrongPool) {
  const wrongs = shuffle(wrongPool.filter(v => v !== correct)).slice(0, 3);
  while (wrongs.length < 3) wrongs.push(correct + wrongs.length + 1 + randInt(1,5));
  return shuffle([correct, ...wrongs]);
}
function nearWrongs(correct, spread) {
  const set = new Set();
  while (set.size < 6) {
    const d = randInt(-spread, spread);
    if (d !== 0 && correct + d >= 0) set.add(correct + d);
  }
  return Array.from(set);
}

// ---------------- Place Value ----------------
function genPlaceValue() {
  const type = randInt(0, 2);
  if (type === 0) {
    // "What is the value of the digit X in NNNN?"
    const digits = [randInt(1,9), randInt(0,9), randInt(0,9), randInt(0,9)];
    const num = digits.join('');
    const posNames = ['thousands', 'hundreds', 'tens', 'ones'];
    const placeMultiplier = [1000, 100, 10, 1];
    const pos = randInt(0, 3);
    const digit = digits[pos];
    const value = digit * placeMultiplier[pos];
    return {
      q: `In the number ${Number(num).toLocaleString()}, what is the value of the digit ${digit} in the ${posNames[pos]} place?`,
      choices: makeChoices(value, nearWrongs(value, Math.max(placeMultiplier[pos]*3,10)).concat([digit, value+placeMultiplier[pos]])),
      answer: value
    };
  } else if (type === 1) {
    // compare two numbers
    let a = randInt(1000, 9999), b = randInt(1000, 9999);
    while (a === b) b = randInt(1000, 9999);
    const bigger = Math.max(a, b);
    return {
      q: `Which number is GREATER?`,
      choices: shuffle([a, b]),
      answer: bigger
    };
  } else {
    // expanded form -> standard number
    const th = randInt(1,9), h = randInt(0,9), t = randInt(0,9), o = randInt(0,9);
    const num = th*1000+h*100+t*10+o;
    const expanded = `${th*1000} + ${h*100} + ${t*10} + ${o}`;
    return {
      q: `What number is the same as ${expanded}?`,
      choices: makeChoices(num, nearWrongs(num, 50)),
      answer: num
    };
  }
}

// ---------------- Addition / Subtraction ----------------
function genAddSub() {
  const isAdd = Math.random() < 0.55;
  const names = ['Again','Blossom','Stop','Red'];
  const items = ['apples','stars','coins','flowers','shells'];
  const who = names[randInt(0,3)], what = items[randInt(0,4)];
  if (isAdd) {
    const a = randInt(15, 480), b = randInt(15, 480);
    const sum = a + b;
    return {
      q: `${who} collected ${a} ${what}. Then found ${b} more. How many ${what} in all?`,
      choices: makeChoices(sum, nearWrongs(sum, 12)),
      answer: sum
    };
  } else {
    let a = randInt(50, 900), b = randInt(10, a - 5);
    const diff = a - b;
    return {
      q: `${who} had ${a} ${what} and gave away ${b}. How many ${what} are left?`,
      choices: makeChoices(diff, nearWrongs(diff, 12)),
      answer: diff
    };
  }
}

// ---------------- Multiplication / Division ----------------
function genMulDiv() {
  const isMul = Math.random() < 0.55;
  const items = ['buns','pies','cupcakes','cookies','loaves'];
  const what = items[randInt(0,4)];
  if (isMul) {
    const a = randInt(2, 12), b = randInt(2, 12);
    const prod = a * b;
    return {
      q: `There are ${a} trays with ${b} ${what} on each. How many ${what} in all?`,
      choices: makeChoices(prod, nearWrongs(prod, 10)),
      answer: prod
    };
  } else {
    const b = randInt(2, 10), prod = randInt(2, 12);
    const a = b * prod;
    return {
      q: `${a} ${what} are shared equally into ${b} boxes. How many ${what} in each box?`,
      choices: makeChoices(prod, nearWrongs(prod, 5)),
      answer: prod
    };
  }
}

// ---------------- Order of Operations (simple MDAS, no parentheses) ----------------
function genOrderOps() {
  const type = randInt(0,1);
  if (type === 0) {
    // a + b * c  (multiply first)
    const a = randInt(1,10), b = randInt(2,9), c = randInt(2,9);
    const result = a + b * c;
    return {
      q: `${a} + ${b} × ${c} = ?  (Hint: multiply first!)`,
      choices: makeChoices(result, [ (a+b)*c, a+b+c, a*b+c ].concat(nearWrongs(result,6))),
      answer: result
    };
  } else {
    // a * b - c
    const a = randInt(2,9), b = randInt(2,9), c = randInt(1,20);
    const prod = a*b;
    const result = prod - c > 0 ? prod - c : prod + c;
    const qtext = prod - c > 0 ? `${a} × ${b} - ${c} = ?` : `${a} × ${b} + ${c} = ?`;
    return {
      q: `${qtext}  (Hint: multiply first!)`,
      choices: makeChoices(result, nearWrongs(result, 8)),
      answer: result
    };
  }
}

// ---------------- Mixed Review ----------------
function genMixed() {
  const pick = randInt(0,3);
  if (pick === 0) return genPlaceValue();
  if (pick === 1) return genAddSub();
  if (pick === 2) return genMulDiv();
  return genOrderOps();
}

const TOPIC_GENERATORS = {
  placevalue: genPlaceValue,
  addsub: genAddSub,
  muldiv: genMulDiv,
  orderops: genOrderOps,
  mixed: genMixed
};

function generateQuizSet(topic, count) {
  const gen = TOPIC_GENERATORS[topic] || genMixed;
  const out = [];
  for (let i = 0; i < count; i++) out.push(gen());
  return out;
}

// ---------------- Puzzle generators ----------------
// Puzzle A: Place-Value Block Builder - tap hundreds/tens/ones blocks to match a target
function genBlockBuilderPuzzle() {
  const h = randInt(1, 8), t = randInt(0, 9), o = randInt(0, 9);
  const target = h * 100 + t * 10 + o;
  return {
    kind: 'blockbuilder',
    target,
    h, t, o,
    prompt: `Build the number ${target.toLocaleString()} using hundreds, tens, and ones blocks!`
  };
}

// Puzzle B: Order-of-Operations tap sequence
function genOrderTapPuzzle() {
  const a = randInt(1,9), b = randInt(2,9), c = randInt(2,9);
  // expression a + b * c -> correct tap order: multiply (b*c) first, then add a
  const steps = shuffle([
    { id: 'mul', label: `${b} × ${c}`, order: 1 },
    { id: 'add', label: `${a} + result`, order: 2 }
  ]);
  return {
    kind: 'ordertap',
    prompt: `${a} + ${b} × ${c} = ?   Tap the steps in the correct order!`,
    steps,
    resultValue: a + b * c
  };
}

const PUZZLE_GENERATORS = {
  placevalue: genBlockBuilderPuzzle,
  addsub: genBlockBuilderPuzzle,
  muldiv: genOrderTapPuzzle,
  orderops: genOrderTapPuzzle,
  mixed: () => (Math.random() < 0.5 ? genBlockBuilderPuzzle() : genOrderTapPuzzle())
};

function generatePuzzle(topic) {
  const gen = PUZZLE_GENERATORS[topic] || genBlockBuilderPuzzle;
  return gen();
}
