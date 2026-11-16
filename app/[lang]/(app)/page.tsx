import { Home } from '@/components/app/Home'

// Only the layout's four languages exist: any other first segment (/nope) is the static 404, never a render.
export const dynamicParams = false

export default function Page() {
  return <Home />
}
