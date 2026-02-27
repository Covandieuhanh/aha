FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache wget

# Skip husky hooks in production image builds (husky is devDependency)
ENV HUSKY=0

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
