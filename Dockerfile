FROM node:14-buster AS build

COPY package.json package-lock.json ./
RUN npm install --only=prod

FROM node:14-buster

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-dev \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel \
    && pip3 install --no-cache-dir --requirement /tmp/requirements.txt

WORKDIR /tidalsocial
COPY --from=build node_modules/ node_modules

# 'implicit' highly recommends to set the environment variable
# 'export OPENBLAS_NUM_THREADS=1' to disable BLAS internal multithreading
# See https://github.com/benfred/implicit/blob/master/implicit/utils.py#L27
ENV OPENBLAS_NUM_THREADS=1

COPY dist/ dist
COPY model/ model
COPY static/ static
COPY package.json run.sh ./
EXPOSE 3000
RUN mkdir -p db/playlist db/artist cache/playlist cache/artiss
COPY db/playlist/5e76c6c2-ed06-4126-8d7f-a0bd6a9a091d-playlist.json db/playlist/
ENV NODE_ENV=production
ENV STORAGE_FOLDER=/model
VOLUME [ $STORAGE_FOLDER ]
CMD ./run.sh
USER node
