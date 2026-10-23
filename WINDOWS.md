# Windows installation

The app source and built frontends can live in `C:\Program Files\Rabbithole`. Writable files belong to `%LOCALAPPDATA%\Rabbithole`, separate from the original Qwen/MCP repository.

- `Open-RabbitHole.ps1` opens the public family app configured in `settings.json`.
- `Start-RabbitHole.ps1` starts a separate local instance on loopback port 5030. Use `-Port` for a different local port.
- `Stop-RabbitHole.ps1` verifies and stops only its recorded local process and descendants. It does not stop Spark, Open WebUI, ComfyUI, or TTS.

The local instance uses its own Python environment at `%LOCALAPPDATA%\Rabbithole\.venv`. Its launcher sets `PYTHONPATH` from this installation, so it does not depend on another checkout or an editable package installed elsewhere.

For a fresh setup, create that environment using Python 3.12 and install this folder's `requirements.txt`. Create writable `data`, `workflows`, and `backups` directories in the user-data folder. Add `settings.json` with these fields, replacing the example service addresses:

```json
{
  "openwebui": "http://127.0.0.1:3000",
  "public_openwebui": "http://127.0.0.1:3000",
  "comfyui": "http://127.0.0.1:8188",
  "public_app": "https://your-rabbit-hole-address.example",
  "data": "C:\\Users\\YOUR_USER\\AppData\\Local\\Rabbithole\\data",
  "workflows": "C:\\Users\\YOUR_USER\\AppData\\Local\\Rabbithole\\workflows"
}
```

Import and publish approved workflows through the administrator interface. `STUDIO_RECIPES` supports an external workflow directory; Docker's existing workflow mount continues to work without that environment variable.

Local and hosted histories are independent. A backup of the hosted app is not automatically restored over local data. Keep the database, media, opening images, and workflows backed up together. Never copy a live SQLite file without its WAL; use SQLite's online backup API.

Windows protects Program Files. Editing or rebuilding source there may require an elevated terminal; normal app operation writes only to the user-data folder. The public deployment is not moved or restarted by a Windows installation.
