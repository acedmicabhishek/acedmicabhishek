#!/usr/bin/env node
// Generates the entire ACE profile as ONE single SVG
// Fetches real data from GitHub GraphQL API

const QUERY = `
query ($login: String!) {
  user(login: $login) {
    name
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        name
        description
        stargazerCount
        forkCount
        primaryLanguage { name color }
        url
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
    }
  }
}`;

async function fetchData(username, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ace-readme',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data.user;
}

function processData(user) {
  const repos = user.repositories.nodes;
  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = repos.reduce((s, r) => s + r.forkCount, 0);
  const totalRepos = user.repositories.totalCount;
  const totalCommits = user.contributionsCollection.totalCommitContributions;

  // Languages by repo count
  const langMap = {};
  for (const r of repos) {
    if (r.primaryLanguage) {
      const name = r.primaryLanguage.name;
      if (!langMap[name]) langMap[name] = { name, color: r.primaryLanguage.color, count: 0 };
      langMap[name].count++;
    }
  }
  const langArr = Object.values(langMap).sort((a, b) => b.count - a.count).slice(0, 10);
  const totalLang = langArr.reduce((s, l) => s + l.count, 0);
  const languages = langArr.map(l => ({ ...l, percentage: Math.round((l.count / totalLang) * 100) }));

  // Top 3 projects (by stars)
  const topProjects = repos
    .filter(r => r.name && r.description)
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 3)
    .map(r => ({
      name: r.name,
      desc: r.description,
      stars: r.stargazerCount,
      forks: r.forkCount,
      lang: r.primaryLanguage ? r.primaryLanguage.name : null,
      langColor: r.primaryLanguage ? r.primaryLanguage.color : '#555',
      url: r.url,
    }));

  return {
    stats: { totalStars, totalForks, totalRepos, totalCommits },
    languages,
    topProjects,
    calendar: user.contributionsCollection.contributionCalendar,
  };
}

