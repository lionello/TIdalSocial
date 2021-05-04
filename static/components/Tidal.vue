<template>
  <div class="tidal-embed">
    <iframe
      v-if="src"
      v-bind:src="src + '?layout=gridify&coverInitially=true&disableAnalytics=true'"
      allowfullscreen="allowfullscreen"
      frameborder="0"
    ></iframe>
    <div v-else class="placeholder-item"></div>
  </div>
</template>

<script>
module.exports = {
  props: ["src"],
  data: function () {
    return {
      // src: "https://embed.tidal.com/playlists/3751614e-3827-4860-819c-b9474a000dbb",
    }
  },
}
</script>

<style>
div.tidal-embed {
  width: 233px;
  background-color: rgb(36, 37, 40);
  height: 233px;
  position: relative;
  margin: 0%;
  overflow: hidden;
  max-width: 50em;
}
div.tidal-embed iframe {
  width: 100%;
  height: 1px;
  min-height: 100%;
  margin: 0 auto;
}
/* From https://blog.prototypr.io/how-to-create-placeholder-loading-animations-in-css-2334255aa74c */
.placeholder-item {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.placeholder-item::before {
  content: "";
  display: block;
  position: absolute;
  left: -150px;
  top: 0;
  height: 100%;
  width: 150px;
  background: linear-gradient(to right, transparent 0%, #e8e8e8 50%, transparent 100%);
  animation: load 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes load {
  from {
    left: -150px;
  }
  to {
    left: 100%;
  }
}
</style>
