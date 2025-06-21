/*
document.addEventListener("mouseup", () => {
  const selected = window.getSelection()?.toString();
  if (selected && selected.trim() !== "") {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: "textSelected", text: selected });
    } else {
      console.log("⚠️ chrome.runtime.sendMessage is not available in this context.");
    }
  }
});
*/