function generateSVG(data) {
  const W = 800;
  // Section heights
  const heroH = 240;
  const techH = 60;
  const statsH = 90;
  const langH = 190;
  const calH = 195;
  const projH = 195;
  const footerH = 30;
  const gap = 10;
  const totalH = heroH + techH + statsH + langH + calH + projH + footerH + gap * 5;
  const font = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

  let y = 0;

  // Animations
  const style = `
    @keyframes drift-r { 0%, 100% { transform: translate(0,0); opacity: 0.6; } 50% { transform: translate(35px,-18px); opacity: 1; } }
    @keyframes drift-l { 0%, 100% { transform: translate(0,0); opacity: 0.55; } 50% { transform: translate(-30px,16px); opacity: 0.95; } }
    @keyframes drift-u { 0%, 100% { transform: translate(0,0); opacity: 0.7; } 50% { transform: translate(25px,-25px); opacity: 1.05; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.2); opacity: 0.35; } }
    @keyframes scan { 0% { transform: translate(-900px,0); } 100% { transform: translate(900px,0); } }
    @keyframes ring-pulse { 0%, 100% { transform: scale(0.9); opacity: 0.15; } 50% { transform: scale(1.1); opacity: 0.35; } }
    @keyframes draw { 0% { stroke-dashoffset: 500; } 100% { stroke-dashoffset: 0; } }
    @keyframes dot-float { 0%, 100% { transform: translate(0,0); opacity: 0.35; } 50% { transform: translate(10px,-15px); opacity: 0.9; } }
    @keyframes glow-dot { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
    .g-dr { animation: drift-r 8s ease-in-out infinite; }
    .g-dl { animation: drift-l 9s ease-in-out infinite 0.3s; }
    .g-du { animation: drift-u 7s ease-in-out infinite 0.6s; }
    .g-p { animation: pulse 6s ease-in-out infinite; }
    .g-scan { animation: scan 4.5s linear infinite; }
    .g-ring { animation: ring-pulse 4s ease-in-out infinite; }
    .g-draw { animation: draw 3s ease-in-out infinite; stroke-dasharray: 250 250; }
    .g-dot { animation: dot-float 5s ease-in-out infinite; }
    .g-gdot { animation: glow-dot 2.5s ease-in-out infinite; }
  `;

  // Gradients
  const defs = `
    <radialGradient id="g1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(120,40,255,0.5)"/><stop offset="100%" stop-color="rgba(120,40,255,0)"/></radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,200,220,0.45)"/><stop offset="100%" stop-color="rgba(0,200,220,0)"/></radialGradient>
    <radialGradient id="g3" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(220,40,200,0.4)"/><stop offset="100%" stop-color="rgba(220,40,200,0)"/></radialGradient>
    <radialGradient id="g4" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(40,120,255,0.35)"/><stop offset="100%" stop-color="rgba(40,120,255,0)"/></radialGradient>
    <radialGradient id="g5" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(80,50,220,0.3)"/><stop offset="100%" stop-color="rgba(80,50,220,0)"/></radialGradient>
    <linearGradient id="scg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(120,200,255,0)"/>
      <stop offset="40%" stop-color="rgba(120,200,255,0.08)"/>
      <stop offset="50%" stop-color="rgba(160,120,255,0.25)"/>
      <stop offset="60%" stop-color="rgba(120,200,255,0.08)"/>
      <stop offset="100%" stop-color="rgba(120,200,255,0)"/>
    </linearGradient>
  `;

  // ═══════════════ HERO ═══════════════
  const hero = (() => {
    const cy = y + heroH / 2;
    return `
    <g>
      <ellipse class="g-dr" cx="200" cy="${cy}" rx="180" ry="110" fill="url(#g1)"/>
      <ellipse class="g-dl" cx="620" cy="${cy+20}" rx="160" ry="95" fill="url(#g2)"/>
      <ellipse class="g-du" cx="420" cy="${cy-30}" rx="140" ry="90" fill="url(#g3)"/>
      <ellipse class="g-p" cx="100" cy="${cy+40}" rx="120" ry="80" fill="url(#g4)"/>
      <rect class="g-scan" x="0" y="${cy}" width="160" height="1" fill="url(#scg)"/>
      <circle class="g-ring" cx="400" cy="${cy}" r="100" fill="none" stroke="rgba(120,200,255,0.12)" stroke-width="1"/>
      <circle class="g-ring" cx="400" cy="${cy}" r="65" fill="none" stroke="rgba(200,120,255,0.1)" stroke-width="0.8" style="animation-delay:0.5s"/>
      <path class="g-draw" d="M 30 ${y+20} L 30 ${y+10} L 45 ${y+10}" fill="none" stroke="rgba(120,200,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
      <path class="g-draw" d="M 770 ${y+20} L 770 ${y+10} L 755 ${y+10}" fill="none" stroke="rgba(200,120,255,0.4)" stroke-width="1.5" stroke-linecap="round" style="animation-delay:0.5s"/>
      <path class="g-draw" d="M 30 ${y+heroH-20} L 30 ${y+heroH-10} L 45 ${y+heroH-10}" fill="none" stroke="rgba(255,120,200,0.35)" stroke-width="1.5" stroke-linecap="round" style="animation-delay:1s"/>
      <circle class="g-dot" cx="50" cy="${cy-50}" r="1.5" fill="rgba(120,200,255,0.7)"/>
      <circle class="g-dot" cx="740" cy="${cy+30}" r="1.5" fill="rgba(200,120,255,0.7)" style="animation-delay:1s"/>
      <circle class="g-dot" cx="680" cy="${cy-45}" r="1.2" fill="rgba(255,120,200,0.6)" style="animation-delay:2s"/>
      <text x="400" y="${cy-45}" text-anchor="middle" font-family="${font}" font-size="38" font-weight="800" fill="#ffffff" letter-spacing="14">ACE</text>
      <text x="400" y="${cy-10}" text-anchor="middle" font-family="${font}" font-size="10" fill="rgba(120,200,255,0.7)" letter-spacing="4" text-transform="uppercase">SYSTEMS PROGRAMMER</text>
      <line x1="320" y1="${cy}" x2="480" y2="${cy}" stroke="rgba(120,200,255,0.15)" stroke-width="0.5"/>
      <text x="400" y="${cy+22}" text-anchor="middle" font-family="${font}" font-size="10" fill="rgba(200,160,255,0.6)" letter-spacing="3">PERFORMANCE ENGINEER | OSDEV</text>
      <text x="400" y="${cy+50}" text-anchor="middle" font-family="${font}" font-size="10" fill="rgba(126,231,255,0.5)" letter-spacing="2">x86/ARM INTERNALS • BARE-METAL • SoC VALIDATION</text>
      <text x="400" y="${cy+80}" text-anchor="middle" font-family="${font}" font-size="9" fill="rgba(80,80,120,0.6)" letter-spacing="1">github.com/acedmicabhishek</text>
    </g>`;
  })();
  y += heroH + gap;

  // ═══════════════ TECH STACK PILLS ═══════════════
  const techStack = (() => {
    const baseY = y;
    const techs = ['C', 'C++', 'x86 ASM', 'Python', 'JavaScript', 'Rust', 'GLSL', 'OpenGL'];
    const colors = ['#7ee7ff', '#e8c8ff', '#ff88cc', '#7ee7ff', '#e8c8ff', '#ff88cc', '#e8c8ff', '#7ee7ff'];
    let pills = '';
    let px = 90;
    techs.forEach((t, i) => {
      const w = t.length * 8 + 24;
      pills += `<rect x="${px}" y="${baseY+16}" width="${w}" height="28" rx="14" fill="rgba(8,6,14,0.7)" stroke="rgba(100,80,220,0.25)" stroke-width="1"/>`;
      pills += `<text x="${px + w/2}" y="${baseY+34}" text-anchor="middle" font-family="${font}" font-size="12" font-weight="700" fill="${colors[i]}">${t}</text>`;
      px += w + 8;
    });
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(110,80,220,0.12)" stroke-width="0.5"/>
      ${pills}
    </g>`;
  })();
  y += techH + gap;

  // ═══════════════ STATS ═══════════════
  const statsBlock = (() => {
    const baseY = y;
    const s = data.stats;
    const items = [
      { val: s.totalStars, label: 'STARS', color: '#b8860b' },
      { val: s.totalForks, label: 'FORKS', color: '#8b7ec8' },
      { val: s.totalRepos, label: 'REPOS', color: '#5a9ca8' },
      { val: s.totalCommits, label: 'COMMITS', color: '#7ee7ff' },
    ];
    let cols = '';
    const colW = 160;
    const startX = (W - colW * 4) / 2;
    items.forEach((item, i) => {
      const cx = startX + i * colW + colW / 2;
      cols += `<text x="${cx}" y="${baseY+36}" text-anchor="middle" font-family="${font}" font-size="24" font-weight="800" fill="#ffffff">${item.val}</text>`;
      cols += `<text x="${cx}" y="${baseY+52}" text-anchor="middle" font-family="${font}" font-size="9" fill="${item.color}" letter-spacing="2" font-weight="600">${item.label}</text>`;
      if (i < 3) {
        cols += `<line x1="${startX + (i+1) * colW}" y1="${baseY+20}" x2="${startX + (i+1) * colW}" y2="${baseY+58}" stroke="rgba(120,80,220,0.15)" stroke-width="0.5"/>`;
      }
    });
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(110,80,220,0.12)" stroke-width="0.5"/>
      <ellipse class="g-dl" cx="400" cy="${baseY+40}" rx="280" ry="50" fill="url(#g1)"/>
      <rect class="g-scan" x="0" y="${baseY+40}" width="160" height="1" fill="url(#scg)" style="animation-delay:1s"/>
      ${cols}
    </g>`;
  })();
  y += statsH + gap;

  // ═══════════════ MOST USED LANGUAGES (aura-component-4 style) ═══════════════
  const langs = (() => {
    const baseY = y;
    const ll = data.languages;
    const barW = 750;
    const barX = 25;
    const barY = baseY + 40;

    // Background bar
    let bar = `<rect x="${barX}" y="${barY}" width="${barW}" height="6" rx="3" fill="rgba(255,255,255,0.05)"/>`;

    // Colored segments
    let bx = barX;
    ll.forEach(l => {
      const w = Math.max(barW * l.percentage / 100, 2);
      bar += `<rect x="${bx}" y="${barY}" width="${w}" height="6" rx="0" fill="${l.color}" opacity="0.85"/>`;
      bx += w;
    });

    // Legend: 2 rows of 5 items each, matching aura-4 style with glowing dots
    let legend = '';
    const itemsPerRow = 5;
    const rowH = 30;
    const legendY1 = barY + 22;
    const colWidth = 150;
    ll.forEach((l, i) => {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const lx = barX + col * colWidth;
      const ly = legendY1 + row * rowH;

      // Glow dot
      legend += `<circle cx="${lx+5}" cy="${ly+5}" r="5" fill="${l.color}" opacity="0.8"/>`;
      // Language name
      legend += `<text x="${lx+16}" y="${ly+9}" font-family="${font}" font-size="12" font-weight="500" fill="#e0e0f0">${l.name}</text>`;
      // Percentage
      const nameW = l.name.length * 7;
      legend += `<text x="${lx+16+nameW+4}" y="${ly+9}" font-family="${font}" font-size="10" fill="#6a6a8a">${l.percentage}%</text>`;
    });

    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(110,80,220,0.12)" stroke-width="0.5"/>
      <ellipse class="g-dr" cx="650" cy="${baseY+90}" rx="180" ry="100" fill="url(#g5)"/>
      <ellipse class="g-dl" cx="150" cy="${baseY+100}" rx="160" ry="90" fill="url(#g2)" style="opacity:0.3"/>
      <text x="${barX}" y="${baseY+22}" font-family="${font}" font-size="9" fill="rgba(120,200,255,0.7)" letter-spacing="3" font-weight="600">MOST USED LANGUAGES</text>
      ${bar}
      ${legend}
    </g>`;
  })();
  y += langH + gap;

  // ═══════════════ CONTRIBUTION CALENDAR ═══════════════
  const calendar = (() => {
    const baseY = y;
    const weeks = data.calendar.weeks;
    const total = data.calendar.totalContributions;
    const cellSize = 11;
    const cgap = 2;
    const step = cellSize + cgap;
    const gridX = 44;
    const gridY = baseY + 42;
    const colors = ['rgba(30,30,50,0.6)', 'rgba(45,74,110,0.8)', 'rgba(74,126,200,0.85)', 'rgba(126,231,255,0.9)', 'rgba(184,240,255,0.95)'];
    function getLevel(c) { return c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4; }
    let cells = '';
    for (let w = 0; w < weeks.length; w++) {
      for (const d of weeks[w].contributionDays) {
        const lv = getLevel(d.contributionCount);
        const cx = gridX + w * step;
        const cy = gridY + d.weekday * step;
        const stroke = lv > 2 ? colors[lv].replace(/[\d.]+\)$/, '0.4)') : 'rgba(60,60,100,0.12)';
        cells += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors[lv]}" stroke="${stroke}" stroke-width="${lv > 2 ? 0.8 : 0.4}"/>`;
      }
    }
    // Month labels
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let mLabels = '';
    let lastM = -1;
    for (let w = 0; w < weeks.length; w++) {
      const fd = weeks[w].contributionDays[0];
      if (!fd) continue;
      const m = new Date(fd.date).getMonth();
      if (m !== lastM) { lastM = m; mLabels += `<text x="${gridX + w*step}" y="${gridY-6}" font-family="${font}" font-size="8" fill="#4a4a6a">${months[m]}</text>`; }
    }
    // Day labels
    const dayL = ['','M','','W','','F',''];
    let dLabels = '';
    dayL.forEach((d, i) => { if (d) dLabels += `<text x="${gridX-8}" y="${gridY + i*step + cellSize - 2}" text-anchor="end" font-family="${font}" font-size="7" fill="#4a4a6a">${d}</text>`; });
    // Legend
    const lgX = gridX + weeks.length * step - 100;
    const lgY = gridY + 7 * step + 10;
    let lg = `<text x="${lgX}" y="${lgY+8}" font-family="${font}" font-size="8" fill="#4a4a6a">Less</text>`;
    for (let i = 0; i < 5; i++) lg += `<rect x="${lgX+24+i*14}" y="${lgY}" width="10" height="10" rx="2" fill="${colors[i]}"/>`;
    lg += `<text x="${lgX+96}" y="${lgY+8}" font-family="${font}" font-size="8" fill="#4a4a6a">More</text>`;
    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(110,80,220,0.12)" stroke-width="0.5"/>
      <ellipse class="g-dl" cx="400" cy="${baseY+100}" rx="300" ry="90" fill="url(#g5)"/>
      <rect class="g-scan" x="0" y="${baseY+100}" width="160" height="1" fill="url(#scg)" style="animation-delay:3s"/>
      <text x="28" y="${baseY+18}" font-family="${font}" font-size="9" fill="rgba(120,200,255,0.7)" letter-spacing="3" font-weight="600">CONTRIBUTION MATRIX</text>
      <text x="220" y="${baseY+18}" font-family="${font}" font-size="10" fill="#4a4a6a">— ${total} contributions in the last year</text>
      ${mLabels}
      ${dLabels}
      ${cells}
      ${lg}
    </g>`;
  })();
  y += calH + gap;

  // ═══════════════ TOP PROJECTS (aura-component-5 style) ═══════════════
  const projects = (() => {
    const baseY = y;
    const projs = data.topProjects;
    const cardW = 240;
    const cardH = 150;
    const startX = (W - cardW * 3 - 24) / 2;
    const cardColors = ['rgba(120,200,255,0.12)', 'rgba(200,120,255,0.12)', 'rgba(255,120,200,0.12)'];
    const textColors = ['#7ee7ff', '#e8c8ff', '#ff88cc'];
    let cards = '';

    projs.forEach((p, i) => {
      const cx = startX + i * (cardW + 12);
      const cy = baseY + 20;
      const borderColor = cardColors[i % 3];
      const accent = textColors[i % 3];

      // Card background
      cards += `<rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="14" fill="rgba(10,8,18,0.7)" stroke="${borderColor}" stroke-width="1"/>`;

      // Repo name
      cards += `<text x="${cx+18}" y="${cy+28}" font-family="${font}" font-size="14" font-weight="800" fill="#ffffff">${p.name}</text>`;

      // Description (wrap to 2 lines)
      const desc = (p.desc || '').substring(0, 80);
      const words = desc.split(' ');
      let line1 = '', line2 = '';
      for (const w of words) {
        if (line1.length + w.length < 30) line1 += (line1 ? ' ' : '') + w;
        else line2 += (line2 ? ' ' : '') + w;
      }
      line2 = line2.substring(0, 35);
      cards += `<text x="${cx+18}" y="${cy+48}" font-family="${font}" font-size="10" fill="rgba(200,200,230,0.75)">${line1}</text>`;
      if (line2) cards += `<text x="${cx+18}" y="${cy+62}" font-family="${font}" font-size="10" fill="rgba(200,200,230,0.75)">${line2}</text>`;

      // Stats row: stars + forks
      const statsY = cy + cardH - 50;
      cards += `<text x="${cx+18}" y="${statsY}" font-family="${font}" font-size="10" fill="#6a6a8a">★ ${p.stars}  ⑂ ${p.forks}</text>`;

      // Language tag pill
      if (p.lang) {
        const tagW = p.lang.length * 7 + 20;
        cards += `<rect x="${cx+18}" y="${cy+cardH-36}" width="${tagW}" height="22" rx="11" fill="rgba(${accent === '#7ee7ff' ? '126,231,255' : accent === '#e8c8ff' ? '232,200,255' : '255,136,204'},0.08)" stroke="rgba(${accent === '#7ee7ff' ? '126,231,255' : accent === '#e8c8ff' ? '232,200,255' : '255,136,204'},0.15)" stroke-width="0.5"/>`;
        cards += `<text x="${cx+18+tagW/2}" y="${cy+cardH-21}" text-anchor="middle" font-family="${font}" font-size="10" font-weight="600" fill="${accent}">${p.lang}</text>`;
      }
    });

    return `
    <g>
      <line x1="28" y1="${baseY}" x2="772" y2="${baseY}" stroke="rgba(110,80,220,0.12)" stroke-width="0.5"/>
      <ellipse class="g-du" cx="400" cy="${baseY+100}" rx="250" ry="80" fill="url(#g3)"/>
      <ellipse class="g-p" cx="180" cy="${baseY+90}" rx="170" ry="100" fill="url(#g1)" style="opacity:0.4"/>
      <ellipse class="g-dl" cx="620" cy="${baseY+110}" rx="150" ry="90" fill="url(#g2)" style="opacity:0.3"/>
      <text x="28" y="${baseY+12}" font-family="${font}" font-size="9" fill="rgba(120,200,255,0.7)" letter-spacing="3" font-weight="600">TOP PROJECTS</text>
      ${cards}
    </g>`;
  })();
  y += projH;

  // ═══════════════ FOOTER ═══════════════
  const footer = `<text x="400" y="${y+20}" text-anchor="middle" font-family="${font}" font-size="8" fill="rgba(80,80,120,0.4)">github.com/acedmicabhishek</text>`;

  return `<!-- ACE Profile | Generated ${new Date().toISOString()} -->
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
<style>${style}</style>
<defs>${defs}</defs>
<rect width="${W}" height="${totalH}" rx="20" fill="#06060a" stroke="rgba(110,80,220,0.15)" stroke-width="1"/>
${hero}
${techStack}
${statsBlock}
${langs}
${calendar}
${projects}
${footer}
</svg>`;
}

// Mock data for local testing
function mockData() {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() - (52 - w) * 7 * 86400000 + d * 86400000);
      days.push({ contributionCount: Math.floor(Math.random() * 8), date: date.toISOString().split('T')[0], weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return {
    stats: { totalStars: 12, totalForks: 5, totalRepos: 24, totalCommits: 847 },
    languages: [
      { name: 'C++', color: '#f34b7d', percentage: 35 },
      { name: 'C', color: '#555555', percentage: 14 },
      { name: 'Python', color: '#3572A5', percentage: 11 },
      { name: 'CSS', color: '#663399', percentage: 11 },
      { name: 'GLSL', color: '#5686a5', percentage: 5 },
      { name: 'Shell', color: '#89e051', percentage: 5 },
      { name: 'Assembly', color: '#6E4C13', percentage: 5 },
      { name: 'TypeScript', color: '#3178c6', percentage: 3 },
      { name: 'HTML', color: '#e34c26', percentage: 3 },
      { name: 'JavaScript', color: '#f1e05a', percentage: 3 },
    ],
    topProjects: [
      { name: 'BrainDance OS', desc: 'Custom x86 operating system with memory management and multitasking', stars: 8, forks: 2, lang: 'C', langColor: '#555555' },
      { name: 'CAT', desc: 'LLVM-based compiler architecture toolkit for ARM/RISC-V backends', stars: 4, forks: 1, lang: 'C++', langColor: '#f34b7d' },
      { name: 'Calcium 3D', desc: 'Real-time software renderer with vertex pipeline and rasterization', stars: 3, forks: 0, lang: 'C++', langColor: '#f34b7d' },
    ],
    calendar: { totalContributions: 847, weeks },
  };
}

// Main
const username = process.env.GITHUB_USER || 'acedmicabhishek';
const token = process.env.GITHUB_TOKEN;

(async () => {
  let data;
  if (token) {
    console.log(`Fetching data for @${username}...`);
    const user = await fetchData(username, token);
    data = processData(user);
    console.log(`  Stars: ${data.stats.totalStars}, Forks: ${data.stats.totalForks}, Repos: ${data.stats.totalRepos}, Commits: ${data.stats.totalCommits}`);
    console.log(`  Languages: ${data.languages.map(l => l.name).join(', ')}`);
    console.log(`  Top Projects: ${data.topProjects.map(p => p.name).join(', ')}`);
    console.log(`  Contributions: ${data.calendar.totalContributions} in ${data.calendar.weeks.length} weeks`);
  } else {
    console.log('No GITHUB_TOKEN — using mock data for preview.');
    data = mockData();
  }

  const svg = generateSVG(data);

  const fs = await import('node:fs');
  const path = await import('node:path');
  const outDir = path.resolve(process.cwd(), '.github/assets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'profile.svg');
  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`  Generated: ${outPath} (${Math.round(svg.length/1024)}KB)`);
})();
