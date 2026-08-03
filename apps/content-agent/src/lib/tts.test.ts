import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSpeechCreate, mockPut } = vi.hoisted(() => ({
  mockSpeechCreate: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    audio = { speech: { create: mockSpeechCreate } }
  },
}))

vi.mock('@vercel/blob', () => ({ put: mockPut }))

import { generateSpeech } from './tts'

// 1 saniyelik, 8000 Hz, mono, 16-bit sessiz bir WAV dosyası (senkron test verisi).
function makeSilentWavBuffer(durationSeconds: number): Buffer {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const dataSize = byteRate * durationSeconds

  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)
  // data kısmı zaten sıfırlarla (sessizlik) dolu — Buffer.alloc varsayılanı

  return buffer
}

describe('generateSpeech', () => {
  beforeEach(() => {
    mockSpeechCreate.mockReset()
    mockPut.mockReset()
    mockPut.mockResolvedValue({ url: 'https://blob.vercel-storage.com/fake.wav' })
  })

  it('WAV süresini doğru hesaplar ve Blob\'a yükler', async () => {
    const wavBuffer = makeSilentWavBuffer(2)
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength),
    })

    const result = await generateSpeech('Test cümlesi')

    expect(result.audioUrl).toBe('https://blob.vercel-storage.com/fake.wav')
    expect(result.durationMs).toBe(2000)
    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'tts-1', input: 'Test cümlesi', response_format: 'wav' })
    )
  })

  it('data chunk boyutu 0xFFFFFFFF (streaming placeholder) olduğunda gerçek buffer uzunluğuna göre süre hesaplar', async () => {
    const wavBuffer = makeSilentWavBuffer(2)
    // OpenAI'nin akışlı (streaming) yanıtını simüle et: data chunk'ın
    // beyan edilen boyutu, gerçek buffer boyutundan çok daha büyük bir
    // placeholder (0xFFFFFFFF) olarak yazılıyor.
    wavBuffer.writeUInt32LE(0xffffffff, 40)
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength),
    })

    const result = await generateSpeech('Test cümlesi')

    // Gerçek buffer 2 saniyelik ses içeriyor; placeholder'a rağmen doğru
    // süre (yaklaşık 89478485ms değil) hesaplanmalı.
    expect(result.durationMs).toBe(2000)
  })

  it('geçersiz WAV verisinde hata fırlatır', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: async () => Buffer.from('not a wav file').buffer,
    })

    await expect(generateSpeech('Test')).rejects.toThrow('Geçersiz WAV')
  })
})
