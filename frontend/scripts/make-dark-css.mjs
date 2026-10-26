// Generates src/dark.css (night mode) from src/styles.css.
// Run after changing colors in styles.css:  node scripts/make-dark-css.mjs
//
// styles.css hard-codes its colors, so instead of hand-maintaining a second palette this
// re-maps each color by the property it sits in: light surfaces become dark surfaces, dark
// text becomes light text, light borders become dim borders. Brand colors (the green
// sidebar and buttons, gold) and light text that already sits on them are kept.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const src = fileURLToPath(new URL('../src/styles.css', import.meta.url));
const out = fileURLToPath(new URL('../src/dark.css', import.meta.url));
const SCOPE = ':root[data-theme=dark]';
const COLOR_PROP = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline|box-shadow|accent-color|fill|stroke|--.*)$/;

const hex = s => { s = s.replace('#', ''); if (s.length === 3) s = [...s].map(c => c + c).join('');
  return { r: parseInt(s.slice(0, 2), 16) / 255, g: parseInt(s.slice(2, 4), 16) / 255, b: parseInt(s.slice(4, 6), 16) / 255, a: s.slice(6) }; };
function toHsl({ r, g, b }) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
function toHex({ h, s, l }, a = '') {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('') + a;
}

// Returns the night-mode replacement for one color in one property, or null to keep it.
function remap(prop, color) {
  const raw = color === 'white' ? '#ffffff' : color;
  const rgb = hex(raw);
  if (rgb.a) return null;                                      // translucent overlays and shadows keep their tint
  let { h, s, l } = toHsl(rgb);
  const chroma = s * (1 - Math.abs(2 * l - 1));
  // Greys (including the old palette's faintly blue greys) lean toward the brand green.
  if (s < 0.2 || (chroma < 0.2 && h >= 185 && h <= 235)) { h = 150; s = 0.1; }
  if (prop === 'color' || prop === '--muted') {
    if (color === 'white' || l >= 0.62) return null;           // light text sits on dark brand surfaces
    return toHex({ h, s: Math.min(s, 0.35), l: Math.min(0.92, 1 - l * 0.55) }, rgb.a);
  }
  if (prop.startsWith('border') || prop === 'outline' || prop === '--border') {
    if (l < 0.75) return null;
    return toHex({ h, s: s * 0.4, l: 0.2 + (1 - l) * 0.6 }, rgb.a);
  }
  if (prop === 'background' || prop === 'background-color') {
    if (l < 0.8) return null;                                  // brand green, gold, toasts stay
    return toHex({ h, s: s * 0.45, l: 0.115 + (1 - l) * 0.9 }, rgb.a);
  }
  return null;                                                 // shadows, accent-color, brand vars
}

const css = postcss.parse(readFileSync(src, 'utf8'));
const dark = postcss.root();
css.walkRules(rule => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule' && /print/.test(p.params)) return;  // printed pages stay light
  // Every scoped rule outranks every unscoped one, so colors that stay the same (e.g. the
  // green .btn.primary) are copied too; otherwise a remapped generic rule (.btn) would win.
  const decls = [];
  let changed = false;
  rule.walkDecls(decl => {
    if (!COLOR_PROP.test(decl.prop)) return;
    const value = decl.value.replace(/#[0-9a-fA-F]{3,8}\b|\bwhite\b/g, color => {
      const next = remap(decl.prop, color);
      if (next) { changed = true; return next; }
      return color;
    });
    decls.push(decl.clone({ value }));
  });
  if (!changed && !decls.some(d => /var\(--|#|\bwhite\b/.test(d.value))) return;
  if (!decls.length) return;
  const selector = rule.selectors.map(sel => sel.startsWith(':root') ? sel.replace(':root', SCOPE)
    : sel.startsWith('html') ? sel.replace('html', 'html[data-theme=dark]') : `${SCOPE} ${sel}`).join(',');
  let node = postcss.rule({ selector, nodes: decls });
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule') node = p.clone({ nodes: [] }).append(node);
  dark.append(node);
});

const manual = `
/* Hand-tuned on top of the generated rules. */
${SCOPE}{color-scheme:dark;background:#0d1411}
${SCOPE} body{background:#0d1411}
${SCOPE} .recharts-cartesian-grid line{stroke:#25322c}
${SCOPE} .recharts-text,${SCOPE} .recharts-cartesian-axis-tick-value{fill:#9db1a6}
${SCOPE} .recharts-default-tooltip{background:#16211c!important;border-color:#2a3a33!important}
${SCOPE} .recharts-rectangle.recharts-tooltip-cursor{fill:#ffffff08}
${SCOPE} input::placeholder,${SCOPE} textarea::placeholder{color:#6f8478}
`;
writeFileSync(out, `/* GENERATED by scripts/make-dark-css.mjs from styles.css - do not edit by hand. */\n${dark.toString()}\n${manual}`);
console.log(`dark.css: ${dark.nodes.length} rules`);
