import { getCurrentUserKey, getUserData, checkUsageLimit } from './storageUtils.js';
let isContextMenuUpdating = false;

// Run on extension install or update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
        chrome.tabs.create({ url: "popup.html" }); // Open the tab only on install/update
        console.log("KlikkFix installed successfully!");
    }

    // Clear context menus on install
    chrome.contextMenus.removeAll(() => {
        console.log("Context menus cleared on install/update, awaiting user login");
    });
});



function updateContextMenusBasedOnUser() {
    if (isContextMenuUpdating) {
        console.log("🔁 Skipping duplicate context menu update call");
        return;
    }

    isContextMenuUpdating = true;

    chrome.contextMenus.removeAll(() => {
        chrome.storage.local.get(["users", "currentUser"], (result) => {
            const users = result.users || {};
            const currentUser = result.currentUser;
            const userData = users[currentUser];

            if (!userData || !Array.isArray(userData.tools)) {
                console.warn("No tools found for current user.");
                isContextMenuUpdating = false;
                return;
            }

            const menuTitles = {
                improveText: "Improve Text",
                professionalText: "Professional Text",
                summarizeText: "Summarize Text",
                translateText: "Translate Text",
                shortenText: "Shorten Text",
                solve: "Solve",
                expandText: "Expand Text",
                rewriteText: "Rewrite Text"
            };

            userData.tools.forEach(toolId => {
                chrome.contextMenus.create({
                    id: toolId,
                    title: menuTitles[toolId] || toolId,
                    contexts: ["selection"]
                });
            });

            console.log("✅ Context menus updated for:", currentUser, userData.tools);
            isContextMenuUpdating = false;
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateContextMenus") {
        updateContextMenusBasedOnUser();
        sendResponse({ success: true });
    }
});


// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
    updateContextMenusBasedOnUser();
});

// Handle context menu actions & send data to backend
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId) {
        processText(info.menuItemId, info.selectionText, tab);
    }
});

// Send selected text to backend for processing
function processText(menuId, selectedText, tab) {
    console.log("🧠 processText triggered:", menuId, selectedText);

    getCurrentUserKey().then(userKey => {
        if (!userKey) return;

        getUserData(userKey).then(userData => {
            if (!checkUsageLimit(userData)) {
                console.warn("🚫 Usage limit reached.");
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: showToast,
                    args: ["Daily limit reached. Upgrade to continue."]
                });
                return Promise.resolve();  // ✅ Prevent further execution
            }

            // ✅ Proceed if limit is valid
            return proceedWithTextProcessing(menuId, selectedText, tab, userKey, userData);
        });
    });
}

function proceedWithTextProcessing(menuId, selectedText, tab, userKey, userData) {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: showLoadingIndicator
    });

    return fetch("https://klikkfix-backend.onrender.com/improve-text", {
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
                func: (newText) => {
                    // Prevent duplicate execution
                    if (window.__klikkfix_replacement_running__) return;
                    window.__klikkfix_replacement_running__ = true;
            
                    // Embedded toast function
                    function showToast(message) {
                        let toast = document.createElement("div");
                        toast.innerText = message;
                        toast.style.fontSize = "18px";
                        toast.style.position = "fixed";
                        toast.style.bottom = "30px";
                        toast.style.right = "30px";
                        toast.style.background = "#444";
                        toast.style.color = "white";
                        toast.style.padding = "20px";
                        toast.style.borderRadius = "5px";
                        toast.style.zIndex = "10000";
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 4000);
                    }
            
                    try {
                        const active = document.activeElement;
            
                        // Textarea or input field
                        if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
                            const start = active.selectionStart;
                            const end = active.selectionEnd;
            
                            if (start !== end) {
                                active.setRangeText(newText, start, end, "end");
                                active.selectionStart = active.selectionEnd = start + newText.length;
                                showToast("✅ Text replaced in input.");
                            } else {
                                showToast("⚠️ Please select some text first.");
                            }
                            return;
                        }
            
                        // Contenteditable or page selection
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount) {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(document.createTextNode(newText));
                            showToast("✅ Text replaced.");
                            return;
                        }
            
                        // Fallback
                        if (document.execCommand("insertText", false, newText)) {
                            showToast("✅ Text inserted (fallback).");
                        } else {
                            showToast("⚠️ Failed to insert text.");
                        }
            
                    } catch (err) {
                        console.error("Replacement error:", err);
                        showToast("❌ Replacement failed.");
                    } finally {
                        setTimeout(() => {
                            window.__klikkfix_replacement_running__ = false;
                        }, 100);
                    }
                },
                args: [data.improved_text]
            });
            

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: showToast,
                args: ["✅ AI Successfully Changed Your Text!"]
            });

            incrementUserUsageCount(userKey);

            // Update usage count (request made) with API call to sync with database
            fetch("https://klikkfix-backend.onrender.com/api/update_request_count", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userData.email, provider: userData.provider.toLowerCase() })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("✅ Synced request count with backend");
                } else {
                    console.warn("⚠️ Failed to sync request count:", data.message);
                }
            })
            .catch(error => {
                console.error("❌ Error syncing request count:", error);
            });
        } else {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: showToast,
                args: ["❌ Error: " + data.error]
            });
        }
    })
    .catch(error => {
        console.error("Fetch error:", error);
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: showToast,
            args: ["❌ Error: Failed to fetch improved text."]
        });
    })
    .finally(() => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: hideLoadingIndicator
        });
    });
}


