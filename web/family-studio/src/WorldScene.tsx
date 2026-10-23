import { useId } from "react";
import { DesertScene } from "./DesertScene";
import { ChocolateScene } from "./ChocolateScene";

export function WorldScene({ theme }: { theme: string }) {
  const id = useId().replace(/:/g, "");
  if (theme === "gonzo") return <DesertScene />;
  if (theme === "wonka") return <ChocolateScene />;
  if (theme === "mars")
    return (
      <svg
        className="world-scene"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="A glowing alien outpost above the red canyons of Mars"
      >
        <defs>
          <linearGradient id={`${id}s`} x2="0" y2="1">
            <stop stopColor="#071326" />
            <stop offset="1" stopColor="#602d42" />
          </linearGradient>
          <radialGradient id={`${id}p`}>
            <stop stopColor="#f5d7ae" />
            <stop offset="1" stopColor="#c86140" />
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill={`url(#${id}s)`} />
        {Array.from({ length: 55 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 137 + 23) % 800}
            cy={(i * 71 + 19) % 330}
            r={i % 4 ? 1 : 2}
            fill="#c9f6ef"
            opacity={0.35 + (i % 5) / 9}
          />
        ))}
        <circle cx="570" cy="153" r="109" fill={`url(#${id}p)`} />
        <path
          d="M435 196Q580 104 731 135"
          fill="none"
          stroke="#f9b894"
          strokeWidth="5"
          opacity=".6"
        />
        <path
          d="M0 390 145 260 300 414 480 340 800 430V600H0Z"
          fill="#733329"
        />
        <path
          d="M0 455 240 352 360 479 580 390 800 465V600H0Z"
          fill="#b15235"
        />
        <path d="m0 555 230-80 290 32 280-65v158H0" fill="#552a29" />
        <path
          d="m800 600-220-122-54 41-47-6 56-42 173-38"
          fill="none"
          stroke="#f2a774"
          strokeWidth="4"
        />
        <path
          d="M325 416a110 110 0 0 1 220 0Z"
          fill="#79e8d2"
          fillOpacity=".22"
          stroke="#8ef4d9"
          strokeWidth="2"
        />
        <path d="M435 306v110m-110 0h220" stroke="#8ef4d9" strokeWidth="2" />
        <rect x="370" y="371" width="127" height="52" rx="6" fill="#132c35" />
        <rect x="398" y="386" width="39" height="37" rx="19" fill="#b0fbd2" />
        <ellipse cx="418" cy="389" rx="13" ry="18" fill="#a6f4c0" />
        <ellipse
          cx="413"
          cy="386"
          rx="3"
          ry="6"
          fill="#112e2d"
          transform="rotate(-25 413 386)"
        />
        <ellipse
          cx="423"
          cy="386"
          rx="3"
          ry="6"
          fill="#112e2d"
          transform="rotate(25 423 386)"
        />
        <path
          d="M290 429v-95m-14 15 14-15 14 15"
          stroke="#9bf4da"
          strokeWidth="3"
        />
        <circle cx="290" cy="329" r="6" fill="#9bf4da" />
      </svg>
    );
  if (theme === "estate")
    return (
      <svg
        className="world-scene"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="A grand estate hall with velvet curtains, a chandelier and golden light"
      >
        <defs>
          <linearGradient id={`${id}h`} x2="0" y2="1">
            <stop stopColor="#1c1217" />
            <stop offset="1" stopColor="#75523a" />
          </linearGradient>
          <radialGradient id={`${id}g`}>
            <stop stopColor="#fff3b6" />
            <stop offset="1" stopColor="#a96f38" />
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill={`url(#${id}h)`} />
        <path
          d="M170 440V195a230 230 0 0 1 460 0v245"
          fill="#4c3029"
          stroke="#c69a5b"
          strokeWidth="9"
        />
        <path d="M255 440V220a145 145 0 0 1 290 0v220Z" fill={`url(#${id}g)`} />
        <path d="M400 75v360M255 260h290" stroke="#76502d" strokeWidth="10" />
        <path
          d="M0 0h240Q120 180 174 460H0Zm800 0H560q120 180 66 460h174Z"
          fill="#5b2634"
        />
        <path
          d="M20 0Q115 170 76 450M780 0Q685 170 724 450"
          fill="none"
          stroke="#966044"
          strokeWidth="17"
        />
        <path d="M0 490h800v110H0Z" fill="#9b7955" />
        <path
          d="M0 600 310 490m90 110V490m400 110L490 490M0 546h800"
          stroke="#392d29"
          strokeWidth="3"
        />
        <path d="M225 490h350l111 110H114Z" fill="#6c2636" />
        <path
          d="M240 500h320l91 100H149Z"
          fill="none"
          stroke="#ba8c55"
          strokeWidth="3"
        />
        <path
          d="M400 0v92m-90 26q90 90 180 0m-150 26v-37m120 37v-37m-60 70v-52"
          fill="none"
          stroke="#e8c078"
          strokeWidth="7"
        />
        {[310, 340, 400, 460, 490].map((x, i) => (
          <g key={x}>
            <path
              d={`M${x} ${i === 2 ? 169 : 121}v-28`}
              stroke="#fff2bc"
              strokeWidth="7"
            />
            <ellipse
              cx={x}
              cy={i === 2 ? 136 : 88}
              rx="5"
              ry="9"
              fill="#fff6b8"
            />
          </g>
        ))}
        <path
          d="M105 470v-86q0-23 30-23t30 23v86m-62-31h64"
          stroke="#c69858"
          strokeWidth="8"
          fill="#273e36"
        />
        <path
          d="M637 470v-86q0-23 30-23t30 23v86m-62-31h64"
          stroke="#c69858"
          strokeWidth="8"
          fill="#273e36"
        />
      </svg>
    );
  return (
    <svg
      className="world-scene"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A colorful cartoon world with smiling clouds, rolling hills and a crooked little house"
    >
      <rect width="800" height="600" fill="#a7dfea" />
      <circle
        cx="650"
        cy="115"
        r="57"
        fill="#ffdc66"
        stroke="#352646"
        strokeWidth="6"
      />
      <path
        d="M210 400a190 190 0 0 1 380 0"
        fill="none"
        stroke="#eb6da3"
        strokeWidth="35"
      />
      <path
        d="M210 400a190 190 0 0 1 380 0"
        fill="none"
        stroke="#f9d573"
        strokeWidth="17"
      />
      {[80, 460].map((x) => (
        <g key={x} transform={`translate(${x} 150)`}>
          <path
            d="M0 30a30 30 0 0 1 35-35 40 40 0 0 1 75 8 29 29 0 0 1 33 44H4Z"
            fill="#fff5e4"
            stroke="#352646"
            strokeWidth="5"
          />
          <path
            d="M52 28q15 20 30 0"
            fill="none"
            stroke="#352646"
            strokeWidth="4"
          />
          <circle cx="49" cy="17" r="3" />
          <circle cx="86" cy="17" r="3" />
        </g>
      ))}
      <path
        d="M0 440q170-250 360-12t440-45v217H0Z"
        fill="#94c879"
        stroke="#352646"
        strokeWidth="6"
      />
      <path
        d="M0 520q260-150 430-40t370-10v130H0Z"
        fill="#60ac99"
        stroke="#352646"
        strokeWidth="6"
      />
      <path
        d="m383 460 27-147 145 23-16 151Z"
        fill="#f7c76f"
        stroke="#352646"
        strokeWidth="7"
      />
      <path
        d="m383 330 101-100 104 122Z"
        fill="#e17fb5"
        stroke="#352646"
        strokeWidth="7"
      />
      <rect
        x="446"
        y="398"
        width="40"
        height="75"
        rx="20"
        fill="#7a64a6"
        stroke="#352646"
        strokeWidth="5"
      />
      <circle
        cx="487"
        cy="346"
        r="23"
        fill="#b9ecdf"
        stroke="#352646"
        strokeWidth="5"
      />
      <path d="m487 324v44m-22-22h44" stroke="#352646" strokeWidth="4" />
      <path
        d="M455 480q-120 30-40 120"
        fill="none"
        stroke="#ffdc80"
        strokeWidth="55"
      />
      {[105, 670].map((x) => (
        <g key={x}>
          <path d={`M${x} 540v-85`} stroke="#352646" strokeWidth="5" />
          <circle
            cx={x}
            cy="441"
            r="28"
            fill="#ed83bb"
            stroke="#352646"
            strokeWidth="5"
          />
          <circle cx={x} cy="441" r="10" fill="#ffe28c" />
        </g>
      ))}
    </svg>
  );
}
