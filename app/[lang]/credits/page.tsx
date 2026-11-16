import { redirect } from 'next/navigation'

/** Old address: The credits are on About. */
// Only the layout's four languages exist: any other first segment (/nope) is the static 404, never a render.
export const dynamicParams = false

export default function Page() {
  redirect('/about#credits')
}
