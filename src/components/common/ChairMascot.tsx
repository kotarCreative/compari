import { useId } from 'react'

const artwork = '/illustrations/raccoon-chair.png'

// Soft displacement maps move only the paws and pencil. Keeping the artwork in
// one piece avoids cutout seams and preserves the illustrated chair's geometry.
function motionMap(shapes: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536"><defs><radialGradient id="forward"><stop stop-color="rgb(255,128,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient><radialGradient id="back"><stop stop-color="rgb(0,128,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient></defs><path fill="rgb(128,128,128)" d="M0 0h1024v1536H0z"/>${shapes}</svg>`,
  )}`
}

const feetMap = motionMap(
  '<ellipse cx="612" cy="969" rx="43" ry="54" fill="url(#forward)"/><ellipse cx="738" cy="952" rx="41" ry="50" fill="url(#back)"/>',
)
const pencilMap = motionMap(
  '<ellipse cx="589" cy="653" rx="52" ry="67" fill="url(#forward)"/>',
)

/** Illustrated raccoon with gentle, localized paw and pencil movements. */
export function ChairMascot() {
  const filterId = `mascot-motion-${useId().replaceAll(':', '')}`

  return (
    <div className="chair-mascot" aria-hidden="true">
      <svg
        className="chair-mascot-animated"
        viewBox="0 0 1024 1536"
        fill="none"
        focusable="false"
      >
        <defs>
          <filter
            id={filterId}
            x="0"
            y="0"
            width="1024"
            height="1536"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={feetMap}
              x="0"
              y="0"
              width="1024"
              height="1536"
              result="feet"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="feet"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
              result="swinging"
            >
              <animate
                attributeName="scale"
                values="-20;20;-20"
                dur="3.2s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;.5;1"
                keySplines=".42 0 .58 1;.42 0 .58 1"
              />
            </feDisplacementMap>
            <feImage
              href={pencilMap}
              x="0"
              y="0"
              width="1024"
              height="1536"
              result="pencil"
            />
            <feDisplacementMap
              in="swinging"
              in2="pencil"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            >
              <animate
                attributeName="scale"
                values="0;0;8;-8;8;-8;8;-8;0;0"
                keyTimes="0;.3;.34;.38;.42;.46;.5;.54;.58;1"
                dur="9s"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
        <image
          href={artwork}
          width="1024"
          height="1536"
          filter={`url(#${filterId})`}
        />
      </svg>
      <img
        className="chair-mascot-still"
        src={artwork}
        alt=""
        width="1024"
        height="1536"
      />
      <span className="chair-mascot-caption">taking little notes.</span>
    </div>
  )
}
