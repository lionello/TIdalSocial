<template>
  <div>
    <iframe v-bind:src="src" frameborder="0" allowfullscreen></iframe>
  </div>
</template>

<script>
module.exports = {
  props: ["src"],
  data: function () {
    return {
      srcx:
        "https://embed.tidal.com/playlists/3751614e-3827-4860-819c-b9474a000dbb?layout=gridify",
    }
  },
}
</script>

<style scoped>
div {
  /* position: relative;
  margin: 0%;
  height: 0;
  overflow: hidden;
  max-width: 50em; */
}
</style>
