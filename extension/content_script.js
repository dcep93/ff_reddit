console.log("content_script", location.href);
const start = new Date().getTime();

function log(arg) {
  console.log(arg);
  return arg;
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
                const wrapper = document.createElement("div");
                table.replaceChild(wrapper, e);
                const controls = document.createElement("div");
                controls.innerText = e.getAttribute("data-fullname");
                wrapper.appendChild(controls);
                e.style.display = "none";
                wrapper.appendChild(e);
                return e;
              })
          )
      )
    )
    .then((promises) => Promise.all(promises))
    .then((arrs) => arrs.flatMap((i) => i))
    .then(log);
}

main();
setInterval(main, 1000);
