def render_panel(description, progress=None, elapsed=None, job_id=None, online=True):
    """Self-contained embed: remote browsers never contact the private image server."""
    from html import escape
    from datetime import datetime, timezone
    label = "Checking server" if str(description).startswith("Checking") else "Image server online" if online else "Image server unavailable"
    pct = max(0, min(100, float(progress))) if progress is not None else None
    meter = f'<div class="track" role="progressbar" aria-label="Image progress" aria-valuenow="{pct:.0f}" aria-valuemin="0" aria-valuemax="100"><div style="width:{pct}%"></div></div>' if pct is not None else ""
    number = f'{pct:.0f}%' if pct is not None else ""
    detail = f'{round(elapsed)}s elapsed' if elapsed is not None else 'Checked ' + datetime.now(timezone.utc).strftime('%H:%M:%S UTC')
    job = ' · ' + escape(str(job_id)) if job_id else ''
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{{box-sizing:border-box}}html,body{{height:150px!important;min-height:0!important;max-height:150px!important;overflow:hidden}}body{{margin:0;background:#0a101b;color:#e9f1fc;font:13px system-ui,sans-serif;padding:12px 16px}}header,.row{{display:flex;justify-content:space-between;align-items:center;gap:12px}}header{{font-size:11px;color:#8be4cb}}strong{{font-size:17px;color:#edf6ff}}.row{{margin:12px 0 8px}}p{{margin:0;line-height:1.4}}b{{font-size:24px;color:#8be4cb}}small{{font-size:10px;color:#94a6bf}}.track{{height:4px;background:#29384e;border-radius:3px;overflow:hidden}}.track>div{{height:100%;background:linear-gradient(90deg,#69b0f2,#83e4ca)}}footer{{margin-top:7px}}@media(max-width:400px){{body{{padding:10px}}strong{{font-size:14px}}header{{font-size:9px}}}}
    </style></head><body><header><strong>Qwen Image</strong><span>{label}</span></header><div class="row"><p>{escape(str(description))}</p><b>{number}</b></div>{meter}<footer><small>{detail}{job} · Updates arrive through Open WebUI</small></footer></body></html>'''
