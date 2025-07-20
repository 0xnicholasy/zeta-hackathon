import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';
import { Switch } from './ui/switch';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center space-x-3">
      <FiSun
        className={`h-4 w-4 transition-colors duration-300 ${theme === 'light' ? 'text-amber-500' : 'text-muted-foreground'
          }`}
      />
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={toggleTheme}
        className="data-[state=checked]:bg-zeta-500 data-[state=unchecked]:bg-muted"
        aria-label="Toggle theme"
      />
      <FiMoon
        className={`h-4 w-4 transition-colors duration-300 ${theme === 'dark' ? 'text-blue-400' : 'text-muted-foreground'
          }`}
      />
    </div>
  );
};

export default ThemeToggle;