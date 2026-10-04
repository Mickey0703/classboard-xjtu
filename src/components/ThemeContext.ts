import { createContext } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
export const ThemeContext = createContext<Theme>('light');
