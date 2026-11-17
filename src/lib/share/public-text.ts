// A file under public/ as text, for the server pieces of the link preview (species, names and masks under public/data).
// On Node that is the disk. On Cloudflare Workers there is no disk: the same file is one of the Worker's static assets,
// read through the ASSETS binding (what a browser gets from /data/...), so the bytes are the same on both hosts.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { workersEnv } from './workers-runtime'

export async function readPublicText(rel: string): Promise<string> {
  const env = workersEnv()
  if (env?.ASSETS) {
    const res = await env.ASSETS.fetch(new URL(`/${rel}`, 'https://assets.internal'))
    if (!res.ok) throw new Error(`public/${rel}: ${res.status}`)
    return res.text()
  }
  return readFile(path.join(process.cwd(), 'public', rel), 'utf8')
}
