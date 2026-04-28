FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOST=0.0.0.0 \
    PORT=7861

COPY pyproject.toml ./
COPY ntelogin ./ntelogin

RUN pip install --no-cache-dir .

EXPOSE 7861

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7861/health', timeout=3)" || exit 1

CMD ["python", "-m", "ntelogin.main"]
