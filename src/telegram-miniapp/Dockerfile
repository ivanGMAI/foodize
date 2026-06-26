FROM node:20-alpine AS base
WORKDIR /miniapp
COPY package*.json ./
RUN npm install

FROM base AS dev
COPY . .
EXPOSE 5174
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS build-stage
COPY . .
RUN npm run build

FROM nginx:1.28-alpine AS production
COPY --from=build-stage /miniapp/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
