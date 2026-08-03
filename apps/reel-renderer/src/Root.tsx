import { Composition } from 'remotion'
import { ReelComposition, totalDurationInFrames, FPS, type ReelCompositionProps } from './ReelComposition'

const DEFAULT_PROPS: ReelCompositionProps = {
  backgroundImageUrl: '',
  segments: [],
}

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={ReelComposition}
      durationInFrames={90}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(totalDurationInFrames(props.segments), 1),
      })}
    />
  )
}
