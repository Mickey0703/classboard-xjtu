import { useId } from 'react';

/** Render the original two-colour emblem using the surrounding text colour. */
export default function ClassEmblem() {
  const filterId = `emblem-${useId().replace(/:/g, '')}`;
  return <svg className="class-emblem" viewBox="1190 369 2965 2847" role="img" aria-label="ID 2601 班徽" focusable="false">
    <defs>
      <filter id={filterId} colorInterpolationFilters="sRGB">
        {/* Original navy has red=8; white has red=255. Preserve antialiased edges. */}
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.032388664 0 0 0 -0.032388664" result="emblem-alpha"/>
        <feFlood floodColor="currentColor" result="emblem-colour"/>
        <feComposite in="emblem-colour" in2="emblem-alpha" operator="in"/>
      </filter>
    </defs>
    <image href="/class-emblem.png" width="5387" height="3591" filter={`url(#${filterId})`}/>
  </svg>;
}
