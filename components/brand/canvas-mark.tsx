type CanvasMarkProps = {
  className?: string;
};

/**
 * Canvas LMS logomark, adapted to `currentColor` for compact integration UI.
 * Source: Instructure's open Canvas LMS asset
 * https://github.com/instructure/canvas-lms/blob/master/public/images/svg-icons/svg_canvas_logomark_only.svg
 */
export function CanvasMark({ className }: CanvasMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="currentColor"
      role="img"
      aria-label="Canvas"
    >
      <path d="M29.2 100c0-14.9-11.2-26.9-25.5-28.4C1.5 80.6 0 89.6 0 100s1.5 19.4 3.7 28.4C18 126.9 29.2 114.2 29.2 100Zm17.2-9.7a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM170.8 100c0 14.9 11.2 26.9 25.5 28.4 2.2-9 3.7-18.7 3.7-28.4s-1.5-19.4-3.7-28.4C182 73.1 170.8 85.1 170.8 100Zm-19.5-9.7a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-51.7 80.6c-15 0-27 11.2-28.5 25.4 9 2.2 18.7 3.7 28.5 3.7s19.5-1.5 28.5-3.7c-1.5-14.2-13.5-25.4-28.5-25.4Zm-.7-28.4a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm.7-113.4c15 0 27-11.2 28.5-25.4C119.1 1.5 109.4 0 99.6 0S80.1 1.5 71.2 3.7c1.5 14.2 13.4 25.4 28.4 25.4Zm-.7 9a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm50.9 111.9c-10.5 10.4-11.2 26.9-2.2 38.1 16.5-9.7 30.7-23.9 40.4-40.3-11.2-9-27.7-8.2-38.2 2.2Zm-13.5-22.4a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM49.4 50c10.5-10.4 11.2-26.9 2.2-38.1C35.2 21.6 21 35.8 11.2 52.2c11.3 9 27.8 8.2 38.2-2.2Zm12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm88.4-3c10.5 10.4 27 11.2 38.2 2.2-9.7-16.4-24-30.6-40.4-40.3-9 11.2-8.3 27.7 2.2 38.1Zm-13.5 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM49.4 150c-10.5-10.4-27-11.2-38.2-2.2 9.7 16.4 24 30.6 40.4 40.3 9.1-12 8.3-27.7-2.2-38.1Zm12-22.4a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
    </svg>
  );
}
