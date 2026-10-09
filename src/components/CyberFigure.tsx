// Figura EXO (ilustração do card "Missão do dia").
export function CyberFigure({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 420 480" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="steel" x1="60" y1="60" x2="330" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#f1f0e8"/><stop offset=".22" stopColor="#666c72"/><stop offset=".4" stopColor="#d6dce0"/><stop offset=".52" stopColor="#31353e"/><stop offset=".7" stopColor="#9a9da7"/><stop offset="1" stopColor="#16191e"/></linearGradient>
      <linearGradient id="darkSteel"><stop stopColor="#0a0b0e"/><stop offset=".5" stopColor="#6b6f79"/><stop offset="1" stopColor="#15171c"/></linearGradient>
      <radialGradient id="eye"><stop stopColor="white"/><stop offset=".25" stopColor="#86fffb"/><stop offset="1" stopColor="#09c8d600"/></radialGradient>
      <filter id="shadow"><feDropShadow dx="4" dy="14" stdDeviation="12" floodOpacity=".65"/></filter>
    </defs>
    <g opacity=".4" stroke="#efdbd7"><circle cx="226" cy="232" r="174"/><circle cx="226" cy="232" r="149" strokeDasharray="2 7"/><path d="M226 36v29m0 335v29M33 232h30m325 0h30"/></g>
    <g filter="url(#shadow)" transform="rotate(-12 210 240)">
      <path d="m160 145-73 26-40 125 29 125 63-13 5-100 25-45 8 95h111l14-94 34 51-1 92 60 5 13-125-56-115-73-27Z" fill="url(#darkSteel)" stroke="#838790" strokeWidth="2"/>
      <path d="m148 170 54 14 12 66-65-21-29-31Z" fill="url(#steel)" stroke="#bbbfc5"/><path d="m226 181 56-17 45 33-26 39-67 11Z" fill="url(#steel)" stroke="#bbbfc5"/>
      <path d="m176 248 33 11 18-3 50-14-9 39-77 7Zm12 53 67-7-8 29-53 6Zm7 40 49-7-5 20-39 5Z" fill="url(#steel)" stroke="#8c919c"/>
      <path d="m94 177 41 13-16 57-50 21Zm222-11-32 24 24 54 52 16ZM65 277l42-13 12 57-39 9Zm254-15 37 17-9 51-37-9Z" fill="url(#steel)" stroke="#b6bbc3"/>
      <path d="m175 151 8-36h66l16 38-36 33-20-1Z" fill="url(#darkSteel)" stroke="#9b9ea4"/>
      <path d="m161 66 25-25 70 2 34 37-9 60-44 30-56-25-23-36Z" fill="url(#steel)" stroke="#e2e4e8" strokeWidth="2"/>
      <path d="m181 63 57-4 29 19-6 41-34 20-48-16-10-36Z" fill="#10161c" stroke="#969eab" strokeWidth="2"/>
      <path d="m173 88 93 2-5 16-78-3Z" fill="#83f0f1"/><ellipse cx="217" cy="94" rx="46" ry="23" fill="url(#eye)" opacity=".5"/>
      <path d="m197 116 36 2 8 10-12 20-28-9Z" fill="url(#darkSteel)" stroke="#bbc2c6"/><path d="m182 143 17-17m48 18-7-17M171 78l-14-4m127 15 15 2" stroke="#24272e" strokeWidth="6"/>
      <path d="M209 45v-16l20-14" stroke="#bcc4cc" strokeWidth="4"/><circle cx="230" cy="14" r="4" fill="#e94438"/>
      <g stroke="#12151a" strokeWidth="3">{[0,1,2,3,4].map(i=><path key={i} d={`M${175+i*5} 64v12m${68-i*4} 69v9M${78+i*5} 293l10 30M${319+i*5} 291l-3 22`}/>)}</g>
      <g fill="#0f1116" stroke="#c1c9d0">{[[180,51],[261,65],[168,114],[272,124],[134,195],[295,196],[178,264],[262,261],[82,289],[340,290]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="4"/>)}</g>
      <path d="m154 205 24 7m76-4 27-9" stroke="#ff352a" strokeWidth="5"/>
      <path d="m69 346 41-10 8 31-33 25-18-9Zm245-10 34 14-4 34-19 4-21-30Z" fill="url(#steel)" stroke="#b3bac4"/>
      <text x="146" y="220" fontFamily="monospace" fontSize="9" fill="#23252c">F // 01</text><text x="250" y="217" fontFamily="monospace" fontSize="8" fill="#d3d7df">EXO</text>
    </g>
    <g stroke="#ebe9e5"><path d="M55 75H35v24m322-30h25v25M41 373v26h24m318-41v27h-27"/><path d="M285 141h79v-18" strokeWidth=".7"/></g><text x="299" y="117" fill="#eee4df" fontFamily="monospace" fontSize="8">EXO / SERIES 01</text>
  </svg>;
}
