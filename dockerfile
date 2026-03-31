FROM node:24.14-alpine3.23

LABEL author="DEFRA"
ARG GA_ID
ENV NODE_ENV=production
ENV PORT=8000

WORKDIR /usr/src
COPY . sir-media-upload
WORKDIR /usr/src/sir-media-upload
RUN npm ci --ignore-scripts
RUN npm run build

EXPOSE $PORT

CMD [ "npm", "start" ]