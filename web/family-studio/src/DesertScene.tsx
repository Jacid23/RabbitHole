import { useId } from "react";

export function DesertScene() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="world-scene desert-scene" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A red convertible follows a desert highway toward a crooked neon sign beneath a blazing sunset">
      <defs>
        <linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor="#183e46"/><stop offset=".6" stopColor="#e26d35"/><stop offset="1" stopColor="#f5c36b"/></linearGradient>
        <linearGradient id={`${id}sun`} x2="0" y2="1"><stop stopColor="#ffef8b"/><stop offset="1" stopColor="#fa873c"/></linearGradient>
        <pattern id={`${id}grain`} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#fff4c6" opacity=".12"/></pattern>
      </defs>
      <path fill={`url(#${id}sky)`} d="M0 0h800v600H0z"/>
      <circle cx="523" cy="234" r="137" fill={`url(#${id}sun)`}/>
      {[184,203,225,251,282].map((y,i)=><path key={y} d={`M380 ${y}h286`} stroke="#c46f41" strokeWidth={i+3} opacity=".7"/>)}
      <path d="M0 357 83 312 152 334 212 294 305 343 391 315 471 359 589 308 653 345 746 312 800 339V600H0" fill="#99563c"/>
      <path d="m0 399 107-38 147 42 174-27 140 31 232-43v236H0" fill="#503d32"/>
      <path d="m418 371-29 54-211 175h477L466 420l-31-49" fill="#202c2a"/>
      <path d="m428 387-2 29m-3 22-6 37m-8 35-17 80" fill="none" stroke="#edcd79" strokeWidth="7"/>
      <g transform="rotate(-9 648 263)"><path d="M647 263v167" stroke="#283d38" strokeWidth="12"/><path d="m549 179 100-28 104 28-14 107-92 28-99-37z" fill="#213e42" stroke="#f4ca62" strokeWidth="5"/><path d="m559 190 89-26 93 25-12 88-82 25-88-35z" fill="none" stroke="#e87644" strokeWidth="2" strokeDasharray="3 7"/><text x="648" y="220" textAnchor="middle" fill="#f9e393" fontSize="19" fontFamily="monospace" letterSpacing="4">NO MAP</text><text x="648" y="251" textAnchor="middle" fill="#f8a26c" fontSize="30" fontWeight="900" fontFamily="sans-serif">NEEDED</text><path d="m602 276h89l-12-8m12 8-12 8" stroke="#f9e393" strokeWidth="3" fill="none"/></g>
      <g transform="translate(265 462) rotate(-8)"><path d="m0 30 21-38h123l30 38 17 10v38H-12V42z" fill="#c83d36" stroke="#1c302d" strokeWidth="5"/><path d="m31 0-10 27h133L135 0z" fill="#8ab4a0" stroke="#263d38" strokeWidth="5"/><path d="M0 40h174M75 31v28" stroke="#852e2c" strokeWidth="3"/><path d="M5 67h162" stroke="#f7e1a3" strokeWidth="8"/><circle cx="24" cy="78" r="17" fill="#1b2a29"/><circle cx="148" cy="78" r="17" fill="#1b2a29"/><path d="M-31 100q103 5 213-5" stroke="#b0925b" strokeWidth="3" opacity=".6"/></g>
      <path d="M102 454v-84m0 40H77v-31m25 17h23v-38" stroke="#293e34" strokeWidth="13" strokeLinecap="round" fill="none"/>
      {[ [312,107],[359,134],[279,155] ].map(([x,y])=><path key={x} d={`m${x-17} ${y}q10-13 17 0 9-13 19-1l-19 8z`} fill="#223a3c"/>)}
      <path fill={`url(#${id}grain)`} d="M0 0h800v600H0z"/>
      <text x="505" y="564" fill="#efdba4" fontSize="11" letterSpacing="5" fontFamily="monospace">SOMEWHERE OUT THERE</text>
    </svg>
  );
}
