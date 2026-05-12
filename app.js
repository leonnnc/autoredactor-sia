// ─── AutoRedactor SIA — Sin IA ────────────────────────────────────────────────

const SLIDE_TEMPLATES = [
  { id:'corporate', name:'Corporativo', icon:'🏢', colors:{bg:'#0f172a',accent:'#3b82f6',text:'#f8fafc',sub:'#94a3b8'} },
  { id:'creative',  name:'Creativo',    icon:'🎨', colors:{bg:'#1a0533',accent:'#e040fb',text:'#ffffff', sub:'#ce93d8'} },
  { id:'minimal',   name:'Minimalista', icon:'◻',  colors:{bg:'#ffffff',accent:'#111827',text:'#111827',sub:'#6b7280'} },
  { id:'nature',    name:'Natural',     icon:'🌿', colors:{bg:'#052e16',accent:'#22c55e',text:'#f0fdf4',sub:'#86efac'} },
  { id:'sunset',    name:'Atardecer',   icon:'🌅', colors:{bg:'#431407',accent:'#f97316',text:'#fff7ed',sub:'#fed7aa'} },
  { id:'ocean',     name:'Océano',      icon:'��', colors:{bg:'#083344',accent:'#06b6d4',text:'#ecfeff',sub:'#a5f3fc'} },
];

const state = {
  step:0, selectedTemplate:null, bgImage:null, bgFileName:'',
  slides:[], exporting:false, editingIndex:null,
};

// ─── Detección y parsing de texto ────────────────────────────────────────────

// Detecta si el texto es un pasaje bíblico
// Patrones: "Juan 3:16", "Génesis 1:1-10", "1 Corintios 13", líneas que empiezan con número+espacio
function isBibleText(text) {
  const bibleBookPattern = /^(G[eé]nesis|[EÉ]xodo|Levítico|N[uú]meros|Deuteronomio|Josu[eé]|Jueces|Rut|[12]\s*Samuel|[12]\s*Reyes|[12]\s*Cr[oó]nicas|Esdras|Nehe|Ester|Job|Salmos?|Proverbios|Eclesiastés|Cantares|Isa[ií]as?|Jerem|Lament|Ezequiel|Daniel|Oseas|Joel|Am[oó]s|Abd|Jon[aá]s|Miqueas|Nah[uú]m|Habacuc|Sofonías|Hageo|Zacarías|Malaqu|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|[12]\s*Corintios|G[aá]latas|Efesios|Filipenses|Colosenses|[12]\s*Tesalonicenses|[12]\s*Timoteo|Tito|Filem[oó]n|Hebreos|Santiago|[12]\s*Pedro|[12]\s*Juan|[23]\s*Juan|Judas|Apocalipsis)/i;
  const lines = text.trim().split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l; });
  if (lines.length === 0) return false;
  // Primera línea es nombre de libro
  if (bibleBookPattern.test(lines[0])) return true;
  // Varias líneas empiezan con número seguido de texto
  const verseLines = lines.filter(function(l){ return /^\d+\s+\S/.test(l); });
  return verseLines.length >= 2;
}

