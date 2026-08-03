FROM node:22-bookworm-slim

# Chrome Headless Shell bağımlılıkları (Remotion resmi dokümantasyonu:
# https://www.remotion.dev/docs/docker)
RUN apt-get update
RUN apt install -y \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libgbm-dev \
  libasound2 \
  libxrandr2 \
  libxkbcommon-dev \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libatk-bridge2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

# Remotion'ın kendi yönettiği Chrome Headless Shell'i indir.
RUN npx remotion browser ensure

ENV PORT=3001
EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
