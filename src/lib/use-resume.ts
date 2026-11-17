// React glue for view-resume.ts: a component offers how to read its slice of the view for a language switch, and takes
// its slice back once, on its first mount after the switch (a layout effect, so the restored view paints at once).
import { useEffect, useLayoutEffect, useRef } from 'react'
import { offerResume, takeResume, type Resume, type Slice } from './view-resume'

/** Offers `read` as this slice's reader while mounted; `read` runs at the switch, so it sees the latest values. */
export function useOfferResume<K extends Slice>(slice: K, read: () => Resume[K] | undefined): void {
  const latest = useRef(read)
  useLayoutEffect(() => {
    latest.current = read
  })
  useEffect(() => offerResume(slice, () => latest.current()), [slice])
}

/** Applies the slice carried over the switch, once per page, on this component's first mount. */
export function useTakeResume<K extends Slice>(slice: K, apply: (v: Resume[K]) => void): void {
  useLayoutEffect(() => {
    const v = takeResume(slice)
    if (v) apply(v)
    // Once, on mount: the claim is per page, and `apply` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
