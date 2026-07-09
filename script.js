/* ---------- Minimal BibTeX parser ---------- */
function parseBibtex(text) {
  const entries = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),/g;
  let match;
  const starts = [];
  while ((match = entryRegex.exec(text)) !== null) {
    starts.push({ type: match[1].toLowerCase(), key: match[2].trim(), bodyStart: entryRegex.lastIndex, headerStart: match.index });
  }

  for (let i = 0; i < starts.length; i++) {
    const { type, key, bodyStart } = starts[i];
    // find the matching closing brace by counting from the '{' after @type{key,
    let depth = 1;
    let j = bodyStart;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(bodyStart, j - 1);
    const fields = parseFields(body);
    entries.push({ type, key, fields });
  }
  return entries;
}

function parseFields(body) {
  const fields = {};
  let i = 0;
  const n = body.length;
  while (i < n) {
    // skip whitespace/commas
    while (i < n && /[\s,]/.test(body[i])) i++;
    if (i >= n) break;
    // read field name
    let nameStart = i;
    while (i < n && body[i] !== '=') i++;
    const name = body.slice(nameStart, i).trim().toLowerCase();
    i++; // skip '='
    while (i < n && /\s/.test(body[i])) i++;
    if (body[i] === '{') {
      let depth = 1;
      let valStart = ++i;
      while (i < n && depth > 0) {
        if (body[i] === '{') depth++;
        else if (body[i] === '}') depth--;
        if (depth > 0) i++;
      }
      const value = body.slice(valStart, i);
      i++; // skip closing brace
      if (name) fields[name] = value.trim();
    } else if (body[i] === '"') {
      let valStart = ++i;
      while (i < n && body[i] !== '"') i++;
      const value = body.slice(valStart, i);
      i++;
      if (name) fields[name] = value.trim();
    } else {
      let valStart = i;
      while (i < n && body[i] !== ',' ) i++;
      const value = body.slice(valStart, i);
      if (name) fields[name] = value.trim();
    }
  }
  return fields;
}

/* ---------- Author formatting ---------- */
// Converts "\b{Y. Dubey}" markers into <b> tags, keeps rest as text
function renderBoldMarkup(str) {
  return str.replace(/\\b\{([^}]*)\}/g, '<b>$1</b>');
}

function formatAuthorsAPA(authorField) {
  // Split on ' and ' while respecting \b{...} groups (no 'and' expected inside names)
  const rawAuthors = authorField.split(/\s+and\s+/).map(s => s.trim()).filter(Boolean);

  const formatted = rawAuthors.map(a => renderBoldMarkup(a));

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return formatted[0] + ', &amp;&nbsp;' + formatted[1];

  const allButLast = formatted.slice(0, -1).join(', ');
  const last = formatted[formatted.length - 1];
  return allButLast + ', &amp; ' + last;
}

/* ---------- APA formatting per entry type ---------- */
function formatAPA(entry) {
  const f = entry.fields;
  const authors = formatAuthorsAPA(f.author || 'Unknown Author');
  const year = f.year ? `(${f.year}).` : '(n.d.).';
  const title = (f.title || 'Untitled').replace(/[{}]/g, '');

  let rest = '';
  if (entry.type === 'article') {
    const journal = f.journal || '';
    const vol = f.volume ? `<i>${f.volume}</i>` : '';
    const num = f.number ? `(${f.number})` : '';
    const pages = f.pages ? `, ${f.pages.replace('--', '–')}` : '';
    rest = `<i>${journal}</i>${vol || num || pages ? ', ' : ''}${vol}${num}${pages}.`;
  } else if (entry.type === 'inproceedings') {
    const booktitle = f.booktitle || '';
    const pages = f.pages ? ` (pp. ${f.pages.replace('--', '–')})` : '';
    rest = `In <i>${booktitle}</i>${pages}.`;
  } else if (entry.type === 'incollection') {
    const publisher = f.publisher || '';
    const pages = f.pages ? ` (pp. ${f.pages.replace('--', '–')})` : '';
    rest = `${publisher}${pages}.`;
  } else {
    rest = f.journal || f.booktitle || f.publisher || '';
  }

  const doiLink = f.doi
    ? `<a class="pub-link" href="https://doi.org/${f.doi}" target="_blank" rel="noopener">DOI &rarr;</a>`
    : '';

  const typeLabel = { article: 'Journal Article', inproceedings: 'Conference Paper', incollection: 'Book Chapter' }[entry.type] || entry.type;

  return `
    <div class="pub-type">${typeLabel}</div>
    <div>${authors}. ${year} ${title}. ${rest}${doiLink}</div>
  `;
}

/* ---------- Render ---------- */
let ALL_ENTRIES = [];
let CURRENT_FILTER = 'all';

function render() {
  const list = document.getElementById('pub-list');
  list.innerHTML = '';

  // Sort newest first by year
  const sorted = [...ALL_ENTRIES].sort((a, b) => {
    const ya = parseInt(a.fields.year) || 0;
    const yb = parseInt(b.fields.year) || 0;
    return yb - ya;
  });

  const filtered = CURRENT_FILTER === 'all'
    ? sorted
    : sorted.filter(e => e.type === CURRENT_FILTER);

  if (filtered.length === 0) {
    list.innerHTML = '<li class="pub-empty">No publications in this category.</li>';
    return;
  }

  filtered.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'pub-item';
    li.innerHTML = formatAPA(entry);
    list.appendChild(li);
  });
}

function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      CURRENT_FILTER = btn.dataset.type;
      render();
    });
  });
}

fetch('publications.bib')
  .then(res => res.text())
  .then(text => {
    ALL_ENTRIES = parseBibtex(text);
    setupFilters();
    render();
  })
  .catch(err => {
    document.getElementById('pub-list').innerHTML =
      '<li class="pub-empty">Could not load publications.bib — ' + err + '</li>';
  });
