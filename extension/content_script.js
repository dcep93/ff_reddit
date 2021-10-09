const version = "2021";

console.log("content_script", location.href);
const start = new Date().getTime();

function log(arg) {
  console.log(arg);
  return arg;
}

function main() {
  if (location.href.startsWith("https://www.reddit.com")) {
    transform();
  } else {
    inject();
  }
  setTimeout(main, 100);
}

const data = { posts: {}, players: {} };

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

function run() {
  loadPlayers().then(main);
}

function clean(str) {
  return str
    .toLowerCase()
    .replaceAll(/\bcmc\b/g, "christian mccaffrey")
    .replaceAll(/\./g, "");
}

function updateHidden(e, key) {
  if (!location.href.includes("/comments/"))
    e.style.display = data.posts[key].hidden ? "none" : "";
}

function updatePlayers(playersDiv, key, redditId) {
  Promise.resolve(data.posts[key].players)
    .then(Object.keys)
    .then((players) =>
      players.map((p) => {
        const playerId = `p_${p}`;
        const d = document.createElement("span");
        d.style.paddingRight = "10px";
        d.innerText = `${data.players[p].n}/${data.players[p].o.toFixed(2)}`;
        chrome.storage.sync.get([playerId], (result) => {
          d.title = Object.keys(result[playerId]);
        });
        d.onclick = () => {
          delete data.posts[key].players[p];
          updatePlayers(playersDiv, key, redditId);
          chrome.storage.sync.get([playerId], (result) => {
            const redditIds = result[playerId];
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

function transform() {
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
              .filter(
                (e) =>
                  e.classList.contains("thing") &&
                  !e.classList.contains("comment") &&
                  !e.classList.contains("morechildren")
              )
              .filter((e) => {
                if (e.classList.contains("promoted")) {
                  table.removeChild(e);
                  return false;
                } else {
                  return true;
                }
              })
              .map((e) => transformPost(e, table))
          )
      )
    )
    .then((promises) => Promise.all(promises))
    .then((arrs) => arrs.flatMap((i) => i))
    .then((es) => es.length && log(es));
}

function transformPost(e, table) {
  const redditId = e.getAttribute("data-fullname");
  const key = `r_${redditId}`;

  const wrapper = document.createElement("div");
  wrapper.style.padding = "3px";
  table.replaceChild(wrapper, e);

  const playersDiv = document.createElement("div");
  wrapper.appendChild(playersDiv);

  const controls = document.createElement("span");
  controls.innerText = `${
    e.getElementsByClassName("comments")[0].innerText
  } - ${key}`;
  controls.onclick = () => {
    data.posts[key].hidden = !data.posts[key].hidden;
    updateHidden(e, key);
    console.log(`toggling ${key} ${data.posts[key].hidden}`);
    chrome.storage.sync.set({ [key]: data.posts[key] });
  };
  wrapper.appendChild(controls);

  const postTitle = e.querySelector("a.title").innerText;
  boxdiv = getBoxDiv(key, playersDiv, redditId, postTitle);
  e.appendChild(boxdiv);

  chrome.storage.sync.get([key], (result) => {
    if (result[key] === undefined) {
      read(postTitle, redditId, key, playersDiv, e);
    } else {
      data.posts[key] = result[key];
      updateHidden(e, key);
      updatePlayers(playersDiv, key, redditId);
    }
  });
  wrapper.appendChild(e);
  return e;
}

function getBoxDiv(key, playersDiv, redditId, title) {
  const boxdiv = document.createElement("div");
  const box = document.createElement("input");
  const boxplayers = document.createElement("span");
  boxdiv.appendChild(box);
  boxdiv.appendChild(boxplayers);
  box.onkeyup = () =>
    Promise.resolve(data.players)
      .then(Object.values)
      .then((players) =>
        players
          .filter((p) => clean(p.n).includes(clean(box.value)))
          .sort((a, b) => b.o - a.o)
          .slice(0, 10)
          .map((p) => {
            const d = document.createElement("div");
            d.innerText = `${p.o.toFixed(2)} ${p.n}`;
            d.onclick = () => {
              boxplayers.replaceChildren();
              box.value = "";
              data.posts[key].players[p.id] = new Date().getTime();
              updatePlayers(playersDiv, key, redditId);
              const playerId = `p_${p.id}`;
              chrome.storage.sync.get([playerId], (result) => {
                const redditIds = result[playerId] || {};
                redditIds[redditId] = {
                  redditId,
                  title,
                  timestamp: new Date().getTime(),
                };
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
      .then((playerDivs) => boxplayers.replaceChildren(...playerDivs));
  return boxdiv;
}

function read(postTitle, redditId, key, playersDiv, e) {
  Promise.resolve(data.players)
    .then(Object.values)
    .then((players) =>
      players.filter((p) => clean(postTitle).includes(clean(p.n)))
    )
    .then((players) => {
      players.length &&
        console.log(`reading ${players.map((p) => p.n)} to ${redditId}`);
      return players;
    })
    .then((players) => players.map((p) => [p.id, new Date().getTime()]))
    .then(Object.fromEntries)
    .then((players) =>
      chrome.storage.sync.set({ [key]: { players } }, () => {
        data.posts[key] = { players };
        updateHidden(e, key);
        Promise.resolve(Object.keys(players))
          .then((p) =>
            p
              .map((p) => `p_${p}`)
              .map((playerId) => seriallyUpdate(playerId, redditId, postTitle))
          )
          .then((ps) => Promise.all(ps))
          .then(() => updatePlayers(playersDiv, key, redditId));
      })
    );
}

const promises = [Promise.resolve()];
function seriallyUpdate(playerId, redditId, title) {
  const x = {};
  function helper(x, resolve) {
    if (x.p === undefined) return setTimeout(() => helper(x, resolve), 10);
    promises.splice(0, 1, x.p)[0].then(() =>
      chrome.storage.sync.get([playerId], (result) => {
        const redditIds = result[playerId] || {};
        const title = "TODO";
        redditIds[redditId] = {
          redditId,
          title,
          timestamp: new Date().getTime(),
        };
        chrome.storage.sync.set(
          {
            [playerId]: redditIds,
          },
          resolve
        );
      })
    );
  }
  x.p = new Promise((resolve, reject) => helper(x, resolve));
  return x.p;
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
        console.log("fetching", result.playersW?.timestamp);

        fetch(
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
          .then(Object.fromEntries)
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

function inject() {
  const playerCard = document.getElementsByClassName("player-card-center")[0];
  if (!playerCard) return;
  var div = playerCard.getElementsByClassName("extension_div")[0];
  if (!div) {
    div = document.createElement("pre");
    div.classList = ["extension_div"];
    playerCard.appendChild(div);
  }
  Promise.resolve(playerCard.getElementsByTagName("a"))
    .then(Array.from)
    .then((es) => es.map((e) => e.getAttribute("href")))
    .then((hrefs) =>
      hrefs.find((href) =>
        href.startsWith("https://www.espn.com/nfl/player/stats/_/id/")
      )
    )
    .then((href) => {
      if (!href) return;
      const id = href.split("_/id/")[1].split("/")[0];
      const playerId = `p_${id}`;
      chrome.storage.sync.get([playerId], (result) => {
        const innerHTML = Object.entries(result[playerId] || {})
          .map(([post, timestamp]) => ({ post, timestamp }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((o) => o.post.split("_")[1])
          .map(
            (id) => `https://www.reddit.com/r/fantasyfootball/comments/${id}`
          )
          .map((href) => `<a href="${href}">hi</a>`)
          .join("\n");
        if (div.innerHTML !== innerHTML) div.innerHTML = innerHTML;
      });
    });
}

init();
