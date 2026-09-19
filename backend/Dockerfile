FROM python:3.12-slim

LABEL org.opencontainers.image.title="agent-audit" \
      org.opencontainers.image.description="AI Agent pre-deployment certification — v7.0.0" \
      org.opencontainers.image.version="7.0.0" \
      org.opencontainers.image.vendor="CertifyAI" \
      org.opencontainers.image.url="https://certifyai.in"

WORKDIR /audit

COPY pyproject.toml README.md ./
COPY src/ src/
COPY fixtures/ fixtures/
COPY targets/ targets/
COPY checkers/ checkers/

RUN pip install --no-cache-dir ".[all]" && \
    pip install --no-cache-dir pytest pytest-asyncio

ENTRYPOINT ["agent-audit"]
CMD ["run", "--target", "targets/my_agent_v4.yaml", "--mode", "validate", \
     "--output", "/output/report.json", "--sarif", "/output/report.sarif", \
     "--html", "/output/report.html", "--cert-output", "/output/certificate.json"]
