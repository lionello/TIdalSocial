<template>
  <div class="tidal-embed">
    <iframe
      v-if="src"
      v-bind:src="src + '?layout=gridify&coverInitially=true&disableAnalytics=true'"
      allowfullscreen="allowfullscreen"
      frameborder="0"
    ></iframe>
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
  /* position: absolute;
  top: 0;
  left: 0; */
  width: 100%;
  height: 1px;
  min-height: 100%;
  margin: 0 auto;
}
</style>
