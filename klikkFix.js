
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "improveText",
        title: "Improve Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "professionalText",
        title: "Professional Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "summarizeText",
        title: "Summarize Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "translateText",
        title: "Translate Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "shortenText",
        title: "Shorten Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "solve",
        title: "Solve",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "expandText",
        title: "Expand Text",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "rewriteText",
        title: "Rewrite Text",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "improveText" ) {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "professionalText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "summarizeText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "translateText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "shortenText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "solve") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "expandText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

    if (info.menuItemId === "rewriteText") {
        processText(info.menuItemId, info.selectionText, tab);
    }

});


// selve funksjonen til å forberede valgt tekst
function processText(menuId, selectedText, tab) {

    fetch("http://127.0.0.1:5000/improve-text", { // Sender valgte tekst til server siden for å forberede den
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: menuId, text: selectedText }),
        mode: "cors"
    })
        .then(response => response.json())
        .then(data => {
            if (data.improved_text) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: replaceSelectedText,
                    args: [data.improved_text]
                });

                // ✅ VIS TOAST når tekst er forbedret
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: showToast,
                    args: ["✅ AI Successully Changed Your Text!"]
                });
            } else {
                // ❌ VIS TOAST ved feil
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: showToast,
                    args: ["❌ Error: " + data.error]
                });

            }
        })
        .catch(error => {
            console.error("Fetch error:", error);
            showNotification("Error", "Failed to fetch improved text.");
        });
}


function replaceSelectedText(newText) {
    let activeElement = document.activeElement;

    // **Sjekk om brukeren skriver i et INPUT eller TEXTAREA-felt**
    if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        let start = activeElement.selectionStart;
        let end = activeElement.selectionEnd;

        // **Erstatt teksten direkte i inputfelt**
        activeElement.setRangeText(newText, start, end, "end");

        // Flytt markøren til slutten av den nye teksten
        activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
    } else {
        // 🏆 **Forvanlig tekst på nettsider**
        let selection = window.getSelection();
        if (!selection.rangeCount) return;

        let range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));

        // Fjern markeringen etter erstatning
        selection.removeAllRanges();
    }
}

function showToast(message) {
    let toast = document.createElement("div");
    toast.innerText = message;
    toast.style.fontSize = "18px"
    toast.style.letterSpacing = "0.05"
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.background = "#444";
    toast.style.color = "white";
    toast.style.padding = "20px";
    toast.style.borderRadius = "5px";
    toast.style.zIndex = "10000";
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}


function showNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        title: title,
        message: message,
        priority: 2
    });
}
