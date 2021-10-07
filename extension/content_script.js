console.log("content_script", location.href);
const start = new Date().getTime();

function log(arg) {
  console.log(arg);
  return arg;
}

function hide(e, key, hidden) {
  data[key] = hidden;
  e.style.display = hidden ? "none" : "";
}

const data = {};

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
                  hide(e, key, !data[key]);
                  chrome.storage.sync.set({ [key]: data[key] });
                };
                wrapper.appendChild(controls);
                chrome.storage.sync.get([key], (result) =>
                  hide(e, key, result[key])
                );
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

setInterval(main, 100);