// Parsea texto bíblico: libro como título, cada versículo = una slide
function parseBibleText(text) {
  const lines = text.trim().split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l; });
  if (lines.length === 0) return [];

  const slides = [];
  let bookTitle = '';
  let reference = '';

  // Detectar primera línea como referencia del libro
  const firstLine = lines[0];
  const bookRefPattern = /^(.+?\d+)\s*[:\-]?\s*(\d+.*)?$/;
  const isBookRef = /^(G[eé]nesis|[EÉ]xodo|Levítico|N[uú]meros|Deuteronomio|Josu[eé]|Jueces|Rut|[12]\s*Samuel|[12]\s*Reyes|[12]\s*Cr[oó]nicas|Esdras|Nehe|Ester|Job|Salmos?|Proverbios|Eclesiastés|Cantares|Isa[ií]as?|Jerem|Lament|Ezequiel|Daniel|Oseas|Joel|Am[oó]s|Abd|Jon[aá]s|Miqueas|Nah[uú]m|Habacuc|Sofonías|Hageo|Zacarías|Malaqu|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|[12]\s*Corintios|G[aá]latas|Efesios|Filipenses|Colosenses|[12]\s*Tesalonicenses|[12]\s*Timoteo|Tito|Filem[oó]n|Hebreos|Santiago|[12]\s*Pedro|[12]\s*Juan|[23]\s*Juan|Judas|Apocalipsis)/i.test(firstLine);

  let verseLines = lines;
  if (isBookRef) {
    bookTitle = firstLine;
    verseLines = lines.slice(1);
    // Slide de portada con el nombre del libro
    slides.push({ title: bookTitle, subtitle: '', content: '', isTitle: true });
  }

  // Parsear versículos: líneas que empiezan con número
  // Pueden venir como "1 En el principio..." o pegados sin salto
  // Primero unir todo el texto de versículos y re-separar
  const fullVerseText = verseLines.join(' ');
  // Separar por número al inicio: "1 texto 2 texto 3 texto"
  const verseParts = fullVerseText.split(/(?=\b\d{1,3}\s+[A-ZÁÉÍÓÚÑ])/);

  verseParts.forEach(function(part) {
    part = part.trim();
    if (!part) return;
    const match = part.match(/^(\d+)\s+([\s\S]+)$/);
    if (match) {
      const verseNum = match[1];
      const verseText = match[2].trim();
      slides.push({
        title: verseText,
        subtitle: (bookTitle ? bookTitle.split(' ')[0] + ' ' : '') + verseNum,
        content: '',
        isVerse: true,
      });
    } else if (part.length > 0) {
      // Texto sin número de versículo
      slides.push({ title: part, subtitle: '', content: '' });
    }
  });

  return slides.filter(function(s){ return s.title && s.title.trim(); });
}

