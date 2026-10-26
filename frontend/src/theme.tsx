import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from './i18n';

const KEY = 'workday-theme-v1';
type Theme = 'light' | 'dark';

function apply(theme: Theme) {
 document.documentElement.dataset.theme = theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1411' : '#046638');
}

// Called before the first render so the page never flashes in the wrong theme.
export function initTheme() {
 let saved: string | null = null;
 try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
 apply(saved === 'dark' || saved === 'light' ? saved : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function ThemeToggle() {
 const { t } = useLanguage();
 const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
 const next: Theme = theme === 'dark' ? 'light' : 'dark';
 return <button className="language-btn" aria-label={t(next === 'dark' ? 'Night mode' : 'Day mode')} title={t(next === 'dark' ? 'Night mode' : 'Day mode')}
  onClick={() => { apply(next); setTheme(next); try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ } }}>
  {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
 </button>;
}
