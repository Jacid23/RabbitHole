FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/src
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/family_studio ./src/family_studio
COPY scripts/build_comfyui_tool.py ./scripts/build_comfyui_tool.py
COPY integrations/comfyui ./integrations/comfyui
COPY integrations/openwebui/panel.py ./integrations/openwebui/panel.py
COPY web/family-studio/dist ./web/family-studio/dist
USER 1000:1000
EXPOSE 5030
CMD ["python", "-m", "family_studio", "--host", "0.0.0.0", "--port", "5030"]
