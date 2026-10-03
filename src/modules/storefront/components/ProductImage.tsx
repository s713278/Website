import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type ProductImageProps = {
  src?: string
  alt?: string
  className?: string
  imgClassName?: string
}
export function ProductImage({ src, alt = '', className, imgClassName }: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const photo = src?.trim()

  useEffect(() => {
    setFailed(false)
  }, [photo])

  return (
    <div className={cn('overflow-hidden bg-[#f3f4f6]', className)}>
      {photo && !failed ? (
        <img
          src={photo}
          alt={alt}
          className={cn('size-full object-cover', imgClassName)}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <ProductImageFallback />
      )}
    </div>
  )
}

function ProductImageFallback() {
  return (
    <div className="flex size-full items-center justify-center bg-[#f6f3ec]" aria-hidden>
      <svg viewBox="0 0 128 104" className="h-[62%] w-auto max-h-28 min-h-7">
        <ellipse cx="64" cy="90" rx="30" ry="5" fill="#e8e2d6" />
        <rect x="28" y="22" width="62" height="46" rx="7" fill="none" stroke="#8d9488" strokeWidth="3.6" />
        <circle cx="44" cy="36" r="3.6" fill="#8d9488" />
        <path d="M36 60l12-16 8 10 12-16 16 22H36z" fill="#a7aea2" />
        <circle cx="86" cy="62" r="14" fill="#f6f3ec" />
        <circle cx="86" cy="62" r="10.5" fill="none" stroke="#6e756b" strokeWidth="3.4" />
        <path d="M79 69l14-14" stroke="#6e756b" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </div>
  )
}
