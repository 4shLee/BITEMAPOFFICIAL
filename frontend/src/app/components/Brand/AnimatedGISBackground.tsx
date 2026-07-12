import type { CSSProperties } from 'react';
import { BITEMAP_BACKGROUND_SRC } from './brand';
import './AnimatedGISBackground.css';

type AnimatedGISBackgroundProps = {
  tintClassName?: string;
};

const particles = [
  ['7px', '12%', '82%', '17s', '-4s'],
  ['4px', '23%', '61%', '20s', '-13s'],
  ['6px', '36%', '88%', '21s', '-9s'],
  ['3px', '48%', '72%', '16s', '-15s'],
  ['5px', '61%', '91%', '20s', '-2s'],
  ['4px', '74%', '67%', '18s', '-11s'],
  ['6px', '85%', '84%', '22s', '-18s'],
  ['3px', '93%', '55%', '19s', '-7s'],
] as const;

const nodes = [
  [35, 350, '0s'], [145, 245, '-1.9s'], [270, 315, '-4.1s'], [390, 205, '-2.8s'], [520, 275, '-5.1s'],
  [930, 205, '-4.8s'], [1085, 125, '-0.9s'], [1215, 245, '-3.4s'], [1375, 155, '-2.2s'],
  [1000, 520, '-1.2s'], [1140, 430, '-4.4s'], [1305, 545, '-2.6s'],
] as const;

export function AnimatedGISBackground({
  tintClassName = 'bg-gradient-to-b from-white/8 via-teal-900/5 to-teal-950/16',
}: AnimatedGISBackgroundProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className="bitemap-background-motion pointer-events-none z-0"
        style={{ backgroundImage: `url('${BITEMAP_BACKGROUND_SRC}')` }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {particles.map(([size, left, top, duration, delay], index) => (
          <span
            key={index}
            className="bitemap-particle"
            style={{
              '--particle-size': size,
              '--particle-left': left,
              '--particle-top': top,
              '--particle-duration': duration,
              '--particle-delay': delay,
            } as CSSProperties}
          />
        ))}
      </div>

      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] h-full w-full opacity-35" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="rgba(204,251,241,0.42)" strokeWidth="1">
          <path d="M35 350 L145 245 L270 315 L390 205 L520 275" />
          <path d="M930 205 L1085 125 L1215 245 L1375 155" />
          <path d="M1000 520 L1140 430 L1305 545" />
        </g>
        {nodes.map(([cx, cy, delay], index) => (
          <circle
            key={index}
            className="bitemap-network-node"
            cx={cx}
            cy={cy}
            r="4"
            fill="rgba(240,253,250,0.76)"
            style={{ '--node-delay': delay } as CSSProperties}
          />
        ))}
      </svg>

      <div aria-hidden="true" className="bitemap-animated-wave pointer-events-none absolute inset-x-[-10%] bottom-[-6%] z-[1] h-[31%] opacity-50" />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[2] ${tintClassName}`} />
    </>
  );
}

