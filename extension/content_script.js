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

function updatePlayers(playersDiv, key) {
  Promise.resolve(data.posts[key].players)
    .then((players) =>
      players.map((p, i) => {
        const d = document.createElement("div");
        d.innerText = data.players[p].fullName;
        d.onclick = () => {
          data.posts[key].players.splice(i, 1);
          updatePlayers(playersDiv, key);
          chrome.storage.sync.set({ [key]: data.posts[key] });
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
                const key = `r_${e.getAttribute("data-fullname")}`;

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
                          p.fullName
                            .toLowerCase()
                            .includes(box.value.toLowerCase())
                        )
                        .sort((a, b) => b.ownership - a.ownership)
                        .slice(0, 10)
                        .map((p) => {
                          const d = document.createElement("div");
                          d.innerText = `${p.ownership.toFixed(2)} ${
                            p.fullName
                          }`;
                          d.onclick = () => {
                            boxplayers.replaceChildren();
                            box.value = "";
                            data.posts[key].players.push(p.id);
                            updatePlayers(playersDiv, key);
                            chrome.storage.sync.set({ [key]: data.posts[key] });
                          };
                          return d;
                        })
                    )
                    .then((playerDivs) =>
                      boxplayers.replaceChildren(...playerDivs)
                    );

                chrome.storage.sync.get([key], (result) => {
                  data.posts[key] = result[key] || { players: [] };
                  updateHidden(e, key);
                  updatePlayers(playersDiv, key);
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
    chrome.storage.sync.get(["playersW"], (result) => {
      if (
        result.playersW &&
        result.playersW.timestamp > timestamp - 6 * 60 * 60 * 1000
      ) {
        resolve(result.playersW.players);
      } else {
        fetchPlayers()
          .then((players) => {
            const playersW = { players, timestamp };
            chrome.storage.sync.set({ playersW });
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
          fullName,
          id,
          ownership: ownership.percentOwned,
        },
      ])
    )
    .then(Object.fromEntries);
}

init();
