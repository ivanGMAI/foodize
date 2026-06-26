import { Moon, Sun } from '@phosphor-icons/react';
import { useThemeStore } from '../../store/useThemeStore';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={
        theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'
      }
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {theme === 'light' ? (
        <Moon size={20} weight="fill" color="var(--text-3)" />
      ) : (
        <Sun size={20} weight="bold" color="var(--amber)" />
      )}
    </button>
  );
};

export default ThemeToggle;
