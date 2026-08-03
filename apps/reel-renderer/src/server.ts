import express, { type Express } from 'express'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { put } from '@vercel/blob'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { z } from 'zod'

const segmentSchema = z.object({
  text: z.string(),
  audioUrl: z.string().url(),
  durationMs: z.number().positive(),
})

const renderRequestSchema = z.object({
  backgroundImageUrl: z.string().url(),
  segments: z.array(segmentSchema).min(1),
})

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function verifyAuth(authHeader: string | undefined): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret || !authHeader) return false
  return timingSafeEqualStrings(authHeader, `Bearer ${secret}`)
}

let bundleLocationPromise: Promise<string> | null = null

function getBundleLocation(): Promise<string> {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({ entryPoint: path.join(process.cwd(), 'src', 'index.ts') })
  }
  return bundleLocationPromise
}

export function createApp(): Express {
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  app.post('/render', async (req, res) => {
    if (!verifyAuth(req.headers.authorization)) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const parsed = renderRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() })
      return
    }

    const { backgroundImageUrl, segments } = parsed.data
    const inputProps = { backgroundImageUrl, segments }

    try {
      const serveUrl = await getBundleLocation()
      const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps })

      const outputPath = path.join(os.tmpdir(), `reel-${Date.now()}.mp4`)

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: { enableMultiProcessOnLinux: true },
      })

      const fileBuffer = await readFile(outputPath)
      const blob = await put(`reel-videos/${Date.now()}.mp4`, fileBuffer, {
        access: 'public',
        contentType: 'video/mp4',
      })

      await unlink(outputPath).catch(() => {})

      res.json({ videoUrl: blob.url })
    } catch (error) {
      res.status(500).json({ error: 'render_failed', message: (error as Error).message })
    }
  })

  return app
}

if (require.main === module) {
  const app = createApp()
  const port = process.env.PORT ?? 3001
  app.listen(port, () => {
    console.log(`reel-renderer listening on port ${port}`)
  })
}
