// ===================================================================
// npc.js -- procedurally draws a friendly round "blob" character
// (used for village chiefs & the Math Lord, since no art was supplied
//  for them; style matches the googly-eyed hero cutouts)
// ===================================================================

function drawChiefFace(canvas, color, opts) {
  opts = opts || {};
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size/2, cy = size/2;
  const r = size * 0.42;

  // body/head blob
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  const bumps = 8;
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    const rr = r * (1 + 0.06 * Math.sin(a * 5 + 1.3));
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = size * 0.02;
  ctx.stroke();

  // crown for the math lord
  if (opts.crown) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    const cw = r*1.1, chY = -r*0.95;
    ctx.moveTo(-cw, chY);
    ctx.lineTo(-cw, chY - r*0.35);
    ctx.lineTo(-cw*0.5, chY - r*0.1);
    ctx.lineTo(0, chY - r*0.45);
    ctx.lineTo(cw*0.5, chY - r*0.1);
    ctx.lineTo(cw, chY - r*0.35);
    ctx.lineTo(cw, chY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = size*0.012; ctx.stroke();
  }

  // eyes
  const eyeR = r * 0.24, eyeDX = r * 0.32, eyeDY = -r * 0.05;
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(side*eyeDX, eyeDY, eyeR, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = size*0.008; ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#2b2b2b';
    ctx.arc(side*eyeDX + side*eyeR*0.15, eyeDY + eyeR*0.1, eyeR*0.55, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(side*eyeDX + side*eyeR*0.35, eyeDY - eyeR*0.15, eyeR*0.18, 0, Math.PI*2);
    ctx.fill();
  });

  // cheeks
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  [-1,1].forEach(side => {
    ctx.beginPath();
    ctx.ellipse(side*r*0.55, r*0.32, r*0.16, r*0.1, 0, 0, Math.PI*2);
    ctx.fill();
  });

  // smile
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r*0.18, r*0.32, Math.PI*0.15, Math.PI*0.85);
  ctx.stroke();

  ctx.restore();
}

function makeChiefTexture(chiefKey, size) {
  size = size || 256;
  const chief = CHIEFS[chiefKey];
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  drawChiefFace(canvas, chief.color, { crown: chiefKey === 'jasz' });
  return canvas;
}

// simple cache
const _chiefCanvasCache = {};
function getChiefCanvas(chiefKey) {
  if (!_chiefCanvasCache[chiefKey]) _chiefCanvasCache[chiefKey] = makeChiefTexture(chiefKey, 256);
  return _chiefCanvasCache[chiefKey];
}
