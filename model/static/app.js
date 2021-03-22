    import {parsePlaylistDocument} from "js/parse.js";
    (function () {
        function E(id) { return document.getElementById(id); }
        function fetch(url) {
            let xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "document";
            xhr.onreadystatechange = function (x) {
                if (xhr.readyState == 4) {
                    parsePlaylistDocument(xhr.responseXML);
                }
            }
            xhr.send();
        }
        function post() {
            let xhr = new XMLHttpRequest()
            xhr.open("/playlist")
        }
        function init(e) {
            const playlist_url = document.getElementById("playlist_url");
            playlist_url.focus();
            E('form1').onsubmit = function (e) { e.preventDefault(); fetch(playlist_url.value); return false; };
        }

        setTimeout(init, 0)
        //document.addEventListener('load', init);
    })();