// Parsea texto plano: cada bloque separado por línea en blanco = una slide
function parsePlainText(text) {
  const blocks = text.split(/\n\s*\n/).map(function(b){ return b.trim(); }).filter(function(b){ return b.length > 0; });

  return blocks.map(function(block) {
    const lines = block.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
    if (lines.length === 0) return null;

    let title = lines[0].replace(/^#+\s*/, '').trim();
    if (title.length > 90) title = title.slice(0, 87) + '...';

    let subtitle = '';
    let contentStart = 1;
    if (lines.length > 1 && lines[1].length < 70 && !lines[1].startsWith('•') && !lines[1].startsWith('-')) {
      subtitle = lines[1];
      contentStart = 2;
    }

    const bulletLines = lines.slice(contentStart, contentStart + 6).map(function(l) {
      return '• ' + l.replace(/^[-•*]\s*/, '').trim();
    });

    return { title: title, subtitle: subtitle, content: bulletLines.join('\n') };
  }).filter(function(s){ return s !== null; });
}

// Función principal
function parseTextToSlides(text) {
  if (!text.trim()) return [];
  if (isBibleText(text)) {
    return parseBibleText(text);
  }
  return parsePlainText(text);
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderSlideToCanvas(slide, template, index, total, bgImageDataUrl) {
  return new Promise(function(resolve) {
    const W = 1280, H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const c = template.colors;

    function draw(bgImg) {
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, W, H);
        const grd = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.75);
        grd.addColorStop(0, c.accent + '28');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = bgImg ? 'rgba(255,255,255,0.85)' : c.accent;
      ctx.fillRect(0, H - 6, W * 0.45, 6);
      ctx.fillStyle = bgImg ? 'rgba(255,255,255,0.3)' : c.accent + '33';
      ctx.fillRect(W * 0.45, H - 6, W * 0.55, 6);

      ctx.save();
      ctx.font = '600 20px monospace';
      ctx.fillStyle = bgImg ? 'rgba(255,255,255,0.55)' : c.sub + '70';
      ctx.textAlign = 'left';
      ctx.fillText(String(index+1).padStart(2,'0') + ' / ' + String(total).padStart(2,'0'), 64, 56);
      ctx.restore();

      ctx.save();
      ctx.font = '500 16px monospace';
      ctx.fillStyle = bgImg ? 'rgba(255,255,255,0.45)' : c.accent + '80';
      ctx.textAlign = 'right';
      ctx.fillText(template.name.toUpperCase(), W - 64, 56);
      ctx.restore();

      const textColor = bgImg ? '#ffffff' : c.text;
      const subColor  = bgImg ? 'rgba(255,255,255,0.82)' : c.sub;
      const accentCol = bgImg ? '#ffffff' : c.accent;
      const PAD = 130, CX = W / 2, CW = W - PAD * 2;
      const titleSize = slide.title.length > 55 ? 46 : slide.title.length > 35 ? 54 : 64;

      ctx.font = 'bold ' + titleSize + 'px Georgia, serif';
      const titleLines = wrapText(ctx, slide.title, CW);
      const titleLineH = titleSize * 1.3;
      const rawLines = slide.content ? slide.content.split('\n').filter(function(l){ return l.trim(); }) : [];
      const bulletSize = 24;
      ctx.font = bulletSize + "px 'Segoe UI', sans-serif";
      const bulletRows = rawLines.flatMap(function(line) {
        const isBullet = line.startsWith('•');
        const clean = isBullet ? line.slice(1).trim() : line;
        return wrapText(ctx, clean, CW - 40).map(function(w, i) { return { text: w, bullet: isBullet && i === 0 }; });
      });
      const bulletRowH = bulletSize * 1.7;
      const hasSubtitle = !!slide.subtitle;
      const blockH = titleLines.length * titleLineH + (hasSubtitle ? 56 : 0) + (bulletRows.length > 0 ? 46 + bulletRows.length * bulletRowH : 0);
      let y = H / 2 - blockH / 2 + titleSize;

      ctx.font = 'bold ' + titleSize + 'px Georgia, serif';
      ctx.fillStyle = textColor; ctx.textAlign = 'center';
      for (const line of titleLines) { ctx.fillText(line, CX, y); y += titleLineH; }

      if (hasSubtitle) {
        y += 14;
        ctx.font = "600 27px 'Segoe UI', sans-serif";
        ctx.fillStyle = accentCol; ctx.textAlign = 'center';
        ctx.fillText(slide.subtitle, CX, y); y += 42;
      }
      if (bulletRows.length > 0) {
        y += 10;
        ctx.save(); ctx.strokeStyle = accentCol + '55'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(CX - 180, y); ctx.lineTo(CX + 180, y); ctx.stroke(); ctx.restore();
        y += 36;
      }
      for (const row of bulletRows) {
        ctx.font = bulletSize + "px 'Segoe UI', sans-serif"; ctx.textAlign = 'center';
        if (row.bullet) {
          const arrow = '▸';
          const arrowW = ctx.measureText(arrow + '  ').width;
          const totalW = ctx.measureText(arrow + '  ' + row.text).width;
          const startX = CX - totalW / 2;
          ctx.fillStyle = accentCol; ctx.textAlign = 'left'; ctx.fillText(arrow, startX, y);
          ctx.fillStyle = subColor; ctx.fillText('  ' + row.text, startX + arrowW, y);
        } else {
          ctx.fillStyle = subColor; ctx.textAlign = 'center'; ctx.fillText(row.text, CX, y);
        }
        y += bulletRowH;
      }
      resolve(canvas);
    }

    if (bgImageDataUrl) {
      const img = new Image();
      img.onload = function() { draw(img); };
      img.onerror = function() { draw(null); };
      img.src = bgImageDataUrl;
    } else { draw(null); }
  });
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderTemplatesGrid() {
  const grid = document.getElementById('templates-grid');
  grid.innerHTML = '';
  SLIDE_TEMPLATES.forEach(function(tmpl) {
    const c = tmpl.colors;
    const sel = state.selectedTemplate && state.selectedTemplate.id === tmpl.id;
    const card = document.createElement('button');
    card.className = 'template-card' + (sel ? ' selected' : '');
    card.style.borderColor = sel ? c.accent : '#334155';
    card.style.boxShadow   = sel ? '0 0 0 3px ' + c.accent + '40' : 'none';
    card.innerHTML =
      '<div class="tmpl-swatches">' +
        [c.bg,c.accent,c.text,c.sub].map(function(col){ return '<div class="tmpl-swatch" style="background:'+col+'"></div>'; }).join('') +
      '</div>' +
      '<div class="tmpl-info">' +
        '<div class="tmpl-name"><span>'+tmpl.icon+'</span><span>'+tmpl.name+'</span></div>' +
        '<div class="tmpl-accent-line" style="background:'+c.accent+'"></div>' +
      '</div>' +
      (sel ? '<div class="tmpl-check" style="background:'+c.accent+'">✓</div>' : '');
    card.addEventListener('click', function() {
      state.selectedTemplate = tmpl;
      renderTemplatesGrid();
      updateTemplateConfirm();
      updateComboPreview();
    });
    grid.appendChild(card);
  });
}

function updateTemplateConfirm() {
  const el = document.getElementById('template-confirm');
  const txt = document.getElementById('template-confirm-text');
  if (!state.selectedTemplate) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  txt.innerHTML = '<span style="color:#4ade80">✓</span> Paleta <strong>' + state.selectedTemplate.name + '</strong>' +
    (state.bgImage ? ' · <span style="color:#60a5fa">con imagen de fondo</span>' : '');
}

function updateComboPreview() {
  const wrap = document.getElementById('bg-combo-preview');
  if (!state.bgImage || !state.selectedTemplate) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  document.getElementById('combo-img').src = state.bgImage;
  document.getElementById('combo-stripe').style.background = state.selectedTemplate.colors.accent;
}

function buildSlidePreviewEl(slide, template, index, total, bgImage) {
  const c = template.colors;
  const lines = slide.content ? slide.content.split('\n').filter(function(l){ return l.trim(); }) : [];
  const textCol = bgImage ? '#fff' : c.text;
  const subCol  = bgImage ? 'rgba(255,255,255,0.82)' : c.sub;
  const accCol  = bgImage ? '#fff' : c.accent;

  const div = document.createElement('div');
  div.className = 'slide-preview';
  div.style.background = bgImage ? '#000' : c.bg;
  div.style.border = '1.5px solid ' + c.accent + '30';

  if (bgImage) {
    const img = document.createElement('img');
    img.className = 'sp-bg-img'; img.src = bgImage; img.alt = '';
    div.appendChild(img);
  } else {
    const glow = document.createElement('div');
    glow.className = 'sp-glow';
    glow.style.background = 'radial-gradient(ellipse at 105% -5%, ' + c.accent + '22, transparent 55%)';
    div.appendChild(glow);
  }

  const stripe = document.createElement('div');
  stripe.className = 'sp-stripe';
  stripe.innerHTML = '<div style="flex:0 0 45%;background:' + (bgImage?'rgba(255,255,255,0.85)':c.accent) + '"></div>' +
    '<div style="flex:1;background:' + (bgImage?'rgba(255,255,255,0.28)':c.accent+'30') + '"></div>';
  div.appendChild(stripe);

  const counter = document.createElement('div');
  counter.className = 'sp-counter';
  counter.style.color = subCol;
  counter.textContent = String(index+1).padStart(2,'0') + ' / ' + String(total).padStart(2,'0');
  div.appendChild(counter);

  const content = document.createElement('div');
  content.className = 'sp-content';

  const titleSize = slide.title.length > 55 ? 'clamp(11px,2vw,20px)' : slide.title.length > 35 ? 'clamp(13px,2.4vw,24px)' : 'clamp(15px,2.9vw,29px)';
  const h2 = document.createElement('h2');
  h2.className = 'sp-title';
  h2.style.cssText = 'color:' + textCol + ';font-size:' + titleSize;
  h2.textContent = slide.title;
  content.appendChild(h2);

  if (slide.subtitle) {
    const sub = document.createElement('div');
    sub.className = 'sp-subtitle';
    sub.style.color = accCol;
    sub.textContent = slide.subtitle;
    content.appendChild(sub);
  }

  if (lines.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'sp-divider';
    divider.style.background = accCol + '45';
    content.appendChild(divider);
    const bullets = document.createElement('div');
    bullets.className = 'sp-bullets';
    lines.forEach(function(line) {
      const row = document.createElement('div');
      row.className = 'sp-bullet-row';
      row.style.color = subCol;
      if (line.startsWith('•')) {
        row.innerHTML = '<span class="sp-arrow" style="color:' + accCol + '">▸</span><span>' + line.slice(1).trim() + '</span>';
      } else { row.textContent = line; }
      bullets.appendChild(row);
    });
    content.appendChild(bullets);
  }
  div.appendChild(content);
  return div;
}

function renderSlidesGrid() {
  const grid = document.getElementById('slides-grid');
  grid.innerHTML = '';
  const tmpl = state.selectedTemplate;
  const c = tmpl.colors;

  state.slides.forEach(function(slide, index) {
    const item = document.createElement('div');
    item.className = 'slide-item';
    const toolbar = document.createElement('div');
    toolbar.className = 'slide-toolbar';
    const num = document.createElement('span');
    num.className = 'slide-num';
    num.style.cssText = 'color:' + c.accent + ';background:' + c.accent + '18';
    num.textContent = '#' + String(index+1).padStart(2,'0');
    toolbar.appendChild(num);
    const controls = document.createElement('div');
    controls.className = 'slide-controls';
    [
      { label:'↑', cls:'up',   disabled:index===0,                     fn:function(){ moveSlide(index,-1); } },
      { label:'↓', cls:'down', disabled:index===state.slides.length-1, fn:function(){ moveSlide(index,1); } },
      { label:'✏', cls:'edit', disabled:false,                          fn:function(){ openEditModal(index); } },
      { label:'✕', cls:'del',  disabled:false,                          fn:function(){ removeSlide(index); } },
    ].forEach(function(b) {
      const btn = document.createElement('button');
      btn.className = 'slide-ctrl-btn ' + b.cls;
      btn.textContent = b.label;
      btn.disabled = b.disabled;
      btn.addEventListener('click', b.fn);
      controls.appendChild(btn);
    });
    toolbar.appendChild(controls);
    item.appendChild(toolbar);
    item.appendChild(buildSlidePreviewEl(slide, tmpl, index, state.slides.length, state.bgImage));
    grid.appendChild(item);
  });

  document.getElementById('slides-count-badge').textContent = state.slides.length + ' DIAPOSITIVAS • LISTAS';
  const btnAdd = document.getElementById('btn-add-slide');
  btnAdd.style.cssText = 'border:1px solid ' + c.accent + '50;color:' + c.accent + ';background:' + c.accent + '12';
}

function updateInfoStrip() {
  const tmpl = state.selectedTemplate;
  if (!tmpl) return;
  const c = tmpl.colors;
  const iconEl = document.getElementById('info-icon');
  if (state.bgImage) {
    iconEl.innerHTML = '<img src="' + state.bgImage + '" style="width:48px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #334155">';
  } else {
    iconEl.textContent = tmpl.icon;
    iconEl.style.fontSize = '18px';
  }
  document.getElementById('info-name').textContent = tmpl.name;
  const swatches = document.getElementById('info-swatches');
  swatches.innerHTML = [c.bg,c.accent,c.text,c.sub].map(function(col){
    return '<div class="info-swatch" style="background:' + col + '"></div>';
  }).join('');
}

// ─── Navegación ───────────────────────────────────────────────────────────────
function updateStepNav() {
  document.querySelectorAll('.step-btn').forEach(function(btn) {
    const i = parseInt(btn.dataset.step);
    btn.classList.remove('active','done');
    const numEl = btn.querySelector('.step-num');
    if (i === state.step)    { btn.classList.add('active'); numEl.textContent = i+1; }
    else if (i < state.step) { btn.classList.add('done');   numEl.textContent = '✓'; }
    else                     { numEl.textContent = i+1; }
  });
  for (let i = 0; i < 2; i++) {
    const line = document.getElementById('line-' + i + '-' + (i+1));
    if (line) line.classList.toggle('done', state.step > i);
  }
}

function goToStep(n) {
  if (n < 0 || n > 2) return;
  state.step = n;
  ['step-template','step-content','step-result'].forEach(function(id, i) {
    const el = document.getElementById(id);
    el.classList.toggle('active', i === n);
    el.classList.toggle('hidden', i !== n);
  });
  updateStepNav();
  if (n === 2) { renderSlidesGrid(); updateInfoStrip(); }
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
function moveSlide(i, d) {
  const ns = [...state.slides], t = i + d;
  if (t < 0 || t >= ns.length) return;
  [ns[i], ns[t]] = [ns[t], ns[i]];
  state.slides = ns; renderSlidesGrid();
}
function removeSlide(i) {
  state.slides = state.slides.filter(function(_, idx){ return idx !== i; });
  renderSlidesGrid();
}
function addSlide() {
  state.slides.push({ title:'Nueva diapositiva', subtitle:'', content:'• Contenido aquí\n• Segundo punto' });
  renderSlidesGrid();
}

// ─── Modal edición ────────────────────────────────────────────────────────────
function openEditModal(index) {
  state.editingIndex = index;
  const s = state.slides[index];
  document.getElementById('edit-title').value    = s.title    || '';
  document.getElementById('edit-subtitle').value = s.subtitle || '';
  document.getElementById('edit-content').value  = s.content  || '';
  document.getElementById('edit-modal').classList.remove('hidden');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  state.editingIndex = null;
}
function saveEditModal() {
  if (state.editingIndex === null) return;
  state.slides[state.editingIndex] = {
    title:    document.getElementById('edit-title').value,
    subtitle: document.getElementById('edit-subtitle').value,
    content:  document.getElementById('edit-content').value,
  };
  closeEditModal(); renderSlidesGrid();
}

// ─── Generar slides (algoritmo local) ────────────────────────────────────────
function generateSlides() {
  const text = document.getElementById('content-textarea').value.trim();
  if (!text) { showError('Escribe o pega tu contenido primero.'); return; }
  if (!state.selectedTemplate) { showError('Selecciona una plantilla primero.'); return; }
  
  const slides = parseTextToSlides(text);
  if (slides.length === 0) { showError('No se pudo procesar el texto. Asegúrate de tener párrafos separados por líneas en blanco.'); return; }
  state.slides = slides;
  hideError();
  goToStep(2);
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  document.getElementById('error-box').classList.remove('hidden');
}
function hideError() { document.getElementById('error-box').classList.add('hidden'); }

// ─── Exportar JPG / PNG ───────────────────────────────────────────────────────
async function exportImages(format) {
  if (!state.slides.length || !state.selectedTemplate || state.exporting) return;
  state.exporting = true;
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext  = format === 'jpg' ? 'jpg' : 'png';
  const quality = format === 'jpg' ? 0.95 : undefined;

  setExportProgress(true, format.toUpperCase());
  await new Promise(function(r){ setTimeout(r, 60); });

  for (let i = 0; i < state.slides.length; i++) {
    const canvas = await renderSlideToCanvas(state.slides[i], state.selectedTemplate, i, state.slides.length, state.bgImage);
    await new Promise(function(resolve) {
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diapositiva-' + String(i+1).padStart(2,'0') + '.' + ext;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
        resolve();
      }, mime, quality);
    });
    updateProgress(i+1, state.slides.length, 'diapositiva-' + String(i+1).padStart(2,'0') + '.' + ext);
    await new Promise(function(r){ setTimeout(r, 350); });
  }
  setExportProgress(false);
  state.exporting = false;
}