// Replace selected text on the page-- NOT IN USE
function replaceSelectedText(newText) {
    console.log("🧠 replaceSelectedText CALLED with:", newText);
    // 🛑 Prevent running more than once per call
    if (window.__klikkfix_replacement_done__) return;
    window.__klikkfix_replacement_done__ = true;
    try {
        const activeElement = document.activeElement;

        // ✅ Step 1: Handle textareas/inputs (original logic)
        if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;

            if (start === end) {
                showToast("⚠️ Please select some text to replace.");
                return;
            }

            activeElement.setRangeText(newText, start, end, "end");
            activeElement.selectionStart = activeElement.selectionEnd = start + newText.length;
            showToast("✅ Text successfully replaced!");
            return;
        }

        // ✅ Step 2: Try normal content replacement via Range API
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            showToast("⚠️ No text selected. Please highlight text to replace.");
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        showToast("✅ Successfully replaced the text!");
        return;

    } catch (error) {
        console.warn("⚠️ Standard text replacement failed. Trying fallback...", error);
    }

    // ✅ Step 3: Fallback for Notion & contentEditable areas
    try {
        const success = document.execCommand("insertText", false, newText);
        if (success) {
            showToast("✅ Text successfully inserted (fallback)!");
        } else {
            showToast("⚠️ Unable to insert text automatically.");
        }
    } catch (fallbackError) {
        console.error("❌ Fallback replacement failed:", fallbackError);
        showToast("❌ Failed to replace text. Try again.");
    }
        // Reset flag after a moment (in case user uses again)
        setTimeout(() => {
            window.__klikkfix_replacement_done__ = false;
        }, 100);
    
    
}


function incrementUserUsageCount(userKey, callback = () => {}) {
    // this function is to increment the daily requests made
    chrome.storage.local.get(["users"], (result) => {
        const users = result.users || {};
        const user = users[userKey];

        if (!user) {
            console.warn(`No user found for key: ${userKey}`);
            return;
        }

        user.usageCount = (user.usageCount || 0) + 1;
        users[userKey] = user;

        chrome.storage.local.set({ users }, () => {
            console.log(`✅ usageCount updated to ${user.usageCount} for user: ${userKey}`);
            callback(user.usageCount);  // Optional callback if you want to refresh the UI or trigger events
        });
    });
}



// Show toast message
function showToast(message) {
    let toast = document.createElement("div");
    toast.innerText = message;
    toast.style.fontSize = "18px";
    toast.style.letterSpacing = "0.05";
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



chrome.commands.onCommand.addListener((command) => {
    console.log("🔥 Shortcut triggered:", command);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) return;

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString(),
        }, (injectionResults) => {
            const selectedText = injectionResults?.[0]?.result || "";
            console.log("👉 Shortcut selected text:", selectedText);

            if (!selectedText) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: showToast,
                    args: ["⚠️ No text selected."],
                });
                return;
            }

            if (selectedText.length > 1000) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: showToast,
                    args: ["⚠️ Selected text is too long."],
                });
                return;
            }

            // ✅ Trigger AI with correct tool ID
            const toolMap = {
                "trigger-improve": "improveText",
                "trigger-professional": "professionalText",
                "trigger-solve": "solve",
            };

            const toolId = toolMap[command];
            if (toolId) {
                processText(toolId, selectedText, tab);
            }
        });
    });
});

  


// ✅ Show Loading Indicator at Bottom Right
function showLoadingIndicator() {
    if (document.getElementById("klikkfix-loading")) return;

    let loader = document.createElement("div");
    loader.id = "klikkfix-loading";
    loader.innerHTML = `
        <div style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 35px;
            height: 35px;
            border: 3px solid #ccc;
            border-top: 3px solid black;
            border-radius: 50%;
            animation: spin 1.2s linear infinite;
            z-index: 10000;
        "></div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loader);
}

// Hide Loading Indicator
function hideLoadingIndicator() {
    let loader = document.getElementById("klikkfix-loading");
    if (loader) {
        loader.remove();
    }
}


/*
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "textSelected") {
        console.log("🟢 Tekst mottatt fra contentScript:", request.text);
        // Valgfritt: Lagre i background eller start KlikkFix-flyt
    }
});
*/
