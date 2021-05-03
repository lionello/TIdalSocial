FROM node:14-buster AS node_modules

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production --no-optional \
    && npm cache clean --force

FROM node:14-buster

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    python3-dev \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel \
    && pip3 install --no-cache-dir --requirement /tmp/requirements.txt

# Use dumb-init https://github.com/Yelp/dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

WORKDIR /app
COPY --from=node_modules /app/node_modules/ node_modules
COPY dist/ dist
COPY model/ model
COPY static/ static
COPY package.json ./
COPY .git/refs/heads/master static/GITHEAD

EXPOSE 3000
ARG STORAGE_FOLDER=/model
VOLUME $STORAGE_FOLDER

# 'implicit' highly recommends to set the environment variable
# 'export OPENBLAS_NUM_THREADS=1' to disable BLAS internal multithreading
# See https://github.com/benfred/implicit/blob/master/implicit/utils.py#L27
ENV OPENBLAS_NUM_THREADS=1
ENV NODE_ENV=production
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV STORAGE_FOLDER=$STORAGE_FOLDER
# USER node
CMD ["node", "."]
