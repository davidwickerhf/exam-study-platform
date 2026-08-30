type BrandMarkProps = {
  className?: string
}

export function BrandMark({ className = 'brand-mark' }: BrandMarkProps) {
  return (
    <img
      className={className}
      src="/brand-mark.svg"
      width="64"
      height="64"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  )
}