// ─── Exportar PPTX ───────────────────────────────────────────────────────────
async function exportPptx() {
  if (!state.slides.length || !state.selectedTemplate || state.exporting) return;
  state.exporting = true;
  setExportProgress(true, 'PPTX');

  const tmpl = state.selectedTemplate;
  const c = tmpl.colors;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  for (let i = 0; i < state.slides.length; i++) {
    const slide = state.slides[i];
    const pSlide = pptx.addSlide();

    // Fondo
    if (state.bgImage) {
      pSlide.addImage({ data: state.bgImage, x:0, y:0, w:'100%', h:'100%' });
      pSlide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color:'000000', transparency:48 } });
    } else {
      pSlide.background = { color: c.bg.replace('#','') };
    }

    const textColor = state.bgImage ? 'FFFFFF' : c.text.replace('#','');
    const accentColor = state.bgImage ? 'FFFFFF' : c.accent.replace('#','');
    const subColor = state.bgImage ? 'CCCCCC' : c.sub.replace('#','');

    // Franja inferior
    pSlide.addShape(pptx.ShapeType.rect, { x:0, y:6.8, w:5.76, h:0.08, fill:{ color: accentColor } });
    pSlide.addShape(pptx.ShapeType.rect, { x:5.76, y:6.8, w:4.24, h:0.08, fill:{ color: accentColor, transparency:70 } });

    // Contador
    pSlide.addText(String(i+1).padStart(2,'0') + ' / ' + String(state.slides.length).padStart(2,'0'), {
      x:0.5, y:0.2, w:2, h:0.3, fontSize:10, color:subColor, fontFace:'Courier New',
    });

    // Nombre plantilla
    pSlide.addText(tmpl.name.toUpperCase(), {
      x:7.5, y:0.2, w:2, h:0.3, fontSize:9, color:accentColor, fontFace:'Courier New', align:'right',
    });

    // Título
    const titleSize = slide.title.length > 55 ? 24 : slide.title.length > 35 ? 28 : 36;
    pSlide.addText(slide.title, {
      x:0.8, y:1.8, w:8.4, h:1.5, fontSize:titleSize, bold:true, color:textColor,
      fontFace:'Georgia', align:'center', valign:'middle', wrap:true,
    });

    // Subtítulo
    if (slide.subtitle) {
      pSlide.addText(slide.subtitle, {
        x:0.8, y:3.4, w:8.4, h:0.5, fontSize:16, bold:true, color:accentColor,
        fontFace:'Segoe UI', align:'center',
      });
    }

    // Bullets
    if (slide.content) {
      const lines = slide.content.split('\n').filter(function(l){ return l.trim(); });
      const bulletObjs = lines.map(function(line) {
        const isBullet = line.startsWith('•');
        return {
          text: (isBullet ? '▸  ' : '') + (isBullet ? line.slice(1).trim() : line),
          options: { color: isBullet ? subColor : subColor, fontSize:13, bullet:false },
        };
      });
      const yPos = slide.subtitle ? 4.0 : 3.6;
      pSlide.addText(bulletObjs, {
        x:1.2, y:yPos, w:7.6, h:2.2, fontFace:'Segoe UI', align:'center', valign:'top', wrap:true,
      });
    }

    updateProgress(i+1, state.slides.length, 'slide ' + (i+1));
    await new Promise(function(r){ setTimeout(r, 50); });
  }

  await pptx.writeFile({ fileName: 'presentacion-autoredactor.pptx' });
  setExportProgress(false);
  state.exporting = false;
}

