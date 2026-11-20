import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import type { CampusPhotoItem } from '../domain/campusPhotos';

export function CampusPhoto({ picture }: { picture: CampusPhotoItem }) {
  const photo = useRef<HTMLImageElement>(null);
  const frame = useRef(0);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      photo.current?.style.setProperty('--photo-x', `${(x * 18).toFixed(2)}px`);
      photo.current?.style.setProperty('--photo-y', `${(y * 14).toFixed(2)}px`);
    });
  }

  function resetPosition() {
    window.cancelAnimationFrame(frame.current);
    photo.current?.style.removeProperty('--photo-x');
    photo.current?.style.removeProperty('--photo-y');
  }

  const position = { '--photo-position': picture.position, '--photo-position-mobile': picture.mobilePosition ?? picture.position } as CSSProperties;
  return <div className="campus-photo" style={position} onPointerMove={followPointer} onPointerLeave={resetPosition}>
    <img ref={photo} src={picture.src} fetchPriority="high" alt={picture.alt}/>
  </div>;
}
