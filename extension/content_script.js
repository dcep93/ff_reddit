const year = 2021;

console.log("content_script", location.href);
const start = new Date().getTime();

function log(arg) {
  console.log(arg);
  return arg;
}

function init() {
  loadPlayers();
  chrome.storage.sync.get(["year"], (result) => {
    if (result.year !== year) {
      chrome.storage.sync.clear(() =>
        chrome.storage.sync.set({ year }, () => {
          run();
        })
      );
    } else {
      run();
    }
  });
}

const data = { posts: {} };

function updateHidden(e, key) {
  e.style.display = data.posts[key].hidden ? "none" : "";
}

function run() {
  setInterval(main, 100);
}

function main() {
  Promise.resolve()
    .then(() => document.getElementsByClassName("sitetable"))
    .then(Array.from)
    .then((tables) =>
      tables.map((table) =>
        Promise.resolve(table)
          .then((table) => table.children)
          .then(Array.from)
          .then((children) =>
            children
              .filter((e) => e.classList.contains("thing"))
              .map((e) => {
                if (e.classList.contains("promoted")) {
                  table.removeChild(e);
                  return e;
                }
                const wrapper = document.createElement("div");
                table.replaceChild(wrapper, e);
                const controls = document.createElement("div");
                const key = `r_${e.getAttribute("data-fullname")}`;
                controls.innerText = `${
                  e.getElementsByClassName("comments")[0].innerText
                } - ${key}`;
                controls.title = e.querySelector("a.title").innerText;
                controls.onclick = () => {
                  data.posts[key].hidden = !data.posts[key].hidden;
                  updateHidden(e, key);
                  chrome.storage.sync.set({ [key]: data.posts[key] });
                };
                wrapper.appendChild(controls);
                chrome.storage.sync.get([key], (result) => {
                  data.posts[key] = result[key] || {};
                  updateHidden(e, key);
                });
                wrapper.appendChild(e);
                return e;
              })
          )
      )
    )
    .then((promises) => Promise.all(promises))
    .then((arrs) => arrs.flatMap((i) => i))
    .then((es) => es.length && log(es));
}

function loadPlayers() {
  fetch(
    "https://fantasy.espn.com/apis/v3/games/ffl/seasons/2021/players?scoringPeriodId=0&view=players_wl",
    {
      headers: {
        "x-fantasy-filter": '{"filterActive":{"value":true}}',
      },
    }
  )
    .then((resp) => resp.json())
    .then(log)
    .then((resp) =>
      resp.map(({ fullName, id, ownership }) => ({
        fullName,
        id,
        ownership: ownership.percentOwned,
      }))
    )
    .then((players) => (data.players = players));
}

init();
