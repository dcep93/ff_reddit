function log(arg) {
  console.log(arg);
  return arg;
}

var version;
fetch(chrome.runtime.getURL("manifest.json"))
  .then((response) => response.json())
  .then((json) => json.version)
  .then((_version) => (version = _version))
  .then(() => console.log("version", version));
