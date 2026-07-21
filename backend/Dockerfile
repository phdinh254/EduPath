FROM node:22-alpine AS base
WORKDIR /app

# package.json's postinstall runs "prisma generate", which needs prisma/schema.prisma
# present at "npm ci" time - so it must be copied in before npm ci in every stage that
# installs dependencies, not just wherever the rest of the source gets copied.
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS dev
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
# Dùng lại node_modules đã build (đã có @prisma/client sinh sẵn từ bước generate ở stage
# build) thay vì "npm ci --omit=dev" rồi generate lại - tránh lặp lại vấn đề thứ tự COPY
# prisma/schema.prisma trước khi postinstall chạy.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
