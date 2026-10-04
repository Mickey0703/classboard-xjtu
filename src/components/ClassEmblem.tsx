import { useContext, useId } from 'react';
import { ThemeContext } from './ThemeContext';

/** Explicit colours and fresh filter IDs avoid stale currentColor in WebKit. */
export default function ClassEmblem() {
  const theme = useContext(ThemeContext);
  const colour = theme === 'dark' ? '#ffffff' : '#08254d';
  const filterId = `emblem-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-${theme}`;
  return <svg key={theme} className="class-emblem" viewBox="1190 369 2965 2847" role="img" aria-label="ID 2601 班徽" focusable="false">
    <defs>
      <filter id={filterId} colorInterpolationFilters="sRGB">
        {/* Background R=8 is below the R=16 cutoff, leaving room for mobile
            resampling/filter rounding while keeping white and soft edges. */}
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.066945607 0 0 0 -0.066945607" result="emblem-alpha"/>
        <feFlood floodColor={colour} result="emblem-colour"/>
        <feComposite in="emblem-colour" in2="emblem-alpha" operator="in"/>
      </filter>
    </defs>
    <image href="/class-emblem.png" width="5387" height="3591" filter={`url(#${filterId})`}/>
  </svg>;
}
