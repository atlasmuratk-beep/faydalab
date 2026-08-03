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
  fonts-liberation \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Remotion'ın kendi yönettiği Chrome Headless Shell'i indir.
# npx yerine doğrudan yerel binary çağrılıyor: npx'in bazı ortamlarda paket
# içindeki çalıştırılabilir dosyayı bulamayıp "could not determine executable
# to run" hatası vermesi biliniyor (Railway build ortamında gözlemlendi).
RUN node_modules/.bin/remotion browser ensure

ENV PORT=3001
# Node'un V8 heap'i, container'da gerçekte ne kadar RAM olursa olsun
# varsayılan olarak ~2GB'da sınırlı kalıyor ve bunu aşınca "JavaScript heap
# out of memory" ile çöküyor (Railway 8GB tanımlı olsa bile). Bundling +
# render sırasında bu limite takılmamak için açıkça yükseltiyoruz.
ENV NODE_OPTIONS=--max-old-space-size=6144
EXPOSE 3001

CMD ["node_modules/.bin/tsx", "src/server.ts"]
