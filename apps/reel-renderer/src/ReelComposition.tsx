import { AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Sora'

const { fontFamily } = loadFont()

export type ReelSegment = {
  text: string
  audioUrl: string
  durationMs: number
}

export type ReelCompositionProps = {
  backgroundImageUrl: string
  segments: ReelSegment[]
}

export const FPS = 30

function msToFrames(ms: number): number {
  return Math.round((ms / 1000) * FPS)
}

export function totalDurationInFrames(segments: ReelSegment[]): number {
  return segments.reduce((sum, segment) => sum + msToFrames(segment.durationMs), 0)
}

function KenBurnsBackground({ imageUrl }: { imageUrl: string }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0B0B0D' }}>
      <Img
        src={imageUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      <AbsoluteFill style={{ backgroundColor: 'rgba(11, 11, 13, 0.35)' }} />
    </AbsoluteFill>
  )
}

export function ReelComposition({ backgroundImageUrl, segments }: ReelCompositionProps) {
  let startFrame = 0
  const sequences = segments.map((segment, index) => {
    const durationInFrames = msToFrames(segment.durationMs)
    const element = (
      <Sequence key={index} from={startFrame} durationInFrames={durationInFrames}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <Audio src={segment.audioUrl} />
          <div
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 56,
              color: '#F5F5F5',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {segment.text}
          </div>
          <div
            style={{
              width: 120,
              height: 3,
              backgroundColor: '#D4AF37',
              marginTop: 24,
            }}
          />
        </AbsoluteFill>
      </Sequence>
    )
    startFrame += durationInFrames
    return element
  })

  return (
    <AbsoluteFill>
      <KenBurnsBackground imageUrl={backgroundImageUrl} />
      {sequences}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          right: 60,
          fontFamily,
          fontWeight: 600,
          fontSize: 24,
          color: '#B8BDC7',
          opacity: 0.6,
          letterSpacing: 2,
        }}
      >
        FAYDALAB
      </div>
    </AbsoluteFill>
  )
}
