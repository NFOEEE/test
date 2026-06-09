const CANVAS_SIZE = 300;
const MODEL_SIZE = 28;
const BRUSH_RADIUS = 12;

const drawCanvas = document.getElementById("draw-canvas");
const previewCanvas = document.getElementById("preview-canvas");
const drawCtx = drawCanvas.getContext("2d");
const previewCtx = previewCanvas.getContext("2d");
const btnClear = document.getElementById("btn-clear");
const btnPredict = document.getElementById("btn-predict");
const resultDigit = document.getElementById("result-digit");
const resultConfidence = document.getElementById("result-confidence");
const resultCard = document.getElementById("result-card");
const probabilitiesEl = document.getElementById("probabilities");

let model = null;
let isDrawing = false;
let hasDrawn = false;

function showLoading(text) {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.id = "loading-overlay";
  overlay.textContent = text;
  document.body.appendChild(overlay);
}

function hideLoading() {
  document.getElementById("loading-overlay")?.remove();
}

function initCanvas() {
  drawCtx.fillStyle = "#ffffff";
  drawCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawCtx.strokeStyle = "#000000";
  drawCtx.lineWidth = BRUSH_RADIUS * 2;
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
}

function getPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function startDraw(e) {
  e.preventDefault();
  isDrawing = true;
  hasDrawn = true;
  const pos = getPos(e);
  drawCtx.beginPath();
  drawCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();
}

function endDraw() {
  isDrawing = false;
}

function clearCanvas() {
  initCanvas();
  hasDrawn = false;
  resultDigit.textContent = "—";
  resultConfidence.textContent = "Нарисуйте цифру и нажмите «Распознать»";
  resultCard.classList.remove("has-result");
  previewCtx.fillStyle = "#ffffff";
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  renderProbabilities(new Array(10).fill(0));
}

function getBoundingBox(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (gray < 250) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY };
}

function preprocessCanvas() {
  const src = document.createElement("canvas");
  src.width = CANVAS_SIZE;
  src.height = CANVAS_SIZE;
  const srcCtx = src.getContext("2d");
  srcCtx.drawImage(drawCanvas, 0, 0);

  const bbox = getBoundingBox(srcCtx, CANVAS_SIZE, CANVAS_SIZE);
  const offscreen = document.createElement("canvas");
  offscreen.width = MODEL_SIZE;
  offscreen.height = MODEL_SIZE;
  const ctx = offscreen.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);

  if (bbox) {
    const pad = 20;
    const bw = bbox.maxX - bbox.minX + 1;
    const bh = bbox.maxY - bbox.minY + 1;
    const size = Math.max(bw, bh) + pad * 2;
    const sx = Math.max(0, bbox.minX - pad);
    const sy = Math.max(0, bbox.minY - pad);
    const scale = (MODEL_SIZE * 0.8) / size;
    const dw = bw * scale;
    const dh = bh * scale;
    const dx = (MODEL_SIZE - dw) / 2;
    const dy = (MODEL_SIZE - dh) / 2;
    ctx.drawImage(src, bbox.minX, bbox.minY, bw, bh, dx, dy, dw, dh);
  }

  const imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const pixels = imageData.data;

  const tensor = tf.tidy(() => {
    const data = new Float32Array(MODEL_SIZE * MODEL_SIZE);
    for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = 1 - gray / 255;
    }
    return tf.tensor4d(data, [1, MODEL_SIZE, MODEL_SIZE, 1]);
  });

  previewCtx.fillStyle = "#ffffff";
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.drawImage(offscreen, 0, 0, previewCanvas.width, previewCanvas.height);

  return tensor;
}

function renderProbabilities(probs) {
  const maxIdx = probs.indexOf(Math.max(...probs));
  probabilitiesEl.innerHTML = probs
    .map((p, i) => {
      const pct = (p * 100).toFixed(1);
      const isTop = i === maxIdx && p > 0;
      return `
        <div class="prob-bar">
          <span class="prob-digit${isTop ? " top" : ""}">${i}</span>
          <div class="prob-track">
            <div class="prob-fill${isTop ? " top" : ""}" style="height: ${Math.max(p * 100, 1)}%"></div>
          </div>
          <span class="prob-pct">${pct}%</span>
        </div>
      `;
    })
    .join("");
}

async function predict() {
  if (!model) return;
  if (!hasDrawn) {
    resultConfidence.textContent = "Сначала нарисуйте цифру на холсте";
    return;
  }

  btnPredict.disabled = true;
  const input = preprocessCanvas();

  try {
    const prediction = model.predict(input);
    const probs = await prediction.data();
    input.dispose();
    prediction.dispose();

    const maxIdx = probs.indexOf(Math.max(...probs));
    const confidence = (probs[maxIdx] * 100).toFixed(1);

    resultDigit.textContent = maxIdx;
    resultConfidence.textContent = `Уверенность: ${confidence}%`;
    resultCard.classList.add("has-result");
    renderProbabilities(Array.from(probs));
  } catch (err) {
    console.error(err);
    resultConfidence.textContent = "Ошибка распознавания";
  } finally {
    btnPredict.disabled = false;
  }
}

function buildModel() {
  const m = tf.sequential();
  m.add(
    tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: "relu",
      inputShape: [28, 28, 1],
    })
  );
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  m.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: "relu" }));
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  m.add(tf.layers.flatten());
  m.add(tf.layers.dropout({ rate: 0.25 }));
  m.add(tf.layers.dense({ units: 128, activation: "relu" }));
  m.add(tf.layers.dense({ units: 10, activation: "softmax" }));
  return m;
}

async function loadModel() {
  showLoading("Загрузка модели...");
  btnPredict.disabled = true;
  try {
    const response = await fetch("model/weights.json");
    if (!response.ok) throw new Error("weights.json not found");
    const weightsData = await response.json();
    model = buildModel();
    const weightTensors = weightsData.map((w) => tf.tensor(w));
    model.setWeights(weightTensors);
    weightTensors.forEach((t) => t.dispose());
    hideLoading();
    btnPredict.disabled = false;
  } catch (err) {
    hideLoading();
    resultConfidence.textContent =
      "Не удалось загрузить модель. Запустите train_model.py";
    console.error(err);
  }
}

drawCanvas.addEventListener("mousedown", startDraw);
drawCanvas.addEventListener("mousemove", draw);
drawCanvas.addEventListener("mouseup", endDraw);
drawCanvas.addEventListener("mouseleave", endDraw);
drawCanvas.addEventListener("touchstart", startDraw, { passive: false });
drawCanvas.addEventListener("touchmove", draw, { passive: false });
drawCanvas.addEventListener("touchend", endDraw);

btnClear.addEventListener("click", clearCanvas);
btnPredict.addEventListener("click", predict);

initCanvas();
renderProbabilities(new Array(10).fill(0));
loadModel();
