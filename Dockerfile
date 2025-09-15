FROM node:23 AS base

WORKDIR /src

COPY package.json .

RUN npm install

COPY . .

CMD npx prisma generate && npx prisma db push && npm run dev