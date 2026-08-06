'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MIN_WIDTH = 180;
const MIN_HEIGHT = 120;

function isEligibleImage(image) {
  if (!(image instanceof HTMLImageElement)) return false;
  if (!image.closest('main')) return false;
  if (image.closest('a, button, nav, footer, [data-no-lightbox], .global-image-lightbox')) {
    return false;
  }
  if (image.getAttribute('role') === 'presentation' || image.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  return Boolean(image.currentSrc || image.src);
}

function isLargeEnough(image) {
  const rect = image.getBoundingClientRect();
  return rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
}

export default function GlobalImageLightbox() {
  const pathname = usePathname();
  const [activeImage, setActiveImage] = useState(null);
  const closeRef = useRef(null);
  const disabled = pathname?.startsWith('/admin');

  useEffect(() => {
    if (disabled) return undefined;

    const markEligibleImages = () => {
      document.querySelectorAll('main img').forEach((image) => {
        image.classList.toggle('global-lightbox-eligible', isEligibleImage(image));
      });
    };

    const onDocumentClick = (event) => {
      const image = event.target instanceof Element ? event.target.closest('img') : null;
      if (!image || !isEligibleImage(image) || !isLargeEnough(image)) return;

      setActiveImage({
        src: image.currentSrc || image.src,
        alt: image.alt || 'Expanded image',
      });
    };

    markEligibleImages();
    const observer = new MutationObserver(markEligibleImages);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onDocumentClick);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onDocumentClick);
      document
        .querySelectorAll('.global-lightbox-eligible')
        .forEach((image) => image.classList.remove('global-lightbox-eligible'));
    };
  }, [disabled, pathname]);

  useEffect(() => {
    if (!activeImage) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveImage(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeImage]);

  if (disabled || !activeImage) return null;

  return (
    <div
      className="global-image-lightbox"
      role="presentation"
      onClick={() => setActiveImage(null)}
    >
      <button
        ref={closeRef}
        type="button"
        className="global-image-lightbox-close"
        onClick={() => setActiveImage(null)}
        aria-label="Close expanded image"
      >
        <i className="fa-solid fa-xmark" />
      </button>

      <div
        className="global-image-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={activeImage.alt}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={activeImage.src}
          alt={activeImage.alt}
          onClick={() => setActiveImage(null)}
          title="Click the image again to close"
        />
        <p>Click the image or outside area to close</p>
      </div>
    </div>
  );
}
