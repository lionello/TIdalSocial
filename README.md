# TIdalSocial

**This project is not affiliated with TIDAL or ASPIRO AB.**

TIdalSocial is my attempt at creating a playlist recommendation engine for the awesome [TIDAL](https://tidal.com/) music streaming service. 

TIDAL does not currently have a way to browse or search for shared playlists, but that doesn't stop us, the fans, from creating our own platform.

TIdalSocial uses the following libraries for the recommendations:
* [implicit](https://github.com/benfred/implicit/) for the Alternating Least Squares matrix decomposition
* [hnswlib](https://github.com/nmslib/hnswlib) for the Hierarchical Navigable Small Worlds approximate nearest neighbors

For more details about the inner working of the algorithm, please check the excelent blog post by @benfred on https://www.benfrederickson.com/matrix-factorization/

The frontend is written in HTML and [TypeScript](https://www.typescriptlang.org) and uses [Vue.js](https://vuejs.org).
The backend is also written in TypeScript, runs on [NodeJS](https://nodejs.org/), but `POST`s requests to a local Python 3 Flask server for the actual recommendations.