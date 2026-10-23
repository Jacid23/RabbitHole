import { useId } from "react";

export function ChocolateScene() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="world-scene chocolate-scene" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="An impossible chocolate factory with copper pipes, candy trees and a golden doorway above a winding chocolate river">
      <defs>
        <radialGradient id={`${id}sky`}><stop stopColor="#8a5386"/><stop offset="1" stopColor="#251b39"/></radialGradient>
        <linearGradient id={`${id}gold`}><stop stopColor="#8c5537"/><stop offset=".45" stopColor="#efd18b"/><stop offset="1" stopColor="#a96b47"/></linearGradient>
        <linearGradient id={`${id}door`} x2="0" y2="1"><stop stopColor="#ffe4a0"/><stop offset="1" stopColor="#c18346"/></linearGradient>
      </defs>
      <path fill={`url(#${id}sky)`} d="M0 0h800v600H0z"/>
      {[ [130,119],[205,61],[648,83],[717,197],[562,38] ].map(([x,y])=><path key={x} d={`m${x} ${y-7} 2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill="#efdca5"/>)}
      <path d="M0 411q140-142 301-20 110-159 273-22 133-82 226 12v219H0" fill="#46695f"/>
      <path d="M0 487q131-92 283-29 152-89 293-16 122-75 224-5v163H0" fill="#294c49"/>
      <path d="M454 401q-91 61 11 90t-36 109" stroke="#b58257" strokeWidth="101" fill="none"/>
      <path d="M454 401q-91 61 11 90t-36 109" stroke="#54312f" strokeWidth="85" fill="none"/>
      <path d="M450 422q-41 35 26 68" stroke="#d6a275" strokeWidth="3" opacity=".5" fill="none"/>
      <g stroke="#352b36" strokeWidth="3">
        <path d="M297 386V216h267v170z" fill="#946448"/>
        <path d="M277 221 431 140 584 221z" fill="#512f44"/>
        <path d="M323 223h215v163H323z" fill="#b58055"/>
        <path d="M232 391V280h81v111m224 0V263h80v128" fill="#7c5662"/>
        <path d="m217 282 54-73 55 73zm304-17 57-75 55 75z" fill="#e0b079"/>
        <path d="M382 393v-72a48 48 0 0 1 96 0v72" fill={`url(#${id}door)`}/>
        <path d="M430 285v108" stroke="#936042"/>
        <path d="M351 172V98h30v58m113 20V79h32v113" fill={`url(#${id}gold)`}/>
        <path d="M342 98h48V84h-48zm143-19h50V65h-50z" fill="#c69b69"/>
        <path d="M334 386V269q0-27-32-27h-46v-69h-35v85q0 20 24 20h42v108" fill={`url(#${id}gold)`}/>
        <path d="M522 387V316q0-21 28-21h81v-76h24v94q0 14-24 14h-82v60" fill={`url(#${id}gold)`}/>
      </g>
      {[350,493].map(x=><g key={x}><path d={`M${x} 238v28h24v-28a12 12 0 0 0-24 0`} fill="#f4d18a"/><path d={`M${x+12} 226v40m-12-14h24`} stroke="#65423e" strokeWidth="2"/></g>)}
      <circle cx="431" cy="201" r="21" fill="#392b3e" stroke="#edc780" strokeWidth="3"/><path d="m420 201 8 7 15-17" stroke="#edc780" strokeWidth="3" fill="none"/>
      <g fill="none" stroke="#cdb3ce" strokeWidth="14" opacity=".22" strokeLinecap="round"><path d="M366 66q-36-27-5-48"/><path d="M511 45q31-19 8-38"/></g>
      {[ [150,404],[689,418],[89,488] ].map(([x,y],i)=><g key={x}><path d={`M${x} ${y+76}v-81`} stroke="#cfac7c" strokeWidth="9"/><circle cx={x} cy={y} r={i===2?30:43} fill={i===1?'#9ac9ac':'#d789a6'} stroke="#f0c995" strokeWidth="3"/><path d={`M${x-20} ${y}q20-35 39 0t-39 0q-8-20 18-20`} fill="none" stroke="#f9d6b7" strokeWidth="6"/></g>)}
      <g transform="translate(583 498) rotate(-14)"><path d="M0 0h112v58H0z" fill="#e2bc70" stroke="#f9dda3" strokeWidth="2"/><path d="M8 8h96v42H8z" fill="none" stroke="#8e5e44" strokeDasharray="2 3"/><text x="56" y="26" textAnchor="middle" fontFamily="Georgia,serif" fontSize="12" fill="#59372f">ADMIT ONE</text><text x="56" y="42" textAnchor="middle" fontFamily="Georgia,serif" fontSize="9" letterSpacing="1" fill="#59372f">IMAGINATION</text></g>
    </svg>
  );
}
