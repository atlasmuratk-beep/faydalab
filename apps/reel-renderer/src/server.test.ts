import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'http'

const { mockBundle, mockSelectComposition, mockRenderMedia, mockPut, mockReadFile } = vi.hoisted(() => ({
  mockBundle: vi.fn(),
  mockSelectComposition: vi.fn(),
  mockRenderMedia: vi.fn(),
  mockPut: vi.fn(),
  mockReadFile: vi.fn(),
}))

vi.mock('@remotion/bundler', () => ({ bundle: mockBundle }))
vi.mock('@remotion/renderer', () => ({
  selectComposition: mockSelectComposition,
  renderMedia: mockRenderMedia,
}))
vi.mock('@vercel/blob', () => ({ put: mockPut }))
vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import { createApp } from './server'

function jsonRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const payload = JSON.stringify(body)
      const req = request.request(
        { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            server.close()
            resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null })
          })
        }
      )
      req.on('error', reject)
      req.write(payload)
      req.end()
    })
  })
}

describe('POST /render', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = 'test-secret'
    mockBundle.mockReset().mockResolvedValue('/tmp/bundle')
    mockSelectComposition.mockReset().mockResolvedValue({ id: 'Reel' })
    mockRenderMedia.mockReset().mockResolvedValue(undefined)
    mockReadFile.mockReset().mockResolvedValue(Buffer.from('fake-mp4-bytes'))
    mockPut.mockReset().mockResolvedValue({ url: 'https://blob.vercel-storage.com/fake.mp4' })
  })

  it('yetkisiz istekte 401 döner', async () => {
    const app = createApp()
    const result = await jsonRequest(app, '/render', { backgroundImageUrl: 'https://x/img.png', segments: [] })
    expect(result.status).toBe(401)
  })

  it('geçersiz gövdede 400 döner', async () => {
    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      { backgroundImageUrl: 'not-a-url' },
      { authorization: 'Bearer test-secret' }
    )
    expect(result.status).toBe(400)
  })

  it('geçerli istekte video render edip Blob URL döner', async () => {
    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      {
        backgroundImageUrl: 'https://x/img.png',
        segments: [{ text: 'merhaba', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
      },
      { authorization: 'Bearer test-secret' }
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ videoUrl: 'https://blob.vercel-storage.com/fake.mp4' })
    expect(mockRenderMedia).toHaveBeenCalled()
    expect(mockPut).toHaveBeenCalled()
  })

  it('render başarısız olursa 500 döner', async () => {
    mockRenderMedia.mockRejectedValue(new Error('render patladı'))

    const app = createApp()
    const result = await jsonRequest(
      app,
      '/render',
      {
        backgroundImageUrl: 'https://x/img.png',
        segments: [{ text: 'merhaba', audioUrl: 'https://x/a.wav', durationMs: 1000 }],
      },
      { authorization: 'Bearer test-secret' }
    )

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('render_failed')
  })
})
