# vision-engine — FastAPI + OpenCV/DeepFace (CPU)
# Base digest reference: python@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df
FROM python:3.12.16-slim-bookworm AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libgomp1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin vision

COPY requirements.txt .
# Runtime image keeps requirements.txt as the single pin source (includes test deps).
RUN pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /data \
    && chown vision:vision /data

COPY --chown=vision:vision app ./app
USER vision

ENV DEEPFACE_HOME=/data \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
