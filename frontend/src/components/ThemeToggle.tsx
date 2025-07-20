import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-16 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-zeta-500 focus:ring-offset-2 focus:ring-offset-background-light dark:focus:ring-offset-background-dark shadow-inner"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Toggle theme"
    >
      {/* Background track with gradient */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 dark:opacity-100 transition-opacity duration-300" />

      {/* Sliding toggle */}
      <span
        className={`${theme === 'dark' ? 'translate-x-9' : 'translate-x-1'
          } relative inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out`}
      >
        {/* Icon inside the toggle */}
        <span className="absolute inset-0 flex items-center justify-center">
          {theme === 'dark' ? (
            <FiMoon className="h-4 w-4 text-gray-700" />
          ) : (
            <FiSun className="h-4 w-4 text-yellow-500" />
          )}
        </span>
      </span>

      {/* Static icons on the track */}
      <span className="absolute left-2 top-1/2 -translate-y-1/2">
        <FiSun
          className={`h-4 w-4 transition-colors duration-300 ${theme === 'light' ? 'text-yellow-500' : 'text-gray-200'
            }`}
        />
      </span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2">
        <FiMoon
          className={`h-4 w-4 transition-colors duration-300 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-400'
            }`}
        />
      </span>
    </button>
  );
};

export default ThemeToggle;