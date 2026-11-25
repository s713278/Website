/**
 * Layout and copy the product editor shares with its loading skeleton, so nothing moves when
 * the values arrive.
 */
export const EDITOR_BODY = 'grid gap-8 py-5'
export const EDITOR_TITLE = 'font-display text-[0.95rem] leading-6 font-semibold'
export const EDITOR_HINT = 'max-w-[60ch] text-[0.8125rem] leading-5 text-[var(--md-muted)]'

/**
 * The photo's box. The photo always shows whole inside it. A box with a photo is 4:3 below
 * desktop width; a desktop window is too short for that at full width, so there its height
 * follows the window's, leaving the description in view. With no photo the box is shorter.
 */
export const PHOTO_FRAME = 'w-full overflow-hidden rounded-2xl'
export const PHOTO_FILLED = 'aspect-[4/3] lg:aspect-auto lg:h-[clamp(14rem,34dvh,18rem)]'
export const PHOTO_EMPTY = 'h-48'

/** The line under the photo. With a photo in the frame, it also warns about the shop's crop. */
export function photoHint(framed: boolean): string {
  const trim = framed ? 'Your shop trims photo edges, so keep the product in the middle. ' : ''
  return `${trim}JPEG, PNG, WebP or GIF, up to 3\u00a0MB.`
}

export const DESCRIPTION_HINT = 'Say what makes yours worth buying: freshness, source, how it is packed.'
export const FEATURES_HINT =
  'Short facts, such as Brand: Nandini. Remove every feature to show the catalog features instead.'

/** The feature table's frame, and its columns: label, detail, remove. A phone stacks the first two. */
export const FEATURE_TABLE = 'overflow-hidden rounded-lg border border-[var(--md-border)] bg-white'
export const FEATURE_COLUMNS =
  'grid grid-cols-[minmax(0,1fr)_3rem] sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3rem]'
