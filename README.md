# TIdalSocial ![logo](https://github.com/lionello/TIdalSocial/blob/master/static/favicon-32x32.png?raw=true)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-f8bc45.svg)](https://github.com/prettier/prettier)

![GitHub package.json version](https://img.shields.io/github/package-json/v/lionello/tidalsocial)
![Docker Image Size (tag)](https://img.shields.io/docker/image-size/lionello/tidalsocial/latest)

**This project is not affiliated with TIDAL or ASPIRO AB.**

TIdalSocial is my attempt at creating a playlist recommendation engine for the awesome [TIDAL](https://tidal.com/) music streaming service.

TIDAL does not currently have a way to browse or search for shared playlists, but that doesn't stop us, the fans, from creating our own platform.

TIdalSocial uses the following libraries for the recommendations:
* [implicit](https://github.com/benfred/implicit/) for the Alternating Least Squares matrix decomposition
* [hnswlib](https://github.com/nmslib/hnswlib) for the Hierarchical Navigable Small Worlds approximate nearest neighbors

For more details about the inner working of the algorithm, please check the excelent blog post by @benfred on https://www.benfrederickson.com/matrix-factorization/

The frontend is written in HTML and [TypeScript](https://www.typescriptlang.org) and uses [Vue.js](https://vuejs.org) and is served by [ExpressJS](https://expressjs.com).
The backend is also written in TypeScript, runs on [NodeJS](https://nodejs.org/), but `POST`s requests to a local Python 3 [Flask](https://flask.palletsprojects.com/en/1.1.x/) server for the actual recommendations. I'm using ECMAScript Modules (ESM) to allow the generated JavaScript to work in the browser as well as on NodeJS.

## Development
Use `direnv` with the following `.envrc`:
```
use nix
export PATH=$PATH:$PWD/node_modules/.bin
layout python
```

Or, without direnv:
```
nix-shell --pure
npm install
source .venv/bin/activate # or whichever venv you want
# For some reason CMAKE ignores the CXX from mkShell and insists on using clang
CC=$CXX pip install -r requirements.txt
```

## Test
```
nix-shell
npm test
python -m unittest discover -s model
```

## Run
```
nix-shell
npm start
```

## Publish
```
npm version patch # or minor, or major
npm run docker:push
```
