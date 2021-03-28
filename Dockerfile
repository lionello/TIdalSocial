FROM node:14-buster AS build

COPY package.json package-lock.json ./
RUN npm install --only=prod

FROM node:14-buster

RUN apt-get update && apt-get install -y \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --upgrade pip && pip3 install --no-cache-dir \
    flask \
    implicit \
    && pip install --no-binary :all: nmslib

WORKDIR tidalsocial
COPY --from=build node_modules/ node_modules
ENV OPENBLAS_NUM_THREADS=1
COPY dist/ dist
COPY model/ model
COPY static/ static
COPY package.json run.sh ./
EXPOSE 3000
RUN mkdir -p db/playlist cache/playlist
COPY db/playlist/5e76c6c2-ed06-4126-8d7f-a0bd6a9a091d-playlist.json db/playlist/
CMD ./run.sh
#CMD ["overmind", "start"]