// ─── Progress helpers ─────────────────────────────────────────────────────────
function setExportProgress(on, label) {
  const bar = document.getElementById('export-progress');
  const lbl = document.getElementById('progress-label-text');
  bar.classList.toggle('hidden', !on);
  if (on && label) lbl.textContent = 'Exportando ' + label + '...';
  document.getElementById('progress-fill').style.width = '0%';
  ['btn-download-jpg','btn-download-png','btn-download-pptx'].forEach(function(id){
    document.getElementById(id).disabled = on;
  });
}
function updateProgress(current, total, filename) {
  document.getElementById('progress-fill').style.width = ((current/total)*100) + '%';
  document.getElementById('progress-filename').textContent = filename;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  renderTemplatesGrid();

  // Step nav
  document.querySelectorAll('.step-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const i = parseInt(btn.dataset.step);
      if (i <= state.step) goToStep(i);
    });
  });

  // Upload
  const uploadArea = document.getElementById('upload-area');
  const fileInput  = document.getElementById('file-input');
  uploadArea.addEventListener('click', function(){ fileInput.click(); });
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Imagen demasiado grande. Máximo 5MB.'); return; }
    state.bgFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = function() {
        state.bgImage = dataUrl;
        document.getElementById('bg-thumb').src = dataUrl;
        document.getElementById('bg-filename').textContent = file.name;
        document.getElementById('upload-area').classList.add('hidden');
        document.getElementById('bg-preview').classList.remove('hidden');
        updateTemplateConfirm();
        updateComboPreview();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-change-bg').addEventListener('click', function(){ fileInput.click(); });
  document.getElementById('btn-remove-bg').addEventListener('click', function() {
    state.bgImage = null; state.bgFileName = ''; fileInput.value = '';
    document.getElementById('bg-preview').classList.add('hidden');
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('bg-combo-preview').classList.add('hidden');
    updateTemplateConfirm();
  });

  document.getElementById('btn-to-content').addEventListener('click', function(){ goToStep(1); });

  // Textarea stats + slider
  const textarea = document.getElementById('content-textarea');
  textarea.addEventListener('input', function() {
    const val = textarea.value;
    const words = val.trim().split(/\s+/).filter(Boolean).length;
    document.getElementById('text-stats').textContent = val.length + ' chars · ' + words + ' palabras';
  });

  // Step 2
  document.getElementById('btn-back-template').addEventListener('click', function(){ goToStep(0); });
  document.getElementById('btn-generate').addEventListener('click', generateSlides);

  // Step 3
  document.getElementById('btn-regenerate').addEventListener('click', function() {
    state.slides = []; goToStep(1);
  });
  document.getElementById('btn-add-slide').addEventListener('click', addSlide);
  document.getElementById('btn-download-jpg').addEventListener('click', function(){ exportImages('jpg'); });
  document.getElementById('btn-download-png').addEventListener('click', function(){ exportImages('png'); });
  document.getElementById('btn-download-pptx').addEventListener('click', exportPptx);
  document.getElementById('btn-change-format').addEventListener('click', function(){ goToStep(0); });
  document.getElementById('btn-new-presentation').addEventListener('click', function() {
    state.slides = []; state.selectedTemplate = null;
    state.bgImage = null; state.bgFileName = '';
    document.getElementById('content-textarea').value = '';
    document.getElementById('bg-preview').classList.add('hidden');
    document.getElementById('upload-area').classList.remove('hidden');
    document.getElementById('bg-combo-preview').classList.add('hidden');
    document.getElementById('template-confirm').classList.add('hidden');
    renderTemplatesGrid();
    goToStep(0);
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeEditModal);
  document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
  document.getElementById('modal-save').addEventListener('click', saveEditModal);
  document.getElementById('edit-modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('edit-modal')) closeEditModal();
  });
});
