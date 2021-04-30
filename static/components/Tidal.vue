<template>
  <div class="tidal-embed">
    <iframe
      v-bind:src="
        'https://embed.tidal.com/playlists/' +
        id +
        '?layout=gridify&coverInitially=true&disableAnalytics=true'
      "
      allowfullscreen="allowfullscreen"
      frameborder="0"
      style="
        x-position: absolute;
        x-top: 0;
        x-left: 0;
        width: 100%;
        height: 1px;
        min-height: 100%;
        margin: 0 auto;
      "
    ></iframe>
  </div>
</template>

<script>
module.exports = {
  props: ["id"],
  data: function () {
    return {
      // src: "https://embed.tidal.com/playlists/3751614e-3827-4860-819c-b9474a000dbb?layout=gridify",
    }
  },
}
</script>

<style scoped>
div.tidal-embed {
  width: 246px;
  padding-left: 10px;
  padding-right: 10px;
  height: 233px;
  float: left;
  /* position: relative;
  margin: 0%;
  height: 0;
  overflow: hidden;
  max-width: 50em; */
}
</style>
