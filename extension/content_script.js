const version = "2021";

console.log("content_script", location.href);
const start = new Date().getTime();

function log(arg) {
  console.log(arg);
  return arg;
}

function init() {
  chrome.storage.sync.get(["version"], (result) => {
    if (result.version !== version) {
      console.log("clearing");
      chrome.storage.sync.clear(() =>
        chrome.storage.sync.set({ version }, () => {
          run();
        })
      );
    } else {
      run();
    }
  });
}

const data = { posts: {}, players: {} };

function updateHidden(e, key) {
  e.style.display = data.posts[key].hidden ? "none" : "";
}

function updatePlayers(playersDiv, key, redditId) {
  Promise.resolve(data.posts[key].players)
    .then(Object.keys)
    .then((players) =>
      players.map((p) => {
        const playerId = `p_${p}`;
        const d = document.createElement("div");
        d.innerText = data.players[p].n;
        chrome.storage.sync.get([playerId], (result) => {
          d.title = Object.keys(result[playerId]);
        });
        d.onclick = () => {
          delete data.posts[key].players[p];
          updatePlayers(playersDiv, key, redditId);
          chrome.storage.sync.get([playerId], (result) => {
            const redditIds = result[playerId] || {};
            delete redditIds[redditId];
            console.log(`removing ${playerId} from ${redditId}`);
            chrome.storage.sync.set({ [playerId]: redditIds });
            chrome.storage.sync.set({ [key]: data.posts[key] });
          });
        };
        return d;
      })
    )
    .then((playerDivs) => playersDiv.replaceChildren(...playerDivs));
}

function run() {
  loadPlayers().then(() => setInterval(main, 100));
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
                const redditId = e.getAttribute("data-fullname");
                const key = `r_${redditId}`;

                const wrapper = document.createElement("div");
                table.replaceChild(wrapper, e);

                const controls = document.createElement("div");
                controls.innerText = `${
                  e.getElementsByClassName("comments")[0].innerText
                } - ${key}`;
                controls.title = e.querySelector("a.title").innerText;
                controls.onclick = () => {
                  data.posts[key].hidden = !data.posts[key].hidden;
                  updateHidden(e, key);
                  console.log(`toggling ${key} ${data.posts[key].hidden}`);
                  chrome.storage.sync.set({ [key]: data.posts[key] });
                };
                wrapper.appendChild(controls);

                const playersDiv = document.createElement("div");
                wrapper.appendChild(playersDiv);

                const boxdiv = document.createElement("div");
                const box = document.createElement("input");
                const boxplayers = document.createElement("div");
                e.appendChild(boxdiv);
                boxdiv.appendChild(box);
                boxdiv.appendChild(boxplayers);
                box.onkeyup = () =>
                  Promise.resolve(data.players)
                    .then(Object.values)
                    .then((players) =>
                      players
                        .filter((p) =>
                          p.n.toLowerCase().includes(box.value.toLowerCase())
                        )
                        .sort((a, b) => b.o - a.o)
                        .slice(0, 10)
                        .map((p) => {
                          const d = document.createElement("div");
                          d.innerText = `${p.o.toFixed(2)} ${p.n}`;
                          d.onclick = () => {
                            boxplayers.replaceChildren();
                            box.value = "";
                            data.posts[key].players[p.id] = true;
                            updatePlayers(playersDiv, key, redditId);
                            const playerId = `p_${p.id}`;
                            chrome.storage.sync.get([playerId], (result) => {
                              const redditIds = result[playerId] || {};
                              redditIds[redditId] = true;
                              console.log(`saving ${playerId} to ${redditId}`);
                              chrome.storage.sync.set({
                                [playerId]: redditIds,
                              });
                              chrome.storage.sync.set({
                                [key]: data.posts[key],
                              });
                            });
                          };
                          return d;
                        })
                    )
                    .then((playerDivs) =>
                      boxplayers.replaceChildren(...playerDivs)
                    );

                chrome.storage.sync.get([key], (result) => {
                  data.posts[key] = result[key] || { players: {} };
                  updateHidden(e, key);
                  updatePlayers(playersDiv, key, redditId);
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
  const timestamp = new Date().getTime();
  return new Promise((resolve, reject) =>
    chrome.storage.local.get(["playersW"], (result) => {
      if (
        result.playersW &&
        result.playersW.timestamp > timestamp - 6 * 60 * 60 * 1000
      ) {
        resolve(result.playersW.players);
      } else {
        fetchPlayers()
          .then((players) => {
            const playersW = { players, timestamp };
            chrome.storage.local.set({ playersW });
            return players;
          })
          .then(resolve);
      }
    })
  ).then((players) => (data.players = players));
}

function fetchPlayers() {
  return fetch(
    "https://fantasy.espn.com/apis/v3/games/ffl/seasons/2021/players?scoringPeriodId=0&view=players_wl",
    {
      headers: {
        "x-fantasy-filter": '{"filterActive":{"value":true}}',
      },
    }
  )
    .then((resp) => resp.json())
    .then((resp) =>
      resp.map(({ fullName, id, ownership }) => [
        id,
        {
          n: fullName,
          id,
          o: ownership.percentOwned,
        },
      ])
    )
    .then(Object.fromEntries);
}

init();
