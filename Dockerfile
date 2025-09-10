#docker buildx build --platform linux/amd64 -f Dockerfile -t bnhf/cc4c:latest -t bnhf/cc4c:2025.04.12 . --push --no-cache
FROM node:lts-bookworm-slim AS base

ARG DEBIAN_FRONTEND=noninteractive

# Add contrib and non-free sources to apt
# Delete deb822 file and manage everything in sources.list
RUN rm -f /etc/apt/sources.list.d/debian.sources \
 && printf '%s\n' \
  "deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware" \
  "deb http://deb.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware" \
  "deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware" \
  > /etc/apt/sources.list

# Core system and Chrome runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release \
    xdg-utils x11vnc x11-xkb-utils xfonts-100dpi xfonts-75dpi xfonts-scalable \
    x11-apps xvfb xserver-xorg-core x11-xserver-utils xauth gnupg \
    wget libva2 libva-drm2 libva-x11-2 intel-media-va-driver-non-free vainfo \
    procps

# Add Google Chrome (stable)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && apt-get install -y --no-install-recommends \
    google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei \
    fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1

# Environment setup
ENV DISPLAY=:99
ENV CHROME_BIN=/usr/bin/google-chrome
ENV LIBVA_DRIVER_NAME=iHD
ENV DOCKER=true

# Create app directory and copy files
WORKDIR /home/chrome
COPY main.js package.json bun.lock start.sh ./

# Install Node dependencies
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install -g bun
RUN bun install

# Expose app and VNC ports
EXPOSE 5589 5900

# Startup
ENTRYPOINT ["./start.sh"]
