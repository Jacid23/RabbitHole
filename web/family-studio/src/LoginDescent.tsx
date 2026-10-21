export function LoginDescent() {
  return (
    <div className="login-descent" role="status" aria-live="polite">
      <div className="fall-scene" aria-hidden="true">
        <div className="fall-light" />
        <div className="fall-well">
          <i />
          <i />
          <i />
          <i />
        </div>
        <svg className="falling-shadow" viewBox="0 0 200 300">
          <circle cx="101" cy="58" r="20" />
          <path d="M84 80Q100 74 116 82L130 144 117 177 135 224 163 262Q170 277 159 281L145 271 111 235 98 202 82 235 64 272Q54 283 46 274L48 261 62 219 75 172 70 124 48 149 20 139Q10 134 15 125L28 125 44 128 63 96Q70 83 84 80Z" />
          <path d="m113 86 28-20 17-31q7-11 15-5l-4 16-12 34-28 28Z" />
        </svg>
        <div className="fall-vignette" />
      </div>
      <div className="fall-caption">
        <p>Down the rabbit hole…</p>
        <span>Opening your space</span>
      </div>
    </div>
  );
}
