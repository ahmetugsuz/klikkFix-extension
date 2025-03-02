chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "replaceText") {
        replaceSelectedText(request.newText);
    }
});

function replaceSelectedText(newText) {
    let selection = window.getSelection();
    if (!selection.rangeCount) return;

    let range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
}
