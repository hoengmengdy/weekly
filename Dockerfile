FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.lock.txt backend/requirements.lock.txt
RUN pip install --no-cache-dir -r backend/requirements.lock.txt
COPY backend/ backend/
COPY INDEx.py ./
COPY --from=frontend /build/frontend/dist frontend/dist
RUN useradd --create-home workday && mkdir -p backend/instance backend/uploads && chown -R workday:workday /app
USER workday
EXPOSE 5000
CMD ["waitress-serve", "--listen=0.0.0.0:5000", "INDEx:app"]